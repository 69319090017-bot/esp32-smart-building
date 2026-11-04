import { translations } from './translations';
import { domBatcher } from './performance';
import { evaluateHumidityAlert } from './humidity_alert';
import { assessWeatherHazards } from './hazard_assessment';
import { buildWeatherNarration as createWeatherNarration } from './weather_narration';

export const PROVINCES_MAP: Record<string, { lat: number; lon: number; en: string }> = {
    "กรุงเทพมหานคร": { lat: 13.7563, lon: 100.5018, en: "Bangkok" },
    "นนทบุรี": { lat: 13.8591, lon: 100.5217, en: "Nonthaburi" },
    "ปทุมธานี": { lat: 14.0208, lon: 100.5250, en: "Pathum Thani" },
    "สมุทรปราการ": { lat: 13.5991, lon: 100.5968, en: "Samut Prakan" },
    "สมุทรสาคร": { lat: 13.5475, lon: 100.2744, en: "Samut Sakhon" },
    "สมุทรสงคราม": { lat: 13.4098, lon: 99.9994, en: "Samut Songkhram" },
    "นครปฐม": { lat: 13.8196, lon: 100.0443, en: "Nakhon Pathom" },
    "พระนครศรีอยุธยา": { lat: 14.3532, lon: 100.5684, en: "Ayutthaya" },
    "อ่างทอง": { lat: 14.5896, lon: 100.4550, en: "Ang Thong" },
    "ลพบุรี": { lat: 14.7995, lon: 100.6534, en: "Lopburi" },
    "สิงห์บุรี": { lat: 14.8911, lon: 100.4046, en: "Sing Buri" },
    "ชัยนาท": { lat: 15.1852, lon: 100.1252, en: "Chai Nat" },
    "สระบุรี": { lat: 14.5289, lon: 100.9108, en: "Saraburi" },
    "ชลบุรี": { lat: 13.3611, lon: 100.9847, en: "Chonburi" },
    "ระยอง": { lat: 12.6814, lon: 101.2816, en: "Rayong" },
    "จันทบุรี": { lat: 12.6114, lon: 102.1039, en: "Chanthaburi" },
    "ตราด": { lat: 12.2428, lon: 102.5170, en: "Trat" },
    "ฉะเชิงเทรา": { lat: 13.6904, lon: 101.0780, en: "Chachoengsao" },
    "ปราจีนบุรี": { lat: 14.0510, lon: 101.3725, en: "Prachinburi" },
    "นครนายก": { lat: 14.2069, lon: 101.2131, en: "Nakhon Nayok" },
    "สระแก้ว": { lat: 13.8140, lon: 102.0718, en: "Sa Kaeo" },
    "นครราชสีมา": { lat: 14.9799, lon: 102.0978, en: "Nakhon Ratchasima" },
    "บุรีรัมย์": { lat: 14.9930, lon: 103.1029, en: "Buriram" },
    "สุรินทร์": { lat: 14.8818, lon: 103.4936, en: "Surin" },
    "ศรีสะเกษ": { lat: 15.1186, lon: 104.3220, en: "Sisaket" },
    "อุบลราชธานี": { lat: 15.2448, lon: 104.8473, en: "Ubon Ratchathani" },
    "ยโสธร": { lat: 15.7926, lon: 104.1451, en: "Yasothon" },
    "ชัยภูมิ": { lat: 15.8063, lon: 102.0315, en: "Chaiyaphum" },
    "อำนาจเจริญ": { lat: 15.8584, lon: 104.6258, en: "Amnat Charoen" },
    "บึงกาฬ": { lat: 18.3609, lon: 103.6465, en: "Bueng Kan" },
    "หนองบัวลำภู": { lat: 17.2034, lon: 102.4407, en: "Nong Bua Lamphu" },
    "ขอนแก่น": { lat: 16.4419, lon: 102.8359, en: "Khon Kaen" },
    "อุดรธานี": { lat: 17.4138, lon: 102.7872, en: "Udon Thani" },
    "เลย": { lat: 17.4860, lon: 101.7223, en: "Loei" },
    "หนองคาย": { lat: 17.8783, lon: 102.7420, en: "Nong Khai" },
    "มหาสารคาม": { lat: 16.1850, lon: 103.3007, en: "Maha Sarakham" },
    "ร้อยเอ็ด": { lat: 16.0538, lon: 103.6520, en: "Roi Et" },
    "กาฬสินธุ์": { lat: 16.4322, lon: 103.5066, en: "Kalasin" },
    "สกลนคร": { lat: 17.1546, lon: 104.1486, en: "Sakon Nakhon" },
    "นครพนม": { lat: 17.3998, lon: 104.7695, en: "Nakhon Phanom" },
    "มุกดาหาร": { lat: 16.5436, lon: 104.7235, en: "Mukdahan" },
    "เชียงใหม่": { lat: 18.7883, lon: 98.9853, en: "Chiang Mai" },
    "ลำพูน": { lat: 18.5745, lon: 99.0087, en: "Lamphun" },
    "ลำปาง": { lat: 18.2888, lon: 99.4928, en: "Lampang" },
    "อุตรดิตถ์": { lat: 17.6201, lon: 100.0993, en: "Uttaradit" },
    "แพร่": { lat: 18.1446, lon: 100.1410, en: "Phrae" },
    "น่าน": { lat: 18.7838, lon: 100.7782, en: "Nan" },
    "พะเยา": { lat: 19.1664, lon: 99.9022, en: "Phayao" },
    "เชียงราย": { lat: 19.9072, lon: 99.8325, en: "Chiang Rai" },
    "แม่ฮ่องสอน": { lat: 19.3020, lon: 97.9654, en: "Mae Hong Son" },
    "นครสวรรค์": { lat: 15.7051, lon: 100.1378, en: "Nakhon Sawan" },
    "อุทัยธานี": { lat: 15.3835, lon: 100.0245, en: "Uthai Thani" },
    "กำแพงเพชร": { lat: 16.4828, lon: 99.5227, en: "Kamphaeng Phet" },
    "ตาก": { lat: 16.8839, lon: 99.1258, en: "Tak" },
    "สุโขทัย": { lat: 17.0056, lon: 99.8264, en: "Sukhothai" },
    "พิษณุโลก": { lat: 16.8211, lon: 100.2659, en: "Phitsanulok" },
    "พิจิตร": { lat: 16.4429, lon: 100.3490, en: "Phichit" },
    "เพชรบูรณ์": { lat: 16.4190, lon: 101.1561, en: "Phetchabun" },
    "สุพรรณบุรี": { lat: 14.4745, lon: 100.1177, en: "Suphan Buri" },
    "กาญจนบุรี": { lat: 14.0228, lon: 99.5328, en: "Kanchanaburi" },
    "ราชบุรี": { lat: 13.5360, lon: 99.8174, en: "Ratchaburi" },
    "เพชรบุรี": { lat: 13.1110, lon: 99.9398, en: "Phetchaburi" },
    "ประจวบคีรีขันธ์": { lat: 11.8124, lon: 99.7973, en: "Prachuap Khiri Khan" },
    "นครศรีธรรมราช": { lat: 8.4304, lon: 99.9631, en: "Nakhon Si Thammarat" },
    "กระบี่": { lat: 8.0863, lon: 98.9063, en: "Krabi" },
    "พังงา": { lat: 8.4501, lon: 98.5255, en: "Phang Nga" },
    "ภูเก็ต": { lat: 7.8804, lon: 98.3923, en: "Phuket" },
    "สุราษฎร์ธานี": { lat: 9.1382, lon: 99.3215, en: "Surat Thani" },
    "ระนอง": { lat: 9.9658, lon: 98.6348, en: "Ranong" },
    "ชุมพร": { lat: 10.4930, lon: 99.1800, en: "Chumphon" },
    "สงขลา": { lat: 7.1988, lon: 100.5954, en: "Songkhla" },
    "สตูล": { lat: 6.6238, lon: 100.0674, en: "Satun" },
    "ตรัง": { lat: 7.5563, lon: 99.6114, en: "Trang" },
    "พัทลุง": { lat: 7.6167, lon: 100.0740, en: "Phatthalung" },
    "ปัตตานี": { lat: 6.8696, lon: 101.2501, en: "Pattani" },
    "ยะลา": { lat: 6.5411, lon: 101.2813, en: "Yala" },
    "นราธิวาส": { lat: 6.4255, lon: 101.8253, en: "Narathiwat" }
};

