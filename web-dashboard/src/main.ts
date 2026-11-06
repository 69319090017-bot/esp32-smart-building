import './style.css';
import './ui.css';
import './editorial.css';
import Chart from 'chart.js/auto';
import { initializeFirebase, requestEsp32Announcement } from './firebase_client';
import { initializeIndoorHome } from './smart_home/indoor_home';
import { initElectricityCalculator } from './electricity_calculator';
import { initializeHeatRiskPage } from './heat-risk-page';
import { getCommunicationManager, CommunicationMode } from './communication_manager';
import { 
    UI, 
    PROVINCES_MAP, 
    populateProvinces, 
    switchView, 
    applyLanguage, 
    toggleLanguage, 
    updateDashboardUI, 
    speakText, 
    stopSpeech,
    speakTextWithStatus,
    enableAutomaticSpeech,
    isAutomaticSpeechEnabled,
    getSpeechRate,
    setSpeechRate,
    speakWeatherSummary,
    getAlertToneVolume,
    setAlertToneVolume,
    playAlertTone,
    getAudioDestination,
    setAudioDestination,
    AudioDestination,
    createToast,
    triggerActionWithOptions,
    historyLogs,
    toggleHumidityDetailView
} from './ui_manager';
import { initializeOfficialAlerts, repeatLatestOfficialAlert, setOfficialAlertsProvince } from './official_alerts';
import { initializeDiagnostics, appendSystemLog } from './diagnostics';
import { 
    fetchOpenMeteoWeather, 
    toggleStrobe, 
    toggleEmergencyDoor, 
    silenceAlarm, 
    testAudioSiren, 
    sendTelegramAlert, 
    exportHistoryCsv,
    getCommunicationMode,
    isWebSocketConnected,
    reconnectWebSocket
} from './device_controller';
import {
    RadarChartComponent,
    TimeSeriesChartComponent,
    GaugeChartComponent,
    SparklineComponent,
    HeatmapComponent,
    chartManager,
    type HazardData,
    type HistoricalDataPoint
} from './chart_components';

// ============================================================================
// NEW ARCHITECTURE IMPORTS
// ============================================================================
import { store, actions, selectCurrentProvince, selectLanguage } from './store';
import { eventBus, eventFactory } from './event_bus';
import { logger, setupGlobalErrorHandlers } from './logger';
import { errorBoundary, injectErrorStyles, ErrorCategory } from './error_boundary';
import { validateUserInput } from './validators';

const DEMO_SCENARIO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';

if (DEMO_SCENARIO_MODE) {
    document.querySelector('[data-view="simulator"]')?.removeAttribute('hidden');
    document.getElementById('view-simulator')?.removeAttribute('hidden');
    document.getElementById('simulatorDemoNotice')?.removeAttribute('hidden');
}

// Expose injectScenario globally so buttons can call it
(window as any).onProvinceChange = async (val: string) => {
    const targetProvince = val || 'กรุงเทพมหานคร';
    if (UI.provinceSelect && UI.provinceSelect.value !== targetProvince) {
        UI.provinceSelect.value = targetProvince;
    }

    store.dispatch(actions.setProvince(targetProvince));
    localStorage.setItem('sbc_monitored_province', targetProvince);
    setOfficialAlertsProvince(targetProvince);
    await fetchOpenMeteoWeather(targetProvince);
};

(window as any).fetchDataManual = async () => {
    const activeProvince = UI.provinceSelect?.value || store.getState().weather.province || 'กรุงเทพมหานคร';
    await fetchOpenMeteoWeather(activeProvince);
};

