import { createToast, PROVINCES_MAP, updateDashboardUI, historyLogs, playAlertTone, speakText } from './ui_manager';
import { requestCache } from './performance';
import { requestEsp32Announcement } from './firebase_client';

// ============================================================================
// NEW ARCHITECTURE IMPORTS
// ============================================================================
import { store, actions } from './store';
import { eventBus, eventFactory } from './event_bus';
import { weatherLogger, deviceLogger, apiLogger } from './logger';
import { validateWeatherData } from './validators';
import { errorBoundary, ErrorCategory, handleApiError, handleNetworkError } from './error_boundary';
import { getCommunicationManager } from './communication_manager';
import { DeviceCommandQueue, DeviceCommands } from './device_commands';
import { MessageType } from './websocket_types';
import { evaluateRainAlert, rainAlertConfig } from './rain_alert';
import { buildOutdoorReadinessSummary } from './ui_manager';
import { assessWeatherHazards } from './hazard_assessment';

const TELEGRAM_BOT_TOKEN = (import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = (import.meta.env.VITE_TELEGRAM_CHAT_ID || "").trim();

let currentStrobeState = false;
let currentDoorState = false;
let lastTelegramAlertKey: string | null = null;
let latestWeatherRequestId = 0;

export const buildTelegramAlertKey = (
    province: string,
    severity: string,
    tempC: number,
    humidity: number,
    rainMm: number,
    gustKmh: number,
    uvIndex: number
) => {
    return [
        province.trim(),
        severity,
        Math.round(tempC),
        Math.round(humidity),
        Math.round(rainMm),
        Math.round(gustKmh),
        Math.round(uvIndex)
    ].join('|');
};

// Initialize WebSocket command queue
const commManager = getCommunicationManager();
const commandQueue = new DeviceCommandQueue(commManager.getWebSocketClient() || undefined);
const deviceCommands = new DeviceCommands(commandQueue);

// Set WebSocket client when it becomes available
commManager.onModeChange((mode) => {
  if (mode === 'websocket' || mode === 'hybrid') {
    const wsClient = commManager.getWebSocketClient();
    if (wsClient) {
      commandQueue.setWebSocketClient(wsClient);
      
      // Register acknowledgment handler
      wsClient.on(MessageType.ACK, (message) => {
        commandQueue.handleAck(message as any);
      });
    }
  }
});

export const fetchOpenMeteoWeather = async (provinceName: string) => {
    const requestId = ++latestWeatherRequestId;
    weatherLogger.info(`Fetching weather data for ${provinceName}`, { province: provinceName });

    const info = PROVINCES_MAP[provinceName] || PROVINCES_MAP["กรุงเทพมหานคร"];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok`;

    store.dispatch(actions.fetchWeatherStart(provinceName));

    try {
        const weatherPayload = await requestCache.fetch(url, {
            headers: { Accept: 'application/json' }
        }, 60000);

        const cur = weatherPayload?.current || {};

        let riverDischarge: number | null = null;
        try {
            const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${info.lat}&longitude=${info.lon}&daily=river_discharge&forecast_days=1`;
            const floodPayload = await requestCache.fetch(floodUrl, {
                headers: { Accept: 'application/json' }
            }, 60000);
            const forecastValue = floodPayload?.daily?.river_discharge?.[0];
            if (typeof forecastValue === 'number' && Number.isFinite(forecastValue)) {
                riverDischarge = forecastValue;
            }
        } catch (_) {
            riverDischarge = null;
        }

        // A slower response for a previous province must not overwrite the current selection.
        if (requestId !== latestWeatherRequestId) return null;

        // Keep the existing numeric weather schema valid when the flood API has no value.
        // The availability flag below prevents this fallback zero from being shown as live data.
        cur.river_discharge = riverDischarge ?? 0;

        const validation = validateWeatherData(cur);
        if (!validation.isValid) {
            apiLogger.error('Weather data validation failed', undefined, {
                errors: validation.errors,
                warnings: validation.warnings
            });
            store.dispatch(actions.fetchWeatherError(validation.errors.join(', ')));
            handleApiError('Weather data validation failed', undefined, { province: provinceName });
            return null;
        }

        const uv = cur.uv_index || 0;
        const apparent = cur.apparent_temperature || cur.temperature_2m || 0;
        const gust = cur.wind_gusts_10m || 0;
        const rain = cur.precipitation || 0;
        const rainAlert = evaluateRainAlert(cur);

        const supportedBands = assessWeatherHazards(cur).findings.map(finding => finding.band);
        let severity: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
        if (supportedBands.some(band => band === 'danger' || band === 'very-dangerous')) {
            severity = "CRITICAL";
        } else if (supportedBands.some(band => band === 'warning' || band === 'watch')) {
            severity = "WARNING";
        }

        if (rainAlert.level === "CRITICAL") {
            severity = "CRITICAL";
        } else if (rainAlert.level === "WARNING") {
            if (severity === "NORMAL") {
                severity = "WARNING";
            }
        }

        if (rainAlertConfig.enabled && rainAlert.level !== 'NORMAL') {
            const rainMessage = `[รายงานฝน] ${rainAlert.message}\nพื้นที่: จ.${provinceName}\nเวลา: ${new Date().toLocaleString('th-TH')}`;
            const weatherDecision = buildOutdoorReadinessSummary(
                Number(cur.temperature_2m ?? cur.apparent_temperature ?? 0),
                Number(cur.relative_humidity_2m ?? 0),
                Number((cur.apparent_temperature ?? cur.temperature_2m ?? 0) * 0.7 + (cur.relative_humidity_2m ?? 0) * 0.2),
                Number(cur.precipitation ?? 0),
                Number(cur.wind_gusts_10m ?? 0),
                Number(cur.uv_index ?? 0),
                Number(cur.weather_code ?? 0)
            );

            if (rainAlertConfig.notifyDashboard) {
                createToast(rainMessage, rainAlert.level === 'CRITICAL' ? 'alert' : 'info');
            }
            if (rainAlertConfig.notifyTelegram) {
                const telegramSeverity = rainAlert.level === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
                const alertKey = buildTelegramAlertKey(
                    provinceName,
                    telegramSeverity,
                    Number(cur.temperature_2m ?? cur.apparent_temperature ?? 0),
                    Number(cur.relative_humidity_2m ?? 0),
                    Number(cur.precipitation ?? 0),
                    Number(cur.wind_gusts_10m ?? 0),
                    Number(cur.uv_index ?? 0)
                );

                if (alertKey !== lastTelegramAlertKey) {
                    lastTelegramAlertKey = alertKey;
                    void sendTelegramAlert(`${rainMessage}\nการวิเคราะห์: ${weatherDecision.summary}\nการตัดสินใจ: ${weatherDecision.decision}\nคำแนะนำ: ${weatherDecision.action}`, telegramSeverity, provinceName);
                }
            }
        } else if (rainAlertConfig.enabled && rainAlert.level === 'NORMAL') {
            lastTelegramAlertKey = null;
        }

        updateDashboardUI(cur, severity, provinceName, riverDischarge !== null);
        store.dispatch(actions.fetchWeatherSuccess(cur, severity, provinceName));
        eventBus.publish(eventFactory.weatherUpdated(cur, severity, provinceName, 'open-meteo-api'));

        store.dispatch(actions.addHistoryLog({
            time: new Date().toLocaleTimeString(),
            province: provinceName,
            severity,
            description: `UV: ${uv.toFixed(1)} | Heat: ${apparent.toFixed(1)}°C | Rain: ${rain.toFixed(1)} mm | Gust: ${gust.toFixed(1)} km/h`,
            metrics: `UV ${uv.toFixed(1)} / ${apparent.toFixed(1)}°C`
        }));

        createToast(`อัปเดตข้อมูลสดสำหรับ จ.${provinceName} สำเร็จ`, "success");
        weatherLogger.info(`Weather data fetched successfully for ${provinceName}`, {
            severity,
            uv,
            temperature: apparent
        });

        return { weather: cur, severity };
    } catch (err: any) {
        if (requestId !== latestWeatherRequestId) return null;
        console.error("Open-Meteo fetch failed:", err);
        weatherLogger.error(`Failed to fetch weather data for ${provinceName}`, err, {
            province: provinceName
        });

        store.dispatch(actions.fetchWeatherError(err?.message || 'Open-Meteo request failed'));
        eventBus.publish(eventFactory.weatherError(err?.message || 'Open-Meteo request failed', provinceName, 'open-meteo-api'));
        handleNetworkError(`Failed to fetch weather data: ${err?.message || 'unknown error'}`, err, { province: provinceName });

        createToast("ไม่สามารถดึงข้อมูล Open-Meteo ได้: " + (err?.message || 'unknown error'), "alert");
        return null;
    }
};