export const UI = {
    navLinks: document.querySelectorAll('.nav-link') as NodeListOf<HTMLElement>,
    views: document.querySelectorAll('.view-section') as NodeListOf<HTMLElement>,
    provinceSelect: document.getElementById('provinceSelect') as HTMLSelectElement,
    coordsDisplay: document.getElementById('coordsDisplay') as HTMLElement,
    highestThreatBadge: document.getElementById('highestThreatText') as HTMLElement,
    alertBanner: document.getElementById('alertBanner') as HTMLElement,
    alertBannerTitle: document.getElementById('alertBannerTitle') as HTMLElement,
    alertBannerMsg: document.getElementById('alertBannerMsg') as HTMLElement,
    speakAlertBtn: document.getElementById('speakAlertBtn') as HTMLButtonElement,
    ttsText: document.getElementById('ttsText') as HTMLTextAreaElement,
    ttsSpeakBtn: document.getElementById('ttsSpeakBtn') as HTMLButtonElement,
    ttsStopBtn: document.getElementById('ttsStopBtn') as HTMLButtonElement,
    ttsStatus: document.getElementById('ttsStatus') as HTMLElement,
    weatherSpeakBtn: document.getElementById('weatherSpeakBtn') as HTMLButtonElement,
    weatherRepeatBtn: document.getElementById('weatherRepeatBtn') as HTMLButtonElement,
    enableSpeechBtn: document.getElementById('enableSpeechBtn') as HTMLButtonElement,
    actionDelaySelect: document.getElementById('actionDelaySelect') as HTMLSelectElement,
    actionEffectSelect: document.getElementById('actionEffectSelect') as HTMLSelectElement,

    // Telemetry display elements
    uptimeDisplay: document.getElementById('uptimeDisplay') as HTMLElement,
    lastUpdateDisplay: document.getElementById('lastUpdateDisplay') as HTMLElement,
    firmwareDisplay: document.getElementById('firmwareDisplay') as HTMLElement,

    uvValue: document.getElementById('uvValue') as HTMLElement,
    uvBar: document.getElementById('uvGaugeArc') as HTMLElement,
    uvRiskBadge: document.getElementById('uvRiskBadge') as HTMLElement,
    uvForecastText: document.getElementById('uvForecastText') as HTMLElement,

    humidityValue: document.getElementById('humidityValue') as HTMLElement,
    humidityRiskBadge: document.getElementById('humidityRiskBadge') as HTMLElement,
    humidityStatusText: document.getElementById('humidityStatusText') as HTMLElement,
    humidityDewPointValue: document.getElementById('humidityDewPointValue') as HTMLElement,
    humidityDetailSection: document.getElementById('humidityDetailPage') as HTMLElement,
    humidityDetailBtn: document.getElementById('humidityDetailBtn') as HTMLButtonElement,
    humidityDetailValue: document.getElementById('humidityDetailValue') as HTMLElement,
    humidityDetailDew: document.getElementById('humidityDetailDew') as HTMLElement,
    humidityDetailComfort: document.getElementById('humidityDetailComfort') as HTMLElement,
    humidityDetailStatus: document.getElementById('humidityDetailStatus') as HTMLElement,
    humidityDetailAdvice: document.getElementById('humidityDetailAdvice') as HTMLElement,

    departureStatusPill: document.getElementById('departureStatusPill') as HTMLElement,
    departureAirValue: document.getElementById('departureAirValue') as HTMLElement,
    departureAirText: document.getElementById('departureAirText') as HTMLElement,
    departureRainValue: document.getElementById('departureRainValue') as HTMLElement,
    departureRainText: document.getElementById('departureRainText') as HTMLElement,
    departureWindValue: document.getElementById('departureWindValue') as HTMLElement,
    departureWindText: document.getElementById('departureWindText') as HTMLElement,
    departureActionValue: document.getElementById('departureActionValue') as HTMLElement,
    departureActionText: document.getElementById('departureActionText') as HTMLElement,
    outdoorSummaryText: document.getElementById('outdoorSummaryText') as HTMLElement,
    outdoorActionText: document.getElementById('outdoorActionText') as HTMLElement,

    heatValue: document.getElementById('heatValue') as HTMLElement,
    airTempValue: document.getElementById('airTempValue') as HTMLElement,
    heatBar: document.getElementById('heatGaugeArc') as HTMLElement,
    heatRiskBadge: document.getElementById('heatRiskBadge') as HTMLElement,
    heatDewPointValue: document.getElementById('heatDewPointValue') as HTMLElement,
    heatForecastText: document.getElementById('heatForecastText') as HTMLElement,

    wmoCodeBadge: document.getElementById('wmoCodeBadge') as HTMLElement,
    wmoDescText: document.getElementById('wmoDescText') as HTMLElement,

    gustValue: document.getElementById('gustValue') as HTMLElement,
    gustBar: document.getElementById('gustBar') as HTMLElement,
    windSpeedValue: document.getElementById('windSpeedValue') as HTMLElement,
    gustRiskBadge: document.getElementById('gustRiskBadge') as HTMLElement,

    rainValue: document.getElementById('rainValue') as HTMLElement,
    rainBar: document.getElementById('rainBar') as HTMLElement,
    rainRiskBadge: document.getElementById('rainRiskBadge') as HTMLElement,

    riverValue: document.getElementById('riverValue') as HTMLElement,
    riverRiskBadge: document.getElementById('riverRiskBadge') as HTMLElement,

    // Relays
    strobeStatusPill: document.getElementById('strobeStatusPill') as HTMLElement,
    doorStatusPill: document.getElementById('doorStatusPill') as HTMLElement,
    sirenStatusPill: document.getElementById('sirenStatusPill') as HTMLElement,

    toggleStrobeBtn: document.getElementById('toggleStrobeBtn') as HTMLButtonElement,
    toggleDoorBtn: document.getElementById('toggleDoorBtn') as HTMLButtonElement,
    silenceAudioBtn: document.getElementById('silenceAudioBtn') as HTMLButtonElement,
    testAudioBtn: document.getElementById('testAudioBtn') as HTMLButtonElement,
    testTelegramBtn: document.getElementById('testTelegramBtn') as HTMLButtonElement,
    exportCsvBtn: document.getElementById('exportCsvBtn') as HTMLButtonElement,

    historyTableBody: document.getElementById('historyTableBody') as HTMLElement,
    toastContainer: document.getElementById('toastContainer') as HTMLElement,
    langToggleBtn: document.getElementById('langToggleBtn') as HTMLButtonElement,
};