(window as any).injectScenario = async (type: string) => {
    const prov = UI.provinceSelect.value || "กรุงเทพมหานคร";

    if (type === 'live') {
        createToast("กำลังดึงข้อมูลดาวเทียมสดจาก Open-Meteo...", "info");
        await fetchOpenMeteoWeather(prov);
        return;
    }

    if (!DEMO_SCENARIO_MODE) {
        createToast('ปิดการจำลองไว้ ข้อมูลตัวอย่างจะไม่ถูกนำไปแสดงเป็นข้อมูลจริง', 'info');
        return;
    }

    let fakeWeather: any = {};
    let sev = "NORMAL";
    let alertMsg = "";

    if (type === 'uv') {
        fakeWeather = {
            uv_index: 12.5,
            apparent_temperature: 39.0,
            temperature_2m: 35.0,
            weather_code: 0,
            wind_gusts_10m: 18.0,
            wind_speed_10m: 10.0,
            precipitation: 0.0,
            river_discharge: 50.0
        };
        sev = "CRITICAL";
        alertMsg = `เตือนภัยดัชนี UV สูงจัด (12.5) เสี่ยงผิวไหม้รุนแรงในไม่กี่นาที จ.${prov}`;
    } else if (type === 'heat') {
        fakeWeather = {
            uv_index: 9.0,
            apparent_temperature: 43.5,
            temperature_2m: 39.5,
            weather_code: 1,
            wind_gusts_10m: 15.0,
            wind_speed_10m: 8.0,
            precipitation: 0.0,
            river_discharge: 45.0
        };
        sev = "CRITICAL";
        alertMsg = `เตือนภัยอากาศร้อนจัด รู้สึกเหมือน 43.5°C เสี่ยงโรคลมแดด (Heatstroke) จ.${prov}`;
    } else if (type === 'storm') {
        fakeWeather = {
            uv_index: 1.0,
            apparent_temperature: 28.0,
            temperature_2m: 26.0,
            weather_code: 96,
            wind_gusts_10m: 85.0,
            wind_speed_10m: 45.0,
            precipitation: 32.0,
            river_discharge: 220.0
        };
        sev = "CRITICAL";
        alertMsg = `เตือนภัยพายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ (WMO 96) จ.${prov}`;
    } else if (type === 'gust') {
        fakeWeather = {
            uv_index: 3.0,
            apparent_temperature: 30.0,
            temperature_2m: 28.0,
            weather_code: 82,
            wind_gusts_10m: 95.0,
            wind_speed_10m: 60.0,
            precipitation: 5.0,
            river_discharge: 110.0
        };
        sev = "CRITICAL";
        alertMsg = `เตือนภัยลมกระโชกรุนแรง 95.0 กม./ชม. จ.${prov}`;
    } else if (type === 'flood') {
        fakeWeather = {
            uv_index: 0.5,
            apparent_temperature: 26.0,
            temperature_2m: 25.0,
            weather_code: 65,
            wind_gusts_10m: 55.0,
            wind_speed_10m: 30.0,
            precipitation: 48.0,
            river_discharge: 680.0
        };
        sev = "CRITICAL";
        alertMsg = `เตือนภัยฝนตกหนักมาก 48 มม./ชม. ระวังน้ำท่วมฉับพลันและน้ำในแม่น้ำล้นตลิ่ง จ.${prov}`;
    } else if (type === 'clear') {
        fakeWeather = {
            uv_index: 4.5,
            apparent_temperature: 31.0,
            temperature_2m: 29.0,
            weather_code: 1,
            wind_gusts_10m: 18.0,
            wind_speed_10m: 12.0,
            precipitation: 0.0,
            river_discharge: 85.0
        };
        sev = "NORMAL";
        createToast("รีเซ็ตสถานะเป็นปกติ (All Hazards Safe)", "success");
    }

    updateDashboardUI(fakeWeather, sev, prov);

    if (sev === "CRITICAL") {
        const demoMessage = `นี่คือข้อมูลตัวอย่าง ${alertMsg}`;
        speakText(demoMessage);
        createToast(demoMessage, "alert");
        // Keep the former notification path visible, but never transmit simulated data.
        if (!DEMO_SCENARIO_MODE) sendTelegramAlert(alertMsg, sev, prov);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initializeHeatRiskPage();
    // ============================================================================
    // NEW ARCHITECTURE INITIALIZATION
    // ============================================================================
    try {
        // 1. Setup global error handlers
        setupGlobalErrorHandlers();
        injectErrorStyles();

        // 2. Initialize logger
        logger.info('Smart Building Command Center initializing...', 'system');

        // 3. Publish system startup event
        eventBus.publish(eventFactory.systemStartup('1.0.0'));

        // 4. Setup store subscription for UI updates
        store.subscribe((state) => {
            // Sync language from store to UI
            if (state.ui.language !== selectLanguage(store.getState())) {
                const currentLang = selectLanguage(store.getState());
                if (currentLang !== (localStorage.getItem('sbc_lang') || 'th')) {
                    applyLanguage();
                }
            }

            // Handle toast notifications from store
            state.ui.toasts.forEach(toast => {
                createToast(toast.message, toast.type);
                // Remove toast after displaying
                store.dispatch(actions.removeToast(toast.id));
            });
        });

        logger.info('Architecture components initialized', 'system');
    } catch (error) {
        errorBoundary.handleError(
            'Failed to initialize architecture components',
            errorBoundary.constructor.name as any,
            error as Error
        );
    }

    // 0. Initialize Communication Manager (WebSocket + Fallback)
    const commManager = getCommunicationManager();

    // Register telemetry handler to update dashboard
    commManager.onTelemetry((data) => {
        const province = data.province || UI.provinceSelect.value || "กรุงเทพมหานคร";
        updateDashboardUI(data, data.severity || 'NORMAL', province);

        // Publish weather updated event
        eventBus.publish(eventFactory.weatherUpdated(
            data,
            data.severity || 'NORMAL',
            province,
            'communication-manager'
        ));
    });

    // Register mode change handler to update UI indicators
    commManager.onModeChange((mode) => {
        updateConnectionStatusUI(mode);
    });

    // 1. Setup Navigation
    UI.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.dataset.view as string);
        });
    });

    UI.humidityDetailBtn?.addEventListener('click', () => {
        toggleHumidityDetailView();
        const section = UI.humidityDetailSection;
        if (section) {
            const isHidden = section.classList.contains('hidden');
            UI.humidityDetailBtn.textContent = isHidden ? 'รายละเอียดความชื้น' : 'ปิดรายละเอียด';
        }
    });

    // 2. Language Toggle
    applyLanguage();
    UI.langToggleBtn?.addEventListener('click', () => {
        toggleLanguage();
        createToast("เปลี่ยนภาษาเรียบร้อย", "info");
    });

    // 3. Populate provinces and keep the selected value as the single source of truth
    const savedProvince = localStorage.getItem('sbc_monitored_province');
    const initialProvince = savedProvince && PROVINCES_MAP[savedProvince]
        ? savedProvince
        : store.getState().weather.province || 'กรุงเทพมหานคร';
    populateProvinces(initialProvince);
    setOfficialAlertsProvince(initialProvince);
    UI.provinceSelect?.addEventListener('change', async (e) => {
        const provName = (e.target as HTMLSelectElement).value;

        // Validate input
        const validation = validateUserInput({ province: provName });
        if (!validation.isValid) {
            logger.error('Invalid province selected', undefined, 'main', {
                province: provName,
                errors: validation.errors
            });
            store.dispatch(actions.addToast('Invalid province selected', 'alert'));
            return;
        }

        const coords = PROVINCES_MAP[provName];
        if (coords) {
            UI.coordsDisplay.textContent = `${coords.lat.toFixed(4)}°N, ${coords.lon.toFixed(4)}°E`;
        }

        // Update store
        store.dispatch(actions.setProvince(provName));
        localStorage.setItem('sbc_monitored_province', provName);
        setOfficialAlertsProvince(provName);

        // Publish user action event
        eventBus.publish(eventFactory.userAction('province_changed', {
            province: provName
        }));

        await errorBoundary.wrapAsync(
            () => fetchOpenMeteoWeather(provName),
            ErrorCategory.API,
            { province: provName }
        );
    });

    // 4. Building Control Bindings
    UI.toggleStrobeBtn?.addEventListener('click', () => {
        triggerActionWithOptions(() => {
            errorBoundary.wrap(toggleStrobe, ErrorCategory.DEVICE, { action: 'toggle_strobe' })();

            // Publish device changed event
            eventBus.publish(eventFactory.deviceChanged(
                'strobe',
                'toggle',
                store.getState().device.status.strobe,
                !store.getState().device.status.strobe,
                'ui'
            ));

            // Update store
            store.dispatch(actions.toggleStrobe());
        }, UI.toggleStrobeBtn, 'Strobe');
    });

    UI.toggleDoorBtn?.addEventListener('click', () => {
        triggerActionWithOptions(() => {
            errorBoundary.wrap(toggleEmergencyDoor, ErrorCategory.DEVICE, { action: 'toggle_door' })();

            // Publish device changed event
            eventBus.publish(eventFactory.deviceChanged(
                'emergency_door',
                'toggle',
                store.getState().device.status.emergencyDoor,
                !store.getState().device.status.emergencyDoor,
                'ui'
            ));

            // Update store
            store.dispatch(actions.toggleDoor());
        }, UI.toggleDoorBtn, 'Door');
    });

    UI.silenceAudioBtn?.addEventListener('click', () => {
        triggerActionWithOptions(() => {
            errorBoundary.wrap(silenceAlarm, ErrorCategory.DEVICE, { action: 'silence_siren' })();

            // Publish device changed event
            eventBus.publish(eventFactory.deviceChanged(
                'siren',
                'silence',
                store.getState().device.status.siren,
                false,
                'ui'
            ));

            // Update store
            store.dispatch(actions.silenceSiren());
        }, UI.silenceAudioBtn, 'Siren');
    });

    UI.testAudioBtn?.addEventListener('click', () => {
        triggerActionWithOptions(() => {
            errorBoundary.wrap(testAudioSiren, ErrorCategory.DEVICE, { action: 'test_siren' })();

            // Publish user action event
            eventBus.publish(eventFactory.userAction('test_siren'));

            // Update store
            store.dispatch(actions.testSiren());
        }, UI.testAudioBtn, 'Test Siren');
    });

    UI.exportCsvBtn?.addEventListener('click', () => {
        errorBoundary.wrap(exportHistoryCsv, ErrorCategory.UI, { action: 'export_csv' })();

        // Publish user action event
        eventBus.publish(eventFactory.userAction('export_history'));
    });

    UI.testTelegramBtn?.addEventListener('click', () => {
        const prov = UI.provinceSelect.value || "กรุงเทพมหานคร";
        triggerActionWithOptions(() => {
            errorBoundary.wrapAsync(
                () => sendTelegramAlert("นี่คือการทดสอบสัญญาณแจ้งเตือนภัยพิบัติฉุกเฉินจากหน้าเว็บ", "CRITICAL", prov),
                ErrorCategory.API,
                { action: 'test_telegram' }
            );

            // Publish user action event
            eventBus.publish(eventFactory.userAction('test_telegram', { province: prov }));
        }, UI.testTelegramBtn, 'Telegram');
    });

    UI.speakAlertBtn?.addEventListener('click', () => {
        const msg = UI.alertBannerMsg.textContent || "แจ้งเตือนภัยพิบัติฉุกเฉิน";
        triggerActionWithOptions(() => {
            errorBoundary.wrap(() => speakText(msg), ErrorCategory.UI, { action: 'speak_alert' })();

            // Publish user action event
            eventBus.publish(eventFactory.userAction('speak_alert'));
        }, UI.speakAlertBtn, 'Speak Alert');
    });

    UI.weatherSpeakBtn?.addEventListener('click', () => {
        speakWeatherSummary();
        eventBus.publish(eventFactory.userAction('weather_summary_speak'));
    });

    UI.weatherRepeatBtn?.addEventListener('click', () => {
        speakWeatherSummary();
        eventBus.publish(eventFactory.userAction('weather_summary_repeat'));
    });

    const speechRateSelect = document.getElementById('speechRateSelect') as HTMLSelectElement | null;
    if (speechRateSelect) {
        speechRateSelect.value = String(getSpeechRate());
        speechRateSelect.addEventListener('change', () => {
            if (setSpeechRate(Number(speechRateSelect.value)) && UI.ttsStatus) {
                UI.ttsStatus.textContent = 'ปรับความเร็วเสียงแล้ว กดทดลองเสียงเพื่อฟัง';
            }
        });
    }

    const alertToneVolume = document.getElementById('alertToneVolume') as HTMLInputElement | null;
    const alertToneVolumeValue = document.getElementById('alertToneVolumeValue') as HTMLOutputElement | null;
    if (alertToneVolume) {
        alertToneVolume.value = String(Math.round(getAlertToneVolume() * 100));
        if (alertToneVolumeValue) alertToneVolumeValue.value = `${alertToneVolume.value}%`;
        alertToneVolume.addEventListener('input', () => {
            const percentage = Number(alertToneVolume.value);
            if (setAlertToneVolume(percentage / 100) && alertToneVolumeValue) {
                alertToneVolumeValue.value = `${percentage}%`;
            }
        });
    }
    const audioDestSelect = document.getElementById('audioDestinationSelect') as HTMLSelectElement | null;
    if (audioDestSelect) {
        audioDestSelect.value = getAudioDestination();
        audioDestSelect.addEventListener('change', () => {
            const dest = audioDestSelect.value as AudioDestination;
            setAudioDestination(dest);
            const label = audioDestSelect.options[audioDestSelect.selectedIndex]?.text || dest;
            createToast(`ช่องทางเสียง: ${label}`, 'info');
        });
    }

    document.getElementById('esp32BuzzerTestBtn')?.addEventListener('click', async () => {
        try {
            await requestEsp32Announcement('ทดสอบลำโพง ESP32 (GPIO 27)', 'TEST');
            createToast('ส่งสัญญาณทดสอบไปยังลำโพง ESP32 (GPIO 27) แล้ว', 'success');
        } catch (err: any) {
            createToast(`สั่งลำโพงไม่สำเร็จ: ${err?.message || err}`, 'alert');
        }
    });

    document.getElementById('officialToneTestBtn')?.addEventListener('click', () => void playAlertTone('official'));
    document.getElementById('weatherToneTestBtn')?.addEventListener('click', () => void playAlertTone('weather'));

    document.getElementById('speechTestBtn')?.addEventListener('click', () => {
        speakText('ทดสอบเสียงภาษาไทย หนึ่ง สอง สาม. ถ้าฟังชัดแล้ว กดฟังสรุปตอนนี้');
    });

    document.getElementById('officialAlertRepeatBtn')?.addEventListener('click', () => {
        repeatLatestOfficialAlert();
    });

    UI.enableSpeechBtn?.addEventListener('click', () => {
        enableAutomaticSpeech();
        eventBus.publish(eventFactory.userAction('automatic_speech_enable'));
    });

    UI.ttsSpeakBtn?.addEventListener('click', () => {
        const text = UI.ttsText?.value || '';
        if (!text.trim()) {
            createToast('กรุณาพิมพ์ข้อความก่อนกด Speak', 'alert');
            if (UI.ttsStatus) UI.ttsStatus.textContent = 'กรุณาพิมพ์ข้อความก่อน';
            return;
        }

        triggerActionWithOptions(() => {
            errorBoundary.wrap(() => speakTextWithStatus(text), ErrorCategory.UI, { action: 'tts_speak' })();
            eventBus.publish(eventFactory.userAction('tts_speak', { text }));
        }, UI.ttsSpeakBtn, 'Voice');
    });

    UI.ttsStopBtn?.addEventListener('click', () => {
        errorBoundary.wrap(stopSpeech, ErrorCategory.UI, { action: 'tts_stop' })();
        eventBus.publish(eventFactory.userAction('tts_stop'));
    });

    const PNA_TEST_ALERT_KEY = 'sbcc_pna_test_alert';
    const PNA_TEST_ALERT_HISTORY_KEY = 'sbcc_pna_test_alert_history';
    const pnaTestAlert = document.getElementById('pnaTestAlert');
    const pnaTestEmpty = document.getElementById('pnaTestEmpty');
    const pnaTestAlertMessage = document.getElementById('pnaTestAlertMessage');
    const pnaTestAlertTime = document.getElementById('pnaTestAlertTime');
    const pnaTestSpeak = document.getElementById('pnaTestSpeak');
    const pnaTestStop = document.getElementById('pnaTestStop');
    const pnaTestHistoryCount = document.getElementById('pnaTestHistoryCount');
    const pnaTestHistoryList = document.getElementById('pnaTestHistoryList');

    const readPnaTestHistory = (): Array<{ message: string; createdAt: string }> => {
        try {
            const entries = JSON.parse(localStorage.getItem(PNA_TEST_ALERT_HISTORY_KEY) || '[]');
            if (!Array.isArray(entries)) return [];
            return entries.filter((entry): entry is { message: string; createdAt: string } =>
                typeof entry?.message === 'string' && typeof entry?.createdAt === 'string'
            );
        } catch {
            return [];
        }
    };

    const renderPnaTestHistory = () => {
        if (!pnaTestHistoryCount || !pnaTestHistoryList) return;

        const history = readPnaTestHistory();
        pnaTestHistoryCount.textContent = `${history.length} รายการ`;
        pnaTestHistoryList.replaceChildren();

        const latestEntries = history.map((entry, index) => ({ entry, index })).reverse();
        if (latestEntries.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'ยังไม่มีประวัติที่บันทึกไว้';
            pnaTestHistoryList.appendChild(emptyItem);
            return;
        }

        latestEntries.forEach(({ entry, index }) => {
            const item = document.createElement('li');
            const details = document.createElement('div');
            const message = document.createElement('p');
            const timestamp = document.createElement('time');
            const deleteButton = document.createElement('button');
            const createdAt = new Date(entry.createdAt);
            const formattedTime = Number.isNaN(createdAt.getTime())
                ? 'เวลาไม่พร้อมใช้งาน'
                : createdAt.toLocaleString('th-TH');

            message.textContent = entry.message;
            timestamp.textContent = formattedTime;
            if (!Number.isNaN(createdAt.getTime())) timestamp.dateTime = createdAt.toISOString();
            deleteButton.type = 'button';
            deleteButton.className = 'pna-test-delete-button';
            deleteButton.textContent = 'ลบรายการ';
            deleteButton.setAttribute('aria-label', `ลบรายการที่ส่งเมื่อ ${formattedTime}`);
            deleteButton.dataset.historyIndex = String(index);

            details.append(message, timestamp);
            item.append(details, deleteButton);
            pnaTestHistoryList.appendChild(item);
        });
    };

    let lastRenderedPnaMessage = '';

    const renderPnaTestAlert = (storedValue: string | null, shouldAutoVoice = false) => {
        if (!pnaTestAlert || !pnaTestEmpty || !pnaTestAlertMessage || !pnaTestAlertTime) return;

        try {
            const alert = storedValue ? JSON.parse(storedValue) as { message?: unknown; createdAt?: unknown } : null;
            if (typeof alert?.message !== 'string' || !alert.message.trim()) {
                pnaTestAlert.hidden = true;
                pnaTestEmpty.hidden = false;
                return;
            }

            const rawMsg = alert.message.trim();
            pnaTestAlertMessage.textContent = rawMsg;
            const createdAt = typeof alert.createdAt === 'string' ? new Date(alert.createdAt) : new Date();
            pnaTestAlertTime.textContent = Number.isNaN(createdAt.getTime())
                ? 'เวลาไม่พร้อมใช้งาน'
                : `ส่งเมื่อ ${createdAt.toLocaleString('th-TH')}`;
            pnaTestAlert.hidden = false;
            pnaTestEmpty.hidden = true;

            // Automatically voice through speakers if newly received or autoVoice requested
            if (shouldAutoVoice || (rawMsg && rawMsg !== lastRenderedPnaMessage)) {
                lastRenderedPnaMessage = rawMsg;
                void playAlertTone('official');
                setTimeout(() => {
                    speakText(`ข้อความแจ้งเตือน: ${rawMsg}`);
                }, 600);
                void requestEsp32Announcement(rawMsg);
            }
        } catch {
            pnaTestAlert.hidden = true;
            pnaTestEmpty.hidden = false;
        }
    };

    renderPnaTestAlert(localStorage.getItem(PNA_TEST_ALERT_KEY));
    renderPnaTestHistory();

    pnaTestSpeak?.addEventListener('click', () => {
        const message = pnaTestAlertMessage?.textContent?.trim();
        if (message) {
            void playAlertTone('official');
            setTimeout(() => {
                speakText(`ข้อความแจ้งเตือน: ${message}`);
            }, 600);
            void requestEsp32Announcement(message);
        }
    });
    pnaTestStop?.addEventListener('click', stopSpeech);

    // Quick Alert Broadcaster on Dashboard
    const pnaQuickMessageInput = document.getElementById('pnaQuickMessageInput') as HTMLInputElement | null;
    const pnaQuickSendBtn = document.getElementById('pnaQuickSendBtn') as HTMLButtonElement | null;
    const pnaTestSpeakerToneBtn = document.getElementById('pnaTestSpeakerToneBtn') as HTMLButtonElement | null;

    pnaTestSpeakerToneBtn?.addEventListener('click', () => {
        void playAlertTone('official');
        createToast('ทดสอบเสียงกริ่งสัญญาณเตือนภัย (Official Chime)', 'info');
    });

    const triggerQuickAlert = (rawText?: string) => {
        const text = (rawText || pnaQuickMessageInput?.value || '').trim();
        if (!text) {
            createToast('กรุณาพิมพ์ข้อความแจ้งเตือนก่อนส่งเสียง', 'alert');
            pnaQuickMessageInput?.focus();
            return;
        }

        const alert = { message: text, createdAt: new Date().toISOString() };
        localStorage.setItem(PNA_TEST_ALERT_KEY, JSON.stringify(alert));

        const history = readPnaTestHistory();
        history.push(alert);
        localStorage.setItem(PNA_TEST_ALERT_HISTORY_KEY, JSON.stringify(history.slice(-50)));
        renderPnaTestHistory();

        renderPnaTestAlert(JSON.stringify(alert), true);
        createToast(`กระจายเสียงแจ้งเตือนออกลำโพงเรียบร้อย`, 'success');
        if (pnaQuickMessageInput) pnaQuickMessageInput.value = '';
    };

    pnaQuickSendBtn?.addEventListener('click', () => triggerQuickAlert());
    pnaQuickMessageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerQuickAlert();
        }
    });

    pnaTestHistoryList?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || target.dataset.historyIndex === undefined) return;

        const index = Number(target.dataset.historyIndex);
        const history = readPnaTestHistory();
        if (!Number.isInteger(index) || index < 0 || index >= history.length) return;

        history.splice(index, 1);
        try {
            localStorage.setItem(PNA_TEST_ALERT_HISTORY_KEY, JSON.stringify(history));
            renderPnaTestHistory();
            createToast('ลบรายการออกจากประวัติแล้ว', 'success');
        } catch {
            createToast('ลบรายการไม่สำเร็จ', 'alert');
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key === PNA_TEST_ALERT_KEY) renderPnaTestAlert(event.newValue, true);
        if (event.key === PNA_TEST_ALERT_HISTORY_KEY) renderPnaTestHistory();
    });

    // 4.5 Initialize Diagnostics & Live Terminal (2026 Observability)
    initializeDiagnostics();
    const origConsoleWarn = console.warn;
    const origConsoleError = console.error;
    console.warn = (...args: any[]) => {
        origConsoleWarn(...args);
        appendSystemLog('warn', 'BROWSER', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };
    console.error = (...args: any[]) => {
        origConsoleError(...args);
        appendSystemLog('error', 'SYSTEM', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    // 5. Initialize Firebase (if configured)
    void initializeFirebase().then(() => initializeIndoorHome());
    initElectricityCalculator();
    initializeOfficialAlerts((text) => {
        // Direct manual click announcement - always play tone & speak immediately!
        void playAlertTone('official');
        setTimeout(() => speakText(text), 600);
    }, (text) => {
        // New incoming notices - automatically chime & announce if automatic speech enabled
        if (isAutomaticSpeechEnabled()) {
            void playAlertTone('official');
            setTimeout(() => speakText(text), 600);
        }
    });

    // 6. Initialize Charts System
    initializeCharts();

    // 7. Initial Weather Fetch (use the selected monitored province)
    const provinceForInitialWeather = UI.provinceSelect?.value || store.getState().weather.province || 'กรุงเทพมหานคร';
    createToast(`ดึงข้อมูลสภาพอากาศสดสำหรับ จ.${provinceForInitialWeather}...`, "info");
    await fetchOpenMeteoWeather(provinceForInitialWeather);

    // Refresh only while the dashboard is visible; catch up immediately on return.
    const refreshSelectedProvince = () => {
        const province = UI.provinceSelect?.value || store.getState().weather.province || 'กรุงเทพมหานคร';
        void fetchOpenMeteoWeather(province);
    };
    setInterval(() => {
        if (!document.hidden) refreshSelectedProvince();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshSelectedProvince();
    });
});

// ============================================================================
// CHARTS SYSTEM INITIALIZATION
// ============================================================================

let radarChart: RadarChartComponent | null = null;
let heatmapChart: HeatmapComponent | null = null;
let gaugeUV: GaugeChartComponent | null = null;
let gaugeHeat: GaugeChartComponent | null = null;
let gaugeWind: GaugeChartComponent | null = null;

let sparklineUV: SparklineComponent | null = null;
let sparklineHeat: SparklineComponent | null = null;
let sparklineWind: SparklineComponent | null = null;
let sparklineRain: SparklineComponent | null = null;
let sparklineRiver: SparklineComponent | null = null;

let timeSeriesCharts: Map<string, TimeSeriesChartComponent> = new Map();
let humidityHistoryChart: Chart | null = null;
let dewHistoryChart: Chart | null = null;

// Historical data storage for charts
const historicalDataStore: Map<string, HistoricalDataPoint[]> = new Map();
const WEATHER_CHART_HISTORY_KEY = 'sbc_weather_chart_history_v1';
const MAX_CHART_POINTS_PER_PROVINCE = 100;

const loadHistoricalData = (): void => {
    try {
        const saved = localStorage.getItem(WEATHER_CHART_HISTORY_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as Record<string, HistoricalDataPoint[]>;
        Object.entries(parsed).forEach(([province, points]) => {
            if (!Array.isArray(points)) return;
            const validPoints = points
                .filter((point) => point && point.data && Number.isFinite(Date.parse(String(point.timestamp))))
                .slice(-MAX_CHART_POINTS_PER_PROVINCE)
                .map((point) => ({ ...point, timestamp: new Date(point.timestamp) }));
            historicalDataStore.set(province, validPoints);
        });
    } catch {
        // Ignore malformed or unavailable local history; new measurements can still be recorded.
    }
};

const persistHistoricalData = (): void => {
    try {
        const serializable = Object.fromEntries(historicalDataStore.entries());
        localStorage.setItem(WEATHER_CHART_HISTORY_KEY, JSON.stringify(serializable));
    } catch {
        // Keep the live graph working if browser storage is full or unavailable.
    }
};

loadHistoricalData();

function initializeHumidityTrendCharts(): void {
    const humidityCanvas = document.getElementById('humidity-history-canvas') as HTMLCanvasElement | null;
    const dewCanvas = document.getElementById('dew-history-canvas') as HTMLCanvasElement | null;

    if (humidityCanvas) {
        const humidityCtx = humidityCanvas.getContext('2d');
        if (humidityCtx) {
            humidityHistoryChart = new Chart(humidityCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: '#00f3ff',
                        backgroundColor: 'rgba(0, 243, 255, 0.12)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { beginAtZero: false }
                    }
                }
            });
        }
    }

    if (dewCanvas) {
        const dewCtx = dewCanvas.getContext('2d');
        if (dewCtx) {
            dewHistoryChart = new Chart(dewCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Dew Point (°C)',
                        data: [],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.10)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { beginAtZero: false }
                    }
                }
            });
        }
    }
}

