import './style.css';
import './ui.css';
import './editorial.css';
import Chart from 'chart.js/auto';
import { initializeFirebase, requestEsp32Announcement } from './firebase_client';
import { initializeIndoorHome } from './smart_home/indoor_home';
import { initElectricityCalculator } from './electricity_calculator';
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
    speakAiDepartureAdvice,
    playStudioVoice,
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
    TimeSeriesChartComponent,
    SparklineComponent,
    chartManager
} from './chart_components';
import { type HazardData, type HistoricalDataPoint } from './charts';

// ============================================================================
// NEW ARCHITECTURE IMPORTS
// ============================================================================
import { store, actions, selectCurrentProvince, selectLanguage } from './store';
import { eventBus, eventFactory } from './event_bus';
import { logger, setupGlobalErrorHandlers } from './logger';
import { errorBoundary, injectErrorStyles, ErrorCategory } from './error_boundary';
import { validateUserInput } from './validators';

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

document.addEventListener('DOMContentLoaded', async () => {
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
            data as any,
            (data.severity || 'NORMAL') as any,
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
            const view = link.dataset.view as string;
            switchView(view);
            if (view === 'analytics') {
                const currentProv = UI.provinceSelect?.value || "กรุงเทพมหานคร";
                const history = historicalDataStore.get(currentProv) || [];
                timeSeriesCharts.forEach((chart) => {
                    chart.render(history);
                    chart.resize();
                });
            }
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

    UI.aiAdvisorSpeakBtn?.addEventListener('click', () => {
        speakAiDepartureAdvice();
        eventBus.publish(eventFactory.userAction('ai_advisor_speak'));
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

    (window as any).testVoice = async (voiceKey: string = 'STATUS') => {
        // 1. Play studio Thai voice immediately in browser/PC speakers
        const voiceFileMap: Record<string, string> = {
            'STATUS': '/audio/voices/voice_status_ok.wav',
            'NIGHT_WALK': '/audio/voices/voice_night_walk.wav',
            'BOOT': '/audio/voices/voice_boot.wav',
            'WIFI_OK': '/audio/voices/voice_wifi_ok.wav',
            'WIFI_LOST': '/audio/voices/voice_wifi_lost.wav',
            'DOOR_OPEN': '/audio/voices/voice_door_open.wav',
            'DOOR_LOCKED': '/audio/voices/voice_door_locked.wav',
            'HEAT': '/audio/voices/voice_heat_warn.wav',
            'RAIN': '/audio/voices/voice_rain_warn.wav',
            'SAFE_OUT': '/audio/voices/voice_safe_out.wav',
            'STORM': '/audio/voices/voice_storm_warn.wav',
            'FIRE': '/audio/voices/voice_fire_temp.wav',
            'FLOOD': '/audio/voices/voice_flood_warn.wav',
            'INTRUSION': '/audio/voices/voice_intrusion.wav',
            'NIGHT_MODE': '/audio/voices/voice_night_mode.wav',
            'DAY_MODE': '/audio/voices/voice_day_mode.wav',
        };
        const wavPath = voiceFileMap[voiceKey] || '/audio/voices/voice_status_ok.wav';
        try {
            const audio = new Audio(wavPath);
            audio.volume = 1.0;
            audio.play().catch(e => console.log('Audio autoplay policy:', e));
        } catch (e) {
            console.warn('Local audio playback error:', e);
        }

        // 2. Also send real-time command to physical ESP32 speaker via Firebase
        try {
            await requestEsp32Announcement(`ทดสอบเสียง ${voiceKey}`, voiceKey);
            createToast(`กำลังเล่นเสียง '${voiceKey}' บนเว็บและส่งสัญญาณไปยัง ESP32 แล้ว`, 'success');
        } catch (err: any) {
            console.warn('Firebase announcement error:', err);
        }
    };

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

            // Automatically voice through speakers only if explicit autoVoice requested (e.g. storage sync)
            if (shouldAutoVoice) {
                lastRenderedPnaMessage = rawMsg;
                broadcastVoicePrompt(rawMsg);
            }
        } catch {
            pnaTestAlert.hidden = true;
            pnaTestEmpty.hidden = false;
        }
    };

    renderPnaTestAlert(localStorage.getItem(PNA_TEST_ALERT_KEY));
    renderPnaTestHistory();

    const broadcastVoicePrompt = (text: string) => {
        const cleanText = (text || '').trim();
        if (!cleanText) return;

        let voiceKey: string | null = null;
        if (/ไฟ|ควัน|อุณหภูมิ/i.test(cleanText)) voiceKey = 'FIRE';
        else if (/น้ำ|ท่วม/i.test(cleanText)) voiceKey = 'FLOOD';
        else if (/พายุ|ลม/i.test(cleanText)) voiceKey = 'STORM';
        else if (/ฝน/i.test(cleanText)) voiceKey = 'RAIN';
        else if (/ร้อน|แดด/i.test(cleanText)) voiceKey = 'HEAT';
        else if (/ขโมย|บุกรุก|อันตราย|ผู้บุกรุก/i.test(cleanText)) voiceKey = 'INTRUSION';
        else if (/ไฟเปิด|ทางเดิน|สะดุด/i.test(cleanText)) voiceKey = 'NIGHT_WALK';
        else if (/ประตูเปิด/i.test(cleanText)) voiceKey = 'DOOR_OPEN';
        else if (/ประตูปิด/i.test(cleanText)) voiceKey = 'DOOR_LOCKED';
        else if (/ปกติ|เรียบร้อย|สถานะ/i.test(cleanText)) voiceKey = 'STATUS';

        if (voiceKey) {
            void playStudioVoice(voiceKey).then(() => {
                setTimeout(() => {
                    speakText(cleanText, 'TEST', false);
                }, 350);
            });
            void requestEsp32Announcement(cleanText, voiceKey);
        } else {
            // 1. Play official alert chime on browser (~650ms)
            void playAlertTone('official');
            // 2. Send Cloud TTS command to physical ESP32 speaker
            void requestEsp32Announcement(cleanText, 'CLOUD_TTS');
            // 3. Speak the exact typed message clearly through browser speaker
            setTimeout(() => {
                speakText(cleanText, 'TEST', false);
            }, 650);
        }
    };

    pnaTestSpeak?.addEventListener('click', () => {
        const message = pnaTestAlertMessage?.textContent?.trim();
        if (message) {
            broadcastVoicePrompt(message);
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

        // Render card visually without autoVoice collision
        renderPnaTestAlert(JSON.stringify(alert), false);
        createToast(`กระจายเสียงแจ้งเตือนออกลำโพงเรียบร้อย`, 'success');
        if (pnaQuickMessageInput) pnaQuickMessageInput.value = '';

        // Broadcast voice prompt once cleanly
        broadcastVoicePrompt(text);
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
    let lastIncomingNoticeSpokenAt = 0;
    const INCOMING_NOTICE_COOLDOWN_MS = 15 * 60 * 1000; // 15-minute cooldown between auto speech

    initializeOfficialAlerts((text) => {
        // Direct manual click announcement - always play tone & speak immediately!
        void playAlertTone('official');
        speakText(text, 'OFFICIAL', true);
    }, (text) => {
        // New incoming notices - automatically chime & announce ONLY if enabled and cooldown has passed
        const now = Date.now();
        if (isAutomaticSpeechEnabled() && (now - lastIncomingNoticeSpokenAt >= INCOMING_NOTICE_COOLDOWN_MS)) {
            lastIncomingNoticeSpokenAt = now;
            void playAlertTone('official');
            speakText(text, 'OFFICIAL', true);
        }
    });

    // 6. Initialize Charts System
    initializeCharts();
    const provinceForInitialWeather = UI.provinceSelect?.value || store.getState().weather.province || 'กรุงเทพมหานคร';
    const initialCachedHistory = historicalDataStore.get(provinceForInitialWeather) || [];
    if (initialCachedHistory.length > 0) {
        timeSeriesCharts.forEach((chart) => {
            chart.render(initialCachedHistory);
        });
    }

    // 7. Initial Weather Fetch (use the selected monitored province)
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
}

// Update charts with batch historical telemetry from Open-Meteo
function setHistoricalData(province: string, points: HistoricalDataPoint[]): void {
    if (!Array.isArray(points) || points.length === 0) return;
    
    // Seed historical data store with real chronological data
    historicalDataStore.set(province, points.slice(-MAX_CHART_POINTS_PER_PROVINCE));
    persistHistoricalData();

    const provinceHistory = historicalDataStore.get(province)!;

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

    // Update time series charts
    timeSeriesCharts.forEach((chart) => {
        chart.render(provinceHistory);
        chart.resize();
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
}

(window as any).updateCharts = updateCharts;
(window as any).setHistoricalData = setHistoricalData;

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