export const toggleStrobe = async () => {
    // Try to send via WebSocket if available
    if (commManager.isWebSocketConnected()) {
        try {
            const result = await deviceCommands.toggleStrobe();
            if (result.success) {
                currentStrobeState = !currentStrobeState;
                createToast(`Strobe Relay: ${currentStrobeState ? 'ON' : 'OFF'} (via WebSocket)`, "success");
            } else {
                createToast(`Strobe command failed: ${result.error}`, "alert");
                return;
            }
        } catch (error) {
            console.error('WebSocket command error:', error);
            // Fallback to local state
            currentStrobeState = !currentStrobeState;
            createToast(`Strobe Relay: ${currentStrobeState ? 'ON' : 'OFF'} (local mode)`, "info");
        }
    } else {
        // Fallback to local state management
        currentStrobeState = !currentStrobeState;
        createToast(`Strobe Relay: ${currentStrobeState ? 'ON' : 'OFF'} (local mode)`, "info");
    }

    // Update UI
    const pill = document.getElementById('strobeStatusPill');
    if (pill) {
        pill.textContent = currentStrobeState ? "ON (MANUAL)" : "OFF";
        pill.style.cssText = currentStrobeState ? "background: rgba(239,68,68,0.2); color: #ef4444;" : "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
    }
};