function initializeCharts(): void {
    try {
        // Initialize Sparklines for home dashboard
        sparklineUV = new SparklineComponent(
            { containerId: 'sparkline-uv', canvasId: 'sparkline-uv-canvas' },
            '#00f3ff'
        );
        chartManager.registerComponent('sparkline-uv', sparklineUV);

        sparklineHeat = new SparklineComponent(
            { containerId: 'sparkline-heat', canvasId: 'sparkline-heat-canvas' },
            '#ff0055'
        );
        chartManager.registerComponent('sparkline-heat', sparklineHeat);

        sparklineWind = new SparklineComponent(
            { containerId: 'sparkline-wind', canvasId: 'sparkline-wind-canvas' },
            '#3b82f6'
        );
        chartManager.registerComponent('sparkline-wind', sparklineWind);

        sparklineRain = new SparklineComponent(
            { containerId: 'sparkline-rain', canvasId: 'sparkline-rain-canvas' },
            '#10b981'
        );
        chartManager.registerComponent('sparkline-rain', sparklineRain);

        sparklineRiver = new SparklineComponent(
            { containerId: 'sparkline-river', canvasId: 'sparkline-river-canvas' },
            '#a855f7'
        );
        chartManager.registerComponent('sparkline-river', sparklineRiver);

        // Initialize Time Series Charts for analytics view
        const uvTimeSeries = new TimeSeriesChartComponent(
            { 
                containerId: 'uv-chart-container', 
                canvasId: 'uv-timeseries-canvas',
                title: 'UV Index History',
                showExport: true,
                showTimeRange: true
            },
            'uv_index',
            'UV Index',
            '#00f3ff',
            ''
        );
        chartManager.registerComponent('uv-timeseries', uvTimeSeries);
        timeSeriesCharts.set('uv', uvTimeSeries);

        const heatTimeSeries = new TimeSeriesChartComponent(
            { 
                containerId: 'heat-chart-container', 
                canvasId: 'heat-timeseries-canvas',
                title: 'Heat Index History',
                showExport: true,
                showTimeRange: true
            },
            'apparent_temperature',
            'Heat Index',
            '#ff0055',
            '°C'
        );
        chartManager.registerComponent('heat-timeseries', heatTimeSeries);
        timeSeriesCharts.set('heat', heatTimeSeries);

        const windTimeSeries = new TimeSeriesChartComponent(
            { 
                containerId: 'wind-chart-container', 
                canvasId: 'wind-timeseries-canvas',
                title: 'Wind Gusts History',
                showExport: true,
                showTimeRange: true
            },
            'wind_gusts_10m',
            'Wind Gusts',
            '#3b82f6',
            ' km/h'
        );
        chartManager.registerComponent('wind-timeseries', windTimeSeries);
        timeSeriesCharts.set('wind', windTimeSeries);

        const rainTimeSeries = new TimeSeriesChartComponent(
            { 
                containerId: 'rain-chart-container', 
                canvasId: 'rain-timeseries-canvas',
                title: 'Rainfall History',
                showExport: true,
                showTimeRange: true
            },
            'precipitation',
            'Rainfall',
            '#10b981',
            ' mm/h'
        );
        chartManager.registerComponent('rain-timeseries', rainTimeSeries);
        timeSeriesCharts.set('rain', rainTimeSeries);

        const riverTimeSeries = new TimeSeriesChartComponent(
            { 
                containerId: 'river-chart-container', 
                canvasId: 'river-timeseries-canvas',
                title: 'River Discharge History',
                showExport: true,
                showTimeRange: true
            },
            'river_discharge',
            'River Discharge',
            '#a855f7',
            ' m³/s'
        );
        chartManager.registerComponent('river-timeseries', riverTimeSeries);
        timeSeriesCharts.set('river', riverTimeSeries);

        // Listen for time range changes
        timeSeriesCharts.forEach((chart, key) => {
            const container = document.getElementById(`${key}-chart-container`);
            if (container) {
                container.addEventListener('timeRangeChanged', (e: any) => {
                    const range = e.detail.range;
                    const province = UI.provinceSelect.value || "กรุงเทพมหานคร";
                    const data = historicalDataStore.get(province) || [];
                    chart.render(data);
                });
            }
        });

        initializeHumidityTrendCharts();

        createToast("Chart visualization system initialized", "success");
    } catch (error) {
        console.error("Failed to initialize charts:", error);
        createToast("Chart initialization failed", "alert");
    }
}