export let historyLogs: any[] = [];
const MAX_HISTORY_LOGS = 50; // Limit history logs to prevent memory issues
const HISTORY_LOG_INTERVAL_MS = 5 * 60 * 1000; // Record history at 5-minute intervals
let currentLang = localStorage.getItem('sbc_lang') || 'th';
let lastSpokenAlertKey = '';
let lastHistoryRecordAt = 0;
let automaticSpeechEnabled = localStorage.getItem('sbc_auto_speech_enabled') !== 'false';
let latestWeatherNarration = 'ขณะนี้ไม่มีข้อมูลล่าสุด จึงยังสรุปคำแนะนำตามสภาพอากาศไม่ได้';
// Thailand may receive hourly/interpolated Open-Meteo data; allow one hour plus a 30-minute delivery margin.
const WEATHER_MAX_AGE_MINUTES = 90;

export const t = (key: string) => translations[currentLang]?.[key] || key;

const speakAlertIfNeeded = (severity: 'NORMAL' | 'WARNING' | 'CRITICAL', message: string) => {
    if (!automaticSpeechEnabled || severity === 'NORMAL') return;
    const key = `${severity}:${message}`;
    if (lastSpokenAlertKey === key) return;
    lastSpokenAlertKey = key;
    void playAlertTone('weather');
    setTimeout(() => {
        speakText(message);
    }, 550);
};

export const applyLanguage = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (k && translations[currentLang]?.[k]) {
            el.textContent = translations[currentLang][k];
        }
    });
};

export const toggleLanguage = () => {
    currentLang = currentLang === 'en' ? 'th' : 'en';
    localStorage.setItem('sbc_lang', currentLang);
    applyLanguage();
};

export const populateProvinces = (currentProvince = "กรุงเทพมหานคร") => {
    if (!UI.provinceSelect) return;
    
    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    UI.provinceSelect.innerHTML = '';
    
    for (const [nameTh, info] of Object.entries(PROVINCES_MAP)) {
        const opt = document.createElement('option');
        opt.value = nameTh;
        opt.textContent = `${nameTh} (${info.en})`;
        if (nameTh === currentProvince) opt.selected = true;
        fragment.appendChild(opt);
    }
    
    // Single DOM operation
    UI.provinceSelect.appendChild(fragment);
};

export const switchView = (targetView: string) => {
    UI.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === targetView));
    UI.views.forEach(v => v.classList.toggle('active', v.id === `view-${targetView}`));
};

export const toggleHumidityDetailView = (forceOpen?: boolean) => {
    if (!UI.humidityDetailSection) return;
    const shouldShow = typeof forceOpen === 'boolean' ? forceOpen : UI.humidityDetailSection.classList.contains('hidden');
    UI.humidityDetailSection.classList.toggle('hidden', !shouldShow);
};