export const toggleEmergencyDoor = async () => {
    // Try to send via WebSocket if available
    if (commManager.isWebSocketConnected()) {
        try {
            const result = await deviceCommands.toggleDoor();
            if (result.success) {
                currentDoorState = !currentDoorState;
                createToast(`Emergency Doors: ${currentDoorState ? 'UNLOCKED' : 'LOCKED'} (via WebSocket)`, "success");
            } else {
                createToast(`Door command failed: ${result.error}`, "alert");
                return;
            }
        } catch (error) {
            console.error('WebSocket command error:', error);
            // Fallback to local state
            currentDoorState = !currentDoorState;
            createToast(`Emergency Doors: ${currentDoorState ? 'UNLOCKED' : 'LOCKED'} (local mode)`, "info");
        }
    } else {
        // Fallback to local state management
        currentDoorState = !currentDoorState;
        createToast(`Emergency Doors: ${currentDoorState ? 'UNLOCKED' : 'LOCKED'} (local mode)`, "info");
    }

    // Update UI
    const pill = document.getElementById('doorStatusPill');
    if (pill) {
        pill.textContent = currentDoorState ? "UNLOCKED (MANUAL)" : "LOCKED";
        pill.style.cssText = currentDoorState ? "background: rgba(239,68,68,0.2); color: #ef4444;" : "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
    }
};

export const silenceAlarm = async () => {
    // Try to send via WebSocket if available
    if (commManager.isWebSocketConnected()) {
        try {
            const result = await deviceCommands.silenceAlarm();
            if (!result.success) {
                createToast(`Silence alarm command failed: ${result.error}`, "alert");
                return;
            }
        } catch (error) {
            console.error('WebSocket command error:', error);
        }
    }

    // Update UI
    const sirenPill = document.getElementById('sirenStatusPill');
    if (sirenPill) {
        sirenPill.textContent = "MUTED";
        sirenPill.style.cssText = "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
    }
    createToast("สัญญาณเสียงไซเรนถูกปิดชั่วคราว (Silenced)", "info");
};