function initializeChartsView(): void {
    try {
        // Initialize Radar Chart
        radarChart = new RadarChartComponent(
            { 
                containerId: 'radar-chart-container', 
                canvasId: 'radar-chart-canvas',
                title: '6-Hazard Overview',
                showExport: true
            }
        );
        chartManager.registerComponent('radar', radarChart);

        // Initialize Heatmap
        const provinces = Object.keys(PROVINCES_MAP);
        const initialHazardLevels = provinces.map(() => Math.random() * 30);
        heatmapChart = new HeatmapComponent(
            { 
                containerId: 'heatmap-chart-container', 
                canvasId: 'heatmap-chart-canvas',
                title: 'Province Hazard Levels',
                showExport: true
            },
            provinces,
            initialHazardLevels
        );
        chartManager.registerComponent('heatmap', heatmapChart);

        // Initialize Gauge Charts
        gaugeUV = new GaugeChartComponent(
            { 
                containerId: 'gauge-uv-container', 
                canvasId: 'gauge-uv-canvas',
                title: 'UV Index Gauge'
            },
            15,
            '#00f3ff',
            ''
        );
        chartManager.registerComponent('gauge-uv', gaugeUV);

        gaugeHeat = new GaugeChartComponent(
            { 
                containerId: 'gauge-heat-container', 
                canvasId: 'gauge-heat-canvas',
                title: 'Heat Index Gauge'
            },
            50,
            '#ff0055',
            '°C'
        );
        chartManager.registerComponent('gauge-heat', gaugeHeat);

        gaugeWind = new GaugeChartComponent(
            { 
                containerId: 'gauge-wind-container', 
                canvasId: 'gauge-wind-canvas',
                title: 'Wind Gusts Gauge'
            },
            100,
            '#3b82f6',
            ' km/h'
        );
        chartManager.registerComponent('gauge-wind', gaugeWind);

        createToast("Advanced charts view initialized", "success");
    } catch (error) {
        console.error("Failed to initialize charts view:", error);
        createToast("Charts view initialization failed", "alert");
    }
}