export const createToast = (msg: string, type: 'info' | 'success' | 'alert' = 'info') => {
    if (!UI.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span style="font-weight:600;">${type === 'alert' ? '🚨' : (type === 'success' ? '✅' : 'ℹ️')}</span> <span>${msg}</span>`;
    UI.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);

    // Speak alert toasts automatically through device speaker
    if (type === 'alert' && automaticSpeechEnabled && !isAudioMuted()) {
        void playAlertTone('weather');
        setTimeout(() => {
            speakText(msg);
        }, 550);
    }
};

const getActionEffectLabel = (effect: string) => {
    const labels: Record<string, string> = {
        none: 'ไม่มีเอฟเฟกต์',
        pulse: 'Pulse',
        flash: 'Flash',
        siren: 'Siren',
        burst: 'Burst'
    };
    return labels[effect] || 'Pulse';
};

export const triggerActionWithOptions = (callback: () => void, target?: HTMLElement, label = 'action') => {
    const delayValue = Number(UI.actionDelaySelect?.value || 0);
    const effectValue = UI.actionEffectSelect?.value || 'pulse';
    const delayMs = delayValue * 1000;

    const run = () => {
        callback();

        if (!target) return;
        const effectClassMap: Record<string, string> = {
            none: 'trigger-effect-none',
            pulse: 'trigger-effect-pulse',
            flash: 'trigger-effect-flash',
            siren: 'trigger-effect-siren',
            burst: 'trigger-effect-burst'
        };

        const className = effectClassMap[effectValue] || 'trigger-effect-pulse';
        target.classList.remove(
            'trigger-effect-none',
            'trigger-effect-pulse',
            'trigger-effect-flash',
            'trigger-effect-siren',
            'trigger-effect-burst'
        );
        void target.offsetWidth;
        target.classList.add(className);
        setTimeout(() => target.classList.remove(className), 500);
    };

    if (delayMs > 0) {
        createToast(`กำหนด ${label} ใน ${delayValue} วินาที • ${getActionEffectLabel(effectValue)}`, 'info');
        setTimeout(run, delayMs);
        return;
    }

    createToast(`${label} • ${getActionEffectLabel(effectValue)}`, 'info');
    run();
};

let lastWeatherSpeechKey: string | null = null;

const isAudioMuted = () => Boolean((window as any)?.audioMuted);
const SPEECH_RATE_STORAGE_KEY = 'sbc_thai_speech_rate_v1';
const ALERT_TONE_VOLUME_KEY = 'sbc_alert_tone_volume_v1';
const ALLOWED_SPEECH_RATES = [0.7, 0.75, 0.85, 0.95];
const DEFAULT_SPEECH_RATE = 0.85;
const DEFAULT_ALERT_TONE_VOLUME = 0.8;
const MAX_SPEECH_CHUNK_LENGTH = 110;
let speechPauseTimer: number | null = null;
let currentSpeechRate = DEFAULT_SPEECH_RATE;
let speechSequence = 0;
let alertAudioContext: AudioContext | null = null;

const getAlertAudioContext = () => {
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!alertAudioContext) alertAudioContext = new AudioContextConstructor();
    return alertAudioContext;
};

export const getAlertToneVolume = () => {
    try {
        const saved = Number(localStorage.getItem(ALERT_TONE_VOLUME_KEY));
        return Number.isFinite(saved) ? Math.max(0.1, Math.min(1, saved)) : DEFAULT_ALERT_TONE_VOLUME;
    } catch {
        return DEFAULT_ALERT_TONE_VOLUME;
    }
};

export const setAlertToneVolume = (volume: number) => {
    if (!Number.isFinite(volume)) return false;
    const clamped = Math.max(0.1, Math.min(1, volume));
    try { localStorage.setItem(ALERT_TONE_VOLUME_KEY, String(clamped)); } catch { /* Keep this page's value. */ }
    return true;
};

export const playAlertTone = async (kind: 'official' | 'weather') => {
    if (isAudioMuted()) return;
    const context = getAlertAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
        try { await context.resume(); } catch { return; }
    }
    const volume = getAlertToneVolume();
    const notes = kind === 'official'
        ? [{ frequency: 1046, at: 0 }, { frequency: 784, at: 0.2 }, { frequency: 1046, at: 0.46 }]
        : [{ frequency: 740, at: 0 }, { frequency: 740, at: 0.34 }];
    const now = context.currentTime;
    for (const note of notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + note.at;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(volume * 0.65, start + 0.025);
        gain.gain.setValueAtTime(volume * 0.65, start + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.2);
    }
};

export const getSpeechRate = () => {
    try {
        const savedRate = Number(localStorage.getItem(SPEECH_RATE_STORAGE_KEY));
        currentSpeechRate = ALLOWED_SPEECH_RATES.includes(savedRate) ? savedRate : currentSpeechRate;
        return currentSpeechRate;
    } catch {
        return currentSpeechRate;
    }
};

export const setSpeechRate = (rate: number) => {
    if (!ALLOWED_SPEECH_RATES.includes(rate)) return false;
    currentSpeechRate = rate;
    try {
        localStorage.setItem(SPEECH_RATE_STORAGE_KEY, String(rate));
    } catch {
        // Keep the selected speed for this page even if storage is unavailable.
    }
    return true;
};

const getPreferredVoice = (text: string) => {
    if (!('speechSynthesis' in window)) return null;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const isThai = /[\u0E00-\u0E7F]/.test(text || '');
    if (isThai) {
        return getThaiVoice();
    }
    return voices.find((voice: any) => (voice?.lang || '').toLowerCase().startsWith('en')) || null;
};

const getThaiVoice = () => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    return voices.find((voice: any) => (voice?.lang || '').toLowerCase().startsWith('th'))
        || voices.find((voice: any) => /thai|ไทย/i.test(voice?.name || ''))
        || voices.find((voice: any) => (voice?.lang || '').toLowerCase() === 'th-th')
        || null;
};

export const enableAutomaticSpeech = () => {
    if (!('speechSynthesis' in window)) {
        if (UI.ttsStatus) UI.ttsStatus.textContent = 'เบราว์เซอร์นี้ไม่รองรับเสียงพูด';
        return false;
    }
    automaticSpeechEnabled = true;
    try {
        localStorage.setItem('sbc_auto_speech_enabled', 'true');
    } catch { /* storage unavailable */ }
    const audioContext = getAlertAudioContext();
    if (audioContext?.state === 'suspended') void audioContext.resume();
    if (UI.enableSpeechBtn) UI.enableSpeechBtn.textContent = '🔊 เปิดเสียงแจ้งเตือนแล้ว';
    if (UI.ttsStatus) UI.ttsStatus.textContent = 'เปิดเสียงแจ้งเตือนแล้ว ระบบจะส่งเสียงประกาศออกลำโพงทันที';
    return true;
};

export const isAutomaticSpeechEnabled = () => automaticSpeechEnabled;

export const speakWeatherSummary = () => speakText(latestWeatherNarration);

if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        if (getThaiVoice() && UI.ttsStatus?.textContent?.includes('ไม่พบเสียงภาษาไทย')) {
            UI.ttsStatus.textContent = 'พบเสียงภาษาไทยแล้ว กดปุ่มเปิดเสียงแจ้งเตือนเพื่อใช้งาน';
        }
    });
}

const speechQueue: string[] = [];

const splitLongSpeechSegment = (segment: string) => {
    const Segmenter = (Intl as any).Segmenter;
    const pieces: string[] = typeof Segmenter === 'function'
        ? Array.from(new Segmenter('th', { granularity: 'word' }).segment(segment), (part: any) => part.segment)
        : segment.split(/(?<=\s)/);
    const chunks: string[] = [];
    let current = '';
    for (const piece of pieces) {
        if (current.length + piece.length > MAX_SPEECH_CHUNK_LENGTH && current.trim()) {
            chunks.push(current.trim());
            current = '';
        }
        current += piece;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [segment];
};

const speakNextQueueItem = (sequenceId = speechSequence) => {
    if (sequenceId !== speechSequence) return;
    const nextText = speechQueue.shift();
    if (!nextText) {
        if (UI.ttsStatus) UI.ttsStatus.textContent = 'พร้อมพูด';
        return;
    }

    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(nextText);
    const containsThai = /[\u0E00-\u0E7F]/.test(nextText);
    const preferredVoice = getPreferredVoice(nextText);
    utterance.lang = containsThai ? 'th-TH' : 'en-US';
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    utterance.rate = containsThai ? getSpeechRate() : 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onend = () => {
        if (sequenceId !== speechSequence) return;
        if (speechQueue.length > 0) {
            speechPauseTimer = window.setTimeout(() => {
                speechPauseTimer = null;
                speakNextQueueItem(sequenceId);
            }, 300);
            return;
        }
        if (UI.ttsStatus) UI.ttsStatus.textContent = 'พร้อมพูด';
    };
    utterance.onerror = () => {
        if (sequenceId !== speechSequence) return;
        if (speechQueue.length > 0) {
            speakNextQueueItem(sequenceId);
            return;
        }
        if (UI.ttsStatus) UI.ttsStatus.textContent = 'เกิดข้อผิดพลาดในการพูด';
    };

    if (UI.ttsStatus) UI.ttsStatus.textContent = 'กำลังพูด...';
    window.speechSynthesis.speak(utterance);
};

export const speakText = (text: string) => {
    const cleanText = text?.trim();
    if (!cleanText || isAudioMuted()) return;
    if (!('speechSynthesis' in window)) return;

    // Wake up AudioContext on user action so speaker is active
    const audioContext = getAlertAudioContext();
    if (audioContext?.state === 'suspended') void audioContext.resume();

    if (speechPauseTimer !== null) {
        window.clearTimeout(speechPauseTimer);
        speechPauseTimer = null;
    }
    const sequenceId = ++speechSequence;
    window.speechSynthesis.cancel();
    speechQueue.length = 0;

    const normalizedSegments = cleanText
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+|\n+/)
        .map(segment => segment.trim())
        .filter(Boolean);

    const finalSegments = normalizedSegments.length > 1
        ? normalizedSegments
        : [cleanText];

    const chunks: string[] = [];
    for (const segment of finalSegments) {
        if (segment.length <= MAX_SPEECH_CHUNK_LENGTH) {
            chunks.push(segment);
            continue;
        }
        chunks.push(...splitLongSpeechSegment(segment));
    }

    if (chunks.length > 0) {
        speechQueue.push(...chunks);
        window.setTimeout(() => {
            speakNextQueueItem(sequenceId);
        }, 15);
    }
};

export const stopSpeech = () => {
    speechSequence += 1;
    if (speechPauseTimer !== null) {
        window.clearTimeout(speechPauseTimer);
        speechPauseTimer = null;
    }
    speechQueue.length = 0;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    if (UI.ttsStatus) {
        UI.ttsStatus.textContent = 'หยุดการพูดแล้ว';
    }
};

export const speakTextWithStatus = (text: string) => {
    const cleanText = text?.trim();
    if (!cleanText) {
        if (UI.ttsStatus) UI.ttsStatus.textContent = 'กรุณาพิมพ์ข้อความก่อน';
        return;
    }
    speakText(cleanText);
};

export const getWmoDescription = (code: number): string => {
    switch (code) {
        case 0: return "ท้องฟ้าแจ่มใส (Clear Sky)";
        case 1: return "ท้องฟ้าโปร่ง (Mainly Clear)";
        case 2: return "มีเมฆบางส่วน (Partly Cloudy)";
        case 3: return "มีเมฆมาก (Overcast)";
        case 45: return "หมอกหนา (Fog)";
        case 51: case 53: case 55: return "ฝนละออง (Drizzle)";
        case 61: return "ฝนตกเล็กน้อย (Slight Rain)";
        case 63: return "ฝนตกปานกลาง (Moderate Rain)";
        case 65: return "ฝนตกหนัก (Heavy Rain)";
        case 80: case 81: case 82: return "ฝนซู่ตกกระจาย (Rain Showers)";
        case 95: return "พายุฝนฟ้าคะนอง (Thunderstorm)";
        case 96: case 99: return "พายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ (Severe Hailstorm)";
        default: return "สภาพอากาศแปรปรวน";
    }
};

const calculateDewPoint = (tempC: number, humidity: number): number => {
    if (!Number.isFinite(tempC) || !Number.isFinite(humidity) || humidity <= 0 || humidity > 100) return NaN;
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
};

const readMetric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : NaN;
const formatMetric = (value: number, digits = 1): string => Number.isFinite(value) ? value.toFixed(digits) : 'ไม่มีข้อมูล';

const getWeatherForecastSummary = (tempC: number, humidity: number, gustKmh: number, rainMm: number, uvIndex: number, weatherCode: number): string => {
    const assessment = assessWeatherHazards({
        temperature_2m: tempC,
        relative_humidity_2m: humidity,
        wind_gusts_10m: gustKmh,
        precipitation: rainMm,
        uv_index: uvIndex,
        weather_code: weatherCode,
    });
    const priority = ['very-dangerous', 'danger', 'warning', 'watch'];
    for (const band of priority) {
        const finding = assessment.findings.find(item => item.band === band);
        if (finding) return `${finding.title}: ${finding.meaning}`;
    }
    return 'ยังไม่พบเกณฑ์เตือนจากข้อมูลที่มี; ตรวจเวลาและแหล่งข้อมูลก่อนใช้ตัดสินใจ';
};

const updateHumidityDetailPanel = (humidity: number, dewPoint: number, comfortText: string, statusText: string, adviceText: string) => {
    if (!UI.humidityDetailValue && !UI.humidityDetailDew && !UI.humidityDetailComfort && !UI.humidityDetailStatus && !UI.humidityDetailAdvice) return;

    if (UI.humidityDetailValue) UI.humidityDetailValue.textContent = Number.isFinite(humidity) ? `${humidity.toFixed(0)}%` : 'ไม่มีข้อมูล';
    if (UI.humidityDetailDew) UI.humidityDetailDew.textContent = Number.isFinite(dewPoint) ? `${dewPoint.toFixed(1)}°C` : 'ไม่มีข้อมูล';
    if (UI.humidityDetailComfort) UI.humidityDetailComfort.textContent = comfortText;
    if (UI.humidityDetailStatus) UI.humidityDetailStatus.textContent = statusText;
    if (UI.humidityDetailAdvice) UI.humidityDetailAdvice.textContent = adviceText;
};

export const buildOutdoorReadinessSummary = (tempC: number, humidity: number, dewPointC: number, rainMm: number, gustKmh: number, uvIndex: number, weatherCode: number) => {
    void dewPointC; // Kept for existing callers; dew point has no cited danger threshold here.
    const assessment = assessWeatherHazards({ temperature_2m: tempC, relative_humidity_2m: humidity, precipitation: rainMm, wind_gusts_10m: gustKmh, uv_index: uvIndex, weather_code: weatherCode });
    const relevant = assessment.findings.filter(item => ['heat', 'uv', 'rain', 'storm'].includes(item.id));
    const riskFlags = relevant.filter(item => ['watch', 'warning', 'danger', 'very-dangerous'].includes(item.band)).map(item => item.title);
    const missingCoreData = relevant.some(item => item.band === 'unknown');
    const dangerous = relevant.some(item => item.band === 'danger' || item.band === 'very-dangerous');
    const hasWarning = relevant.some(item => item.band === 'watch' || item.band === 'warning');
    const status: 'READY' | 'CAUTION' | 'NOT READY' = dangerous ? 'NOT READY' : hasWarning || missingCoreData ? 'CAUTION' : 'READY';
    const summary = missingCoreData
        ? 'ข้อมูลบางรายการไม่ครบ จึงสรุปว่าปลอดภัยไม่ได้ โปรดตรวจข้อมูลและประกาศทางการก่อนออกเดินทาง'
        : riskFlags.length
            ? `พบปัจจัยที่ควรระวัง: ${riskFlags.slice(0, 3).join(', ')} โปรดอ่านคำแนะนำและติดตามประกาศทางการ`
            : 'ยังไม่พบเกณฑ์เตือนจากข้อมูลที่มี ซึ่งไม่ใช่การยืนยันว่าปลอดภัยจากทุกอันตราย';
    const decision = dangerous ? 'ควรหลีกเลี่ยงกิจกรรมกลางแจ้ง' : hasWarning || missingCoreData ? 'ตรวจคำแนะนำและประกาศทางการก่อนเดินทาง' : 'ยังไม่พบเกณฑ์เตือนในข้อมูลนี้';
    const action = dangerous ? 'ลดกิจกรรมกลางแจ้งและไปอยู่ในที่ปลอดภัยตามชนิดความเสี่ยง' : 'ตรวจอายุข้อมูลและประกาศทางการก่อนออกจากบ้าน';
    return { status, summary, action, decision, riskFlags };
};

const getDepartureReadiness = (tempC: number, humidity: number, rainMm: number, gustKmh: number, uvIndex: number, weatherCode: number) => {
    const result = buildOutdoorReadinessSummary(tempC, humidity, NaN, rainMm, gustKmh, uvIndex, weatherCode);
    return {
        label: result.status === 'READY' ? 'ไม่พบเกณฑ์เตือน' : result.status,
        className: result.status === 'NOT READY' ? 'status-critical' : result.status === 'CAUTION' ? 'status-warn' : 'status-good',
        airText: Number.isFinite(tempC) && Number.isFinite(humidity) ? 'ประเมินความร้อนจากอุณหภูมิและความชื้น' : 'ไม่มีข้อมูลพอประเมินความร้อน',
        rainText: Number.isFinite(rainMm) ? `${rainMm.toFixed(1)} มม. ในชั่วโมงก่อนหน้า` : 'ไม่มีข้อมูลฝน',
        windText: Number.isFinite(gustKmh) ? `${gustKmh.toFixed(1)} กม./ชม. · ยังไม่มีเกณฑ์อันตรายเฉพาะพื้นที่` : 'ไม่มีข้อมูลลม',
        actionValue: result.decision,
        actionText: result.action,
    };
};

export const updateDashboardUI = (w: any, severity = "NORMAL", province = "กรุงเทพมหานคร", riverDischargeAvailable = false) => {
    if (!w) return;

    // Update charts if available
    if ((window as any).updateCharts) {
        (window as any).updateCharts(w, province);
    }

    const humidity = readMetric(w.relative_humidity_2m);
    const tempC = readMetric(w.temperature_2m);
    const apparent = readMetric(w.apparent_temperature ?? w.temperature_2m);
    const gust = readMetric(w.wind_gusts_10m);
    const rain = readMetric(w.precipitation);
    const uv = readMetric(w.uv_index);
    const weatherCode = readMetric(w.weather_code);
    const dewPoint = calculateDewPoint(tempC, humidity);
    const forecastSummary = getWeatherForecastSummary(tempC, humidity, gust, rain, uv, weatherCode);
    const humidityAlert = evaluateHumidityAlert({ humidity, temperatureC: tempC, dewPointC: dewPoint });
    const comfortText = humidityAlert.comfort;
    const statusText = humidityAlert.message;
    const adviceText = humidityAlert.advice;
    const readiness = getDepartureReadiness(tempC, humidity, rain, gust, uv, weatherCode);
    const outdoorSummary = buildOutdoorReadinessSummary(tempC, humidity, dewPoint, rain, gust, uv, weatherCode);
    const hazardAssessment = assessWeatherHazards(w);
    const finding = (id: string) => hazardAssessment.findings.find(item => item.id === id);
    const coreDataIncomplete = ['heat', 'uv', 'rain', 'storm'].some(id => finding(id)?.band === 'unknown');
    const weatherSpeechKey = [province, outdoorSummary.status, tempC.toFixed(1), humidity.toFixed(0), rain.toFixed(1), gust.toFixed(1)].join('|');
    const observedAt = w.time ?? w.observation_time ?? w.timestamp ?? null;
    latestWeatherNarration = createWeatherNarration({
        mode: 'live',
        province,
        data: {
            temperature_2m: Number.isFinite(Number(w.temperature_2m)) ? Number(w.temperature_2m) : undefined,
            relative_humidity_2m: Number.isFinite(Number(w.relative_humidity_2m)) ? Number(w.relative_humidity_2m) : undefined,
            precipitation: Number.isFinite(Number(w.precipitation)) ? Number(w.precipitation) : undefined,
            weather_code: Number.isFinite(Number(w.weather_code)) ? Number(w.weather_code) : undefined,
        },
        observedAt,
        maxAgeMinutes: WEATHER_MAX_AGE_MINUTES,
        sourceLabel: w.sourceLabel || (w.time ? 'โอเพนเมทีโอ' : 'แหล่งข้อมูลที่เชื่อมต่อ'),
    });

    if (automaticSpeechEnabled && !isAudioMuted() && weatherSpeechKey !== lastWeatherSpeechKey && (severity !== 'NORMAL' || outdoorSummary.status !== 'READY')) {
        lastWeatherSpeechKey = weatherSpeechKey;
        setTimeout(() => speakText(latestWeatherNarration), 220);
    }

    updateHumidityDetailPanel(humidity, dewPoint, comfortText, statusText, adviceText);

    if (UI.outdoorSummaryText) {
        UI.outdoorSummaryText.textContent = outdoorSummary.summary;
    }
    if (UI.outdoorActionText) {
        UI.outdoorActionText.textContent = outdoorSummary.action;
    }

    if (UI.departureStatusPill) {
        UI.departureStatusPill.textContent = readiness.label;
        UI.departureStatusPill.className = `status-pill ${readiness.className}`;
    }
    if (UI.departureAirValue) UI.departureAirValue.textContent = `${tempC.toFixed(1)}°C`;
    if (UI.departureAirText) UI.departureAirText.textContent = readiness.airText;
    if (UI.departureRainValue) UI.departureRainValue.textContent = `${rain.toFixed(1)} mm/h`;
    if (UI.departureRainText) UI.departureRainText.textContent = readiness.rainText;
    if (UI.departureWindValue) UI.departureWindValue.textContent = `${gust.toFixed(1)} km/h`;
    if (UI.departureWindText) UI.departureWindText.textContent = readiness.windText;
    if (UI.departureActionValue) UI.departureActionValue.textContent = readiness.actionValue;
    if (UI.departureActionText) UI.departureActionText.textContent = readiness.actionText;

    // Batch all DOM updates using DOMBatcher
    domBatcher.schedule(() => {
        // 1. UV Index
        if (UI.uvValue) UI.uvValue.textContent = formatMetric(uv);
        if (UI.uvForecastText) UI.uvForecastText.textContent = forecastSummary;
        if (UI.uvBar) (UI.uvBar as HTMLElement).style.width = `${Math.min((uv / 15) * 100, 100)}%`;
        if (UI.uvRiskBadge) {
            const uvFinding = finding('uv');
            if (uvFinding?.band === 'unknown') {
                UI.uvRiskBadge.textContent = 'ไม่มีข้อมูล';
                UI.uvRiskBadge.style.cssText = 'background: rgba(148,163,184,0.15); color: #cbd5e1;';
            } else if (uv >= 8.0) {
                UI.uvRiskBadge.textContent = "หลีกเลี่ยงแดดกลางวัน (WHO)";
                UI.uvRiskBadge.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
                if (UI.uvBar) (UI.uvBar as HTMLElement).style.background = "#ef4444";
            } else if (uv >= 3.0) {
                UI.uvRiskBadge.textContent = "ป้องกันแดดตามคำแนะนำ WHO";
                UI.uvRiskBadge.style.cssText = "background: rgba(245,158,11,0.2); color: #f59e0b;";
                if (UI.uvBar) (UI.uvBar as HTMLElement).style.background = "#f59e0b";
            } else {
                UI.uvRiskBadge.textContent = "ต่ำกว่าเกณฑ์เริ่มแนะนำป้องกันแดด";
                UI.uvRiskBadge.style.cssText = "background: rgba(16,185,129,0.1); color: #10b981;";
                if (UI.uvBar) (UI.uvBar as HTMLElement).style.background = "#06b6d4";
            }
        }

        // 1b. Dedicated humidity card
        if (UI.humidityValue) UI.humidityValue.textContent = `${formatMetric(humidity, 0)}%`;
        if (UI.humidityDewPointValue) UI.humidityDewPointValue.textContent = formatMetric(dewPoint);
        if (UI.humidityRiskBadge) UI.humidityRiskBadge.textContent = 'ระดับความชื้น';

        // 2. Heat Index / Apparent Temp
        const airTemp = Number(w.temperature_2m || apparent);
        if (UI.heatValue) UI.heatValue.textContent = `${formatMetric(apparent)} °C`;
        if (UI.airTempValue) UI.airTempValue.textContent = formatMetric(airTemp);
        if (UI.heatDewPointValue) UI.heatDewPointValue.textContent = `${formatMetric(dewPoint)}°C`;
        if (UI.heatForecastText) UI.heatForecastText.textContent = forecastSummary;
        if (UI.heatBar) (UI.heatBar as HTMLElement).style.width = `${Math.min((apparent / 50) * 100, 100)}%`;
        if (UI.heatRiskBadge) {
            const heatFinding = finding('heat');
            if (heatFinding?.band === 'unknown') {
                UI.heatRiskBadge.textContent = 'ไม่มีข้อมูลพอคำนวณดัชนีความร้อน';
                UI.heatRiskBadge.style.cssText = 'background: rgba(148,163,184,0.15); color: #cbd5e1;';
            } else if (heatFinding?.band === 'danger' || heatFinding?.band === 'very-dangerous') {
                UI.heatRiskBadge.textContent = heatFinding.band === 'very-dangerous' ? 'อันตรายมากตามกรมอนามัย' : 'อันตรายตามกรมอนามัย';
                UI.heatRiskBadge.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
                if (UI.heatBar) (UI.heatBar as HTMLElement).style.background = "#ef4444";
            } else if (heatFinding?.band === 'warning' || heatFinding?.band === 'watch') {
                UI.heatRiskBadge.textContent = heatFinding.band === 'watch' ? 'เฝ้าระวังตามกรมอนามัย' : 'เตือนภัยตามกรมอนามัย';
                UI.heatRiskBadge.style.cssText = "background: rgba(245,158,11,0.2); color: #f59e0b;";
                if (UI.heatBar) (UI.heatBar as HTMLElement).style.background = "#f59e0b";
            } else {
                UI.heatRiskBadge.textContent = "ต่ำกว่าเกณฑ์เฝ้าระวังดัชนีความร้อน";
                UI.heatRiskBadge.style.cssText = "background: rgba(16,185,129,0.1); color: #10b981;";
                if (UI.heatBar) (UI.heatBar as HTMLElement).style.background = "#10b981";
            }
        }

        // 3. Thunderstorm
        const wmo = Number(w.weather_code || 0);
        if (UI.wmoCodeBadge) UI.wmoCodeBadge.textContent = `Code: ${wmo}`;
        if (UI.wmoDescText) UI.wmoDescText.textContent = getWmoDescription(wmo);

        // 4. Wind Gusts
        const speed = readMetric(w.wind_speed_10m);
        if (UI.gustValue) UI.gustValue.textContent = Number.isFinite(gust) ? `${gust.toFixed(1)} กม./ชม.` : 'ไม่มีข้อมูล';
        if (UI.windSpeedValue) UI.windSpeedValue.textContent = formatMetric(speed);
        if (UI.gustRiskBadge) {
            UI.gustRiskBadge.textContent = Number.isFinite(gust) ? 'ไม่มีเกณฑ์อันตรายเฉพาะพื้นที่' : 'ไม่มีข้อมูล';
            UI.gustRiskBadge.style.cssText = 'background: rgba(148,163,184,0.15); color: #cbd5e1;';
        }

        // 5. Rainfall
        if (UI.rainValue) UI.rainValue.textContent = Number.isFinite(rain) ? `${rain.toFixed(1)} มม./ชั่วโมง` : 'ไม่มีข้อมูล';
        if (UI.rainRiskBadge) {
            const rainFinding = finding('rain');
            if (rainFinding?.band === 'unknown') {
                UI.rainRiskBadge.textContent = 'ไม่มีข้อมูล';
                UI.rainRiskBadge.style.cssText = 'background: rgba(148,163,184,0.15); color: #cbd5e1;';
            } else if (rain >= 50.1) {
                UI.rainRiskBadge.textContent = "ฝนหนักมากตามเกณฑ์กรมอุตุนิยมวิทยา";
                UI.rainRiskBadge.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
            } else if (rain >= 25.1) {
                UI.rainRiskBadge.textContent = "ฝนหนักตามเกณฑ์กรมอุตุนิยมวิทยา";
                UI.rainRiskBadge.style.cssText = "background: rgba(245,158,11,0.2); color: #f59e0b;";
            } else {
                UI.rainRiskBadge.textContent = "ต่ำกว่าเกณฑ์ฝนหนักรายชั่วโมง";
                UI.rainRiskBadge.style.cssText = "background: rgba(16,185,129,0.1); color: #10b981;";
            }
        }

        // 6. River Discharge
        const riverDischarge = Number(w.river_discharge);
        if (UI.riverValue) {
            UI.riverValue.textContent = riverDischargeAvailable && Number.isFinite(riverDischarge)
                ? `${riverDischarge.toLocaleString('th-TH', { maximumFractionDigits: 1 })} m³/s · คาดการณ์ Open-Meteo`
                : 'ขณะนี้ไม่มีข้อมูลล่าสุด';
        }
        if (UI.riverRiskBadge) {
            UI.riverRiskBadge.textContent = 'ยังประเมินระดับอันตรายไม่ได้';
            UI.riverRiskBadge.style.cssText = 'background: rgba(148,163,184,0.15); color: #cbd5e1;';
        }

        // Highest Threat Badge
        if (UI.highestThreatBadge) {
            UI.highestThreatBadge.textContent = coreDataIncomplete && severity === 'NORMAL'
                ? 'ข้อมูลไม่ครบ · ยังสรุปไม่ได้'
                : `${severity} ${severity === 'CRITICAL' ? '🚨' : (severity === 'WARNING' ? '⚠️' : '')}`;
            if (severity === 'CRITICAL') {
                UI.highestThreatBadge.style.cssText = "background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #ef4444; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;";
            } else if (severity === 'WARNING') {
                UI.highestThreatBadge.style.cssText = "background: rgba(245,158,11,0.2); border: 1px solid #f59e0b; color: #f59e0b; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;";
            } else {
                const color = coreDataIncomplete ? '#cbd5e1' : '#10b981';
                UI.highestThreatBadge.style.cssText = `background: ${coreDataIncomplete ? 'rgba(148,163,184,0.15)' : 'rgba(16,185,129,0.15)'}; border: 1px solid ${color}; color: ${color}; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;`;
            }
        }

        if (severity === 'WARNING' || severity === 'CRITICAL') {
            const alertMessage = severity === 'CRITICAL'
                ? `ข้อมูลแบบจำลองพบเกณฑ์อากาศระดับอันตรายใน จ.${province} โปรดทำตามคำแนะนำและตรวจประกาศทางการ`
                : `ข้อมูลแบบจำลองพบปัจจัยอากาศที่ควรระวังใน จ.${province} โปรดติดตามประกาศทางการ`;
            speakAlertIfNeeded(severity, alertMessage);
        }

        if (UI.strobeStatusPill) {
            if (severity === 'CRITICAL') {
                UI.strobeStatusPill.textContent = "ON (ACTIVE)";
                UI.strobeStatusPill.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
            } else if (severity === 'WARNING') {
                UI.strobeStatusPill.textContent = "ON (WARNING)";
                UI.strobeStatusPill.style.cssText = "background: rgba(245,158,11,0.2); color: #f59e0b;";
            } else {
                UI.strobeStatusPill.textContent = "OFF";
                UI.strobeStatusPill.style.cssText = "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
            }
        }
        if (UI.doorStatusPill) {
            if (severity === 'CRITICAL') {
                UI.doorStatusPill.textContent = "UNLOCKED (FAIL-SAFE)";
                UI.doorStatusPill.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
            } else {
                UI.doorStatusPill.textContent = "LOCKED";
                UI.doorStatusPill.style.cssText = "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
            }
        }
        if (UI.sirenStatusPill) {
            if (severity === 'CRITICAL') {
                UI.sirenStatusPill.textContent = "SIREN SOUNDING";
                UI.sirenStatusPill.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
            } else if (severity === 'WARNING') {
                UI.sirenStatusPill.textContent = "ALERT ACTIVE";
                UI.sirenStatusPill.style.cssText = "background: rgba(245,158,11,0.2); color: #f59e0b;";
            } else {
                UI.sirenStatusPill.textContent = "MUTED";
                UI.sirenStatusPill.style.cssText = "background: rgba(148,163,184,0.1); color: var(--color-fg-muted);";
            }
        }
        if (UI.alertBanner) {
            const isAlert = severity === 'CRITICAL' || severity === 'WARNING';
            UI.alertBanner.style.display = isAlert ? 'block' : 'none';
            UI.alertBanner.style.borderColor = severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)';
            UI.alertBanner.style.background = severity === 'CRITICAL'
                ? 'rgba(239, 68, 68, 0.08)'
                : 'rgba(245, 158, 11, 0.08)';

            if (UI.alertBannerTitle) {
                UI.alertBannerTitle.textContent = severity === 'CRITICAL'
                    ? '🚨 พบเกณฑ์อากาศระดับอันตรายจากข้อมูลแบบจำลอง'
                    : '⚠️ พบปัจจัยอากาศที่ควรระวังจากข้อมูลแบบจำลอง';
                UI.alertBannerTitle.style.color = severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
            }

            if (UI.alertBannerMsg) {
                UI.alertBannerMsg.textContent = severity === 'CRITICAL'
                    ? `ข้อมูลแบบจำลองใน จ.${province} ถึงเกณฑ์อันตราย โปรดตรวจคำแนะนำและประกาศทางการ`
                    : `ข้อมูลแบบจำลองใน จ.${province} มีปัจจัยที่ควรระวัง โปรดติดตามประกาศทางการ`;
            }
        }

        const now = Date.now();
        const shouldRecordHistory = historyLogs.length === 0 || now - lastHistoryRecordAt >= HISTORY_LOG_INTERVAL_MS;

        if (shouldRecordHistory) {
            const timeStr = new Date().toLocaleTimeString();
            historyLogs.unshift({
                time: timeStr,
                province,
                severity,
                desc: `UV: ${uv.toFixed(1)} | Heat: ${apparent.toFixed(1)}°C | Rain: ${rain.toFixed(1)} mm | Gust: ${gust.toFixed(1)} km/h`,
                metrics: `UV ${uv.toFixed(1)} / ${apparent.toFixed(1)}°C`
            });

            lastHistoryRecordAt = now;
        }

        // Limit history logs to prevent memory issues
        if (historyLogs.length > MAX_HISTORY_LOGS) {
            historyLogs.length = MAX_HISTORY_LOGS;
        }

        renderHistoryTable();
    });
};

const renderHistoryTable = () => {
    if (!UI.historyTableBody) return;
    
    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    UI.historyTableBody.innerHTML = '';
    
    // Limit rendered items to first 20 for performance
    const visibleLogs = historyLogs.slice(0, 20);
    
    visibleLogs.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        const badgeColor = item.severity === 'CRITICAL' ? '#ef4444' : (item.severity === 'WARNING' ? '#f59e0b' : '#10b981');
        tr.innerHTML = `
            <td style="padding: 0.75rem 1rem;">${item.time}</td>
            <td style="padding: 0.75rem 1rem; font-weight:600;">${item.province}</td>
            <td style="padding: 0.75rem 1rem;"><span style="color:${badgeColor}; font-weight:700;">${item.severity}</span></td>
            <td style="padding: 0.75rem 1rem; color:var(--color-fg-muted);">${item.desc}</td>
            <td style="padding: 0.75rem 1rem; font-family:var(--font-mono);">${item.metrics}</td>
        `;
        fragment.appendChild(tr);
    });
    
    // Single DOM operation
    UI.historyTableBody.appendChild(fragment);
};

// Global audio unlock on first user gesture
if (typeof window !== 'undefined') {
    const unlockAudioOnGesture = () => {
        const audioContext = getAlertAudioContext();
        if (audioContext?.state === 'suspended') void audioContext.resume();
        if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
            const dummy = new SpeechSynthesisUtterance('');
            dummy.volume = 0;
            window.speechSynthesis.speak(dummy);
        }
    };
    window.addEventListener('click', unlockAudioOnGesture, { once: true });
    window.addEventListener('keydown', unlockAudioOnGesture, { once: true });
    window.addEventListener('pointerdown', unlockAudioOnGesture, { once: true });
}