export const testAudioSiren = async () => {
    const sirenPill = document.getElementById('sirenStatusPill');
    if (sirenPill) {
        sirenPill.textContent = "TESTING SPEAKERS";
        sirenPill.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
    }
    createToast("กำลังทดสอบเสียงแจ้งเตือนผ่านลำโพงจริงและ ESP32…", "info");

    // 1. Play real audio chime & Thai voice through browser / device speakers
    void playAlertTone('official');
    setTimeout(() => {
        speakText('นี่คือการทดสอบสัญญาณเสียงแจ้งเตือนและระบบกระจายเสียงฉุกเฉิน ลำโพงทำงานปกติ');
    }, 600);

    try {
        await requestEsp32Announcement('ทดสอบเสียงลำโพง ESP32 ผ่าน PCM5102');
        createToast("ESP32 กำลังส่งเสียงออกลำโพง PCM5102 แล้ว", "success");
        setTimeout(() => {
            if (sirenPill) {
                sirenPill.textContent = "NORMAL (SILENT)";
                sirenPill.style.cssText = "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
            }
        }, 4000);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
        createToast(`ส่งเสียงไปลำโพง ESP32 ไม่สำเร็จ: ${message}`, "alert");
        if (sirenPill) {
            sirenPill.textContent = "ESP32 SPEAKER ERROR";
            sirenPill.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
        }
    }
};

export const sendTelegramAlert = async (message: string, severity: string, province: string) => {
    createToast("กำลังส่งข้อความแจ้งเตือนไปยัง Telegram...", "info");
    const prefix = severity === 'CRITICAL' ? '[CRITICAL HAZARD]' : '[WARNING]';
    const text = `<b>${prefix}</b> ${message}\n<b>พื้นที่:</b> จ.${province}\n<b>การตอบสนองระบบ:</b> เปิดสัญญาณไฟไซเรนฉุกเฉิน | ปลดล็อกประตูอัตโนมัติ\n<b>เวลา:</b> ${new Date().toLocaleString('th-TH')}\n<b>โหนด:</b> Smart Building Command Center 2026`;

    try {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_BOT_TOKEN.includes('YOUR_') || TELEGRAM_CHAT_ID.includes('YOUR_')) {
            createToast('Telegram ยังไม่ได้ตั้งค่า กรุณาใส่ BOT TOKEN และ CHAT ID', 'alert');
            return;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'HTML'
            })
        });

        if (resp.ok) {
            createToast("ส่งแจ้งเตือนเข้า Telegram สำเร็จเรียบร้อย", "success");
        } else {
            const errData = await resp.json();
            createToast(`Telegram Error: ${errData.description || 'Failed'}`, "alert");
        }
    } catch (err: any) {
        createToast(`ส่งแจ้งเตือนไม่สำเร็จ: ${err.message}`, "alert");
    }
};

export const exportHistoryCsv = () => {
    if (historyLogs.length === 0) {
        createToast("ยังไม่มีข้อมูลประวัติให้ Export", "alert");
        return;
    }
    
    const headers = ["Time", "Province", "Severity", "Description", "Metrics"];
    const rows = historyLogs.map(l => [l.time, l.province, l.severity, `"${l.desc}"`, `"${l.metrics}"`]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `disaster_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup DOM and revoke object URL to prevent memory leaks
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    createToast("ดาวน์โหลดไฟล์ CSV สำเร็จ!", "success");
};

/**
 * Get WebSocket command statistics
 */
export const getCommandStats = () => {
    return deviceCommands.getStats();
};

/**
 * Get WebSocket command history
 */
export const getCommandHistory = () => {
    return deviceCommands.getHistory();
};

/**
 * Get current communication mode
 */
export const getCommunicationMode = () => {
    return commManager.getMode();
};

/**
 * Check if WebSocket is connected
 */
export const isWebSocketConnected = () => {
    return commManager.isWebSocketConnected();
};

/**
 * Force WebSocket reconnection
 */
export const reconnectWebSocket = () => {
    commManager.reconnectWebSocket();
};