// Hook into view switching to initialize charts view when needed
const originalSwitchView = (window as any).switchView || switchView;
(window as any).switchView = (view: string) => {
    originalSwitchView(view);
    
    if (view === 'charts' && !radarChart) {
        initializeChartsView();
    }
};

// Update charts with new data
function updateCharts(data: HazardData, province: string): void {
    if (!historicalDataStore.has(province)) {
        historicalDataStore.set(province, []);
    }
    
    const provinceHistory = historicalDataStore.get(province)!;
    const previous = provinceHistory[provinceHistory.length - 1];
    const valuesChanged = !previous || Object.keys(data).some((key) =>
        !Object.is((data as any)[key], (previous.data as any)[key])
    );

    if (valuesChanged) {
        const sourceTime = (data as any).time ?? (data as any).timestamp;
        const parsedSourceTime = sourceTime ? new Date(sourceTime) : new Date();
        provinceHistory.push({
            timestamp: Number.isFinite(parsedSourceTime.getTime()) ? parsedSourceTime : new Date(),
            province,
            data: { ...data }
        });

        if (provinceHistory.length > MAX_CHART_POINTS_PER_PROVINCE) {
            provinceHistory.splice(0, provinceHistory.length - MAX_CHART_POINTS_PER_PROVINCE);
        }
        persistHistoricalData();
    }

    // Update sparklines
    const uvHistory = provinceHistory.map(d => d.data.uv_index);
    const heatHistory = provinceHistory.map(d => d.data.apparent_temperature);
    const windHistory = provinceHistory.map(d => d.data.wind_gusts_10m);
    const rainHistory = provinceHistory.map(d => d.data.precipitation);
    const riverHistory = provinceHistory.map(d => d.data.river_discharge);

    sparklineUV?.render(uvHistory);
    sparklineHeat?.render(heatHistory);
    sparklineWind?.render(windHistory);
    sparklineRain?.render(rainHistory);
    sparklineRiver?.render(riverHistory);

    // Update time series charts if analytics view is active
    timeSeriesCharts.forEach((chart) => {
        chart.render(provinceHistory);
    });

    if (humidityHistoryChart) {
        const humidityValues = provinceHistory.map(item => Number(item.data.relative_humidity_2m ?? 0));
        const labels = provinceHistory.map(item => item.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
        humidityHistoryChart.data.labels = labels;
        humidityHistoryChart.data.datasets[0].data = humidityValues;
        humidityHistoryChart.update();
    }

    if (dewHistoryChart) {
        const dewValues = provinceHistory.map((item) => {
            const tempC = Number(item.data.temperature_2m ?? item.data.apparent_temperature ?? 0);
            const humidity = Number(item.data.relative_humidity_2m ?? 0);
            if (!Number.isFinite(tempC) || !Number.isFinite(humidity)) return 0;
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
            return (b * alpha) / (a - alpha);
        });
        const labels = provinceHistory.map(item => item.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
        dewHistoryChart.data.labels = labels;
        dewHistoryChart.data.datasets[0].data = dewValues;
        dewHistoryChart.update();
    }

    // Update radar chart if charts view is active
    if (radarChart) {
        radarChart.render(data);
    }

    // Update gauges if charts view is active
    if (gaugeUV) gaugeUV.render(data.uv_index);
    if (gaugeHeat) gaugeHeat.render(data.apparent_temperature);
    if (gaugeWind) gaugeWind.render(data.wind_gusts_10m);

    // Update heatmap with simulated hazard levels
    if (heatmapChart) {
        const hazardLevels = Object.keys(PROVINCES_MAP).map(() => {
            const maxHazard = Math.max(
                data.uv_index / 15,
                data.apparent_temperature / 50,
                data.wind_gusts_10m / 100,
                data.precipitation / 50,
                data.river_discharge / 700
            );
            return maxHazard * 100;
        });
        heatmapChart.render(hazardLevels);
    }
}

/**
 * Update connection status UI indicators
 */
function updateConnectionStatusUI(mode: CommunicationMode): void {
    const statusElement = document.getElementById('connectionStatus');
    const modeElement = document.getElementById('connectionMode');
    
    if (statusElement && modeElement) {
        if (mode === CommunicationMode.WEBSOCKET) {
            statusElement.textContent = '● Connected';
            statusElement.style.color = '#22c55e';
            modeElement.textContent = 'WebSocket (Real-time)';
            modeElement.style.color = '#22c55e';
        } else if (mode === CommunicationMode.FIREBASE) {
            statusElement.textContent = '● Fallback';
            statusElement.style.color = '#f59e0b';
            modeElement.textContent = 'Firebase (Polling)';
            modeElement.style.color = '#f59e0b';
        } else {
            statusElement.textContent = '● Hybrid';
            statusElement.style.color = '#3b82f6';
            modeElement.textContent = 'Hybrid Mode';
            modeElement.style.color = '#3b82f6';
        }
    }
}
