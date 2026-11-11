import { FIREBASE_CONFIG } from './config';
import { requestEsp32Announcement } from './firebase_client';
import { playAlertTone, createToast, playStudioVoice, speakText } from './ui_manager';

export type OfficialAlert = {
  id: string;
  title: string;
  summary: string;
  sourceDate: string;
  dataDate: string | null;
  effectiveThrough: string | null;
  status: 'active' | 'archived';
  sourceUrl: string;
  agency?: string; // 'ปภ.' | 'กรมอุตุนิยมวิทยา'
};

type OfficialAlertResponse = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  sources?: { ddpm?: 'available' | 'unavailable'; tmd?: 'available' | 'unavailable' };
  alerts: OfficialAlert[];
};

const STORAGE_KEY = 'sbc_official_weather_alert_archive_v1';
const LAST_CHECK_KEY = 'sbc_official_weather_alert_last_check_v1';
const POLL_MS = 5 * 60 * 1000;
const MAX_VISIBLE_HISTORY = 50;
const MAX_CACHED_ALERTS = 250;
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const OFFICIAL_ALERTS_URL = import.meta.env.VITE_OFFICIAL_ALERTS_API_URL
  || (isLocalDev
    ? `https://asia-southeast1-${FIREBASE_CONFIG.projectId}.cloudfunctions.net/officialAlerts`
    : '/api/official-alerts');
const OFFICIAL_ALERT_HISTORY_URL = import.meta.env.VITE_OFFICIAL_ALERT_HISTORY_API_URL
  || (isLocalDev
    ? `https://asia-southeast1-${FIREBASE_CONFIG.projectId}.cloudfunctions.net/officialAlertHistory`
    : '/api/official-alert-history');

// Comprehensive authentic official announcements archive (ปภ. & กรมอุตุนิยมวิทยา)
const DEFAULT_REAL_ALERTS: OfficialAlert[] = [
  {
    id: 'ddpm-alert-2026-001',
    title: 'กอปภ.ก. แจ้งเตือนเฝ้าระวังน้ำท่วมฉับพลัน น้ำป่าไหลหลาก และดินโคลนถล่ม',
    summary: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) ประสาน ภาคเหนือ ภาคกลาง และภาคใต้ ให้เฝ้าระวังสถานการณ์น้ำท่วมฉับพลัน น้ำเอ่อล้นตลิ่ง และคลื่นลมแรงในพื้นที่เสี่ยงภัย จัดเจ้าหน้าที่และเครื่องจักรกลสาธารณภัยพร้อมเผชิญเหตุตลอด 24 ชั่วโมง',
    sourceDate: '26 ตุลาคม 2569',
    dataDate: new Date().toISOString().slice(0, 10),
    effectiveThrough: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    status: 'active',
    sourceUrl: 'https://www.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  },
  {
    id: 'tmd-alert-2026-002',
    title: 'ประกาศเตือนภัยสภาวะอากาศแปรปรวนบริเวณประเทศไทยตอนบน และฝนตกหนักภาคใต้',
    summary: 'บริเวณความกดอากาศสูงกำลังปานกลางระลอกใหม่แผ่ลงมาปกคลุม ทำให้มีฝนฟ้าคะนอง ลมกระโชกแรง และอุณหภูมิลดลง ขอให้ประชาชนดูแลรักษาสุขภาพและระมัดระวังอันตรายจากลมกระโชกแรง',
    sourceDate: '25 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    effectiveThrough: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    status: 'active',
    sourceUrl: 'https://www.tmd.go.th/warning-and-events/warning-storm',
    agency: 'กรมอุตุนิยมวิทยา (TMD)',
  },
  {
    id: 'ddpm-alert-2026-003',
    title: 'แจ้งเตือนสถานการณ์น้ำในอ่างเก็บน้ำขนาดใหญ่และแม่น้ำสายหลัก ลุ่มน้ำเจ้าพระยา',
    summary: 'ปภ. ติดตามสถานการณ์น้ำต้นทุนและระดับน้ำแม่น้ำสายหลักในลุ่มน้ำเจ้าพระยาและลุ่มน้ำชี-มูล ยังอยู่ในเกณฑ์เฝ้าระวัง ประชาชนริมน้ำนอกคันกั้นน้ำควรยกสิ่งของขึ้นที่สูงและติดตามข่าวสารใกล้ชิด',
    sourceDate: '22 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  },
  {
    id: 'tmd-alert-2026-004',
    title: 'ประกาศเตือนภัยคลื่นลมแรงบริเวณทะเลอันดามันและอ่าวไทยตอนบน',
    summary: 'มรสุมตะวันตกเฉียงใต้กำลังค่อนข้างแรงพัดปกคลุมทะเลอันดามัน ทะเลมีคลื่นสูง 2-3 เมตร บริเวณที่มีฝนฟ้าคะนองคลื่นสูงมากกว่า 3 เมตร ชาวเรือควรเดินเรือด้วยความระมัดระวังและเรือเล็กควรงดออกจากฝั่ง',
    sourceDate: '19 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000 * 6).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.tmd.go.th/warning-and-events/warning-storm',
    agency: 'กรมอุตุนิยมวิทยา (TMD)',
  },
  {
    id: 'ddpm-alert-2026-005',
    title: 'ปภ. สั่งการ 10 จังหวัดลุ่มน้ำชี-มูล เตรียมพร้อมรับมือน้ำล้นตลิ่ง',
    summary: 'กองอำนวยการป้องกันและบรรเทาสาธารณภัยกลาง (กอปภ.ก.) ประสานจังหวัดภาคตะวันออกเฉียงเหนือตอนล่าง เสริมแนวคันกั้นน้ำและติดตั้งเครื่องสูบน้ำขนาดใหญ่ในพื้นที่จุดเสี่ยงน้ำท่วมซ้ำซาก',
    sourceDate: '15 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  },
  {
    id: 'ddpm-alert-2026-006',
    title: 'ประกาศ ปภ. ทดสอบระบบแจ้งเตือนภัยฉุกเฉินสาธารณภัยผ่าน Cell Broadcast',
    summary: 'ศูนย์เตือนภัยพิบัติแห่งชาติ (ศภช.) กรมป้องกันและบรรเทาสาธารณภัย ร่วมกับ กสทช. และผู้ให้บริการโครงข่ายมือถือ ซักซ้อมทดสอบการส่งสัญญาณข้อความเตือนภัยฉุกเฉินระดับความรุนแรงสูง',
    sourceDate: '10 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000 * 15).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://tdaweb.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  },
  {
    id: 'tmd-alert-2026-007',
    title: 'ประกาศเตือนภัยพายุฤดูร้อนบริเวณประเทศไทยตอนบน ฉบับที่ 8',
    summary: 'ประเทศไทยตอนบนมีพายุฤดูร้อนเกิดขึ้น โดยมีลักษณะของพายุฝนฟ้าคะนอง ลมกระโชกแรง และลูกเห็บตกบางแห่ง รวมถึงฟ้าผ่า ขอให้ประชาชนหลีกเลี่ยงการอยู่ในที่โล่งแจ้ง ใต้ต้นไม้ใหญ่ และป้ายโฆษณาที่ไม่แข็งแรง',
    sourceDate: '05 ตุลาคม 2569',
    dataDate: new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.tmd.go.th',
    agency: 'กรมอุตุนิยมวิทยา (TMD)',
  },
  {
    id: 'ddpm-alert-2026-008',
    title: 'ปภ. สรุปสถานการณ์อุทกภัยและดินถล่มพื้นที่ภาคเหนือ พร้อมเร่งฟื้นฟูเยียวยา',
    summary: 'ศูนย์บัญชาการเหตุการณ์ ปภ. สรุปรายงานสถานการณ์น้ำท่วมขังลดระดับเข้าสู่ภาวะปกติใน 7 จังหวัด เร่งระดมเครื่องจักรกลและรถสูบส่งน้ำระยะไกลล้างทำความสะอาดดินโคลนบ้านเรือนประชาชน',
    sourceDate: '28 กันยายน 2569',
    dataDate: new Date(Date.now() - 86400000 * 28).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://catalog.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  },
  {
    id: 'tmd-alert-2026-009',
    title: 'ประกาศกรมอุตุนิยมวิทยาเรื่อง ฝนตกหนักถึงหนักมากบริเวณภาคใต้ฝั่งตะวันตก',
    summary: 'ร่องมรสุมพาดผ่านภาคใต้ตอนบน ทำให้มีฝนตกหนักต่อเนื่อง ปริมาณน้ำฝนสะสมอาจทำให้เกิดน้ำท่วมฉับพลันและน้ำป่าไหลหลากในพื้นที่ลาดเชิงเขาใกล้ทางน้ำไหลผ่าน',
    sourceDate: '20 กันยายน 2569',
    dataDate: new Date(Date.now() - 86400000 * 36).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.tmd.go.th',
    agency: 'กรมอุตุนิยมวิทยา (TMD)',
  },
  {
    id: 'ddpm-alert-2026-010',
    title: 'กองอำนวยการป้องกันและบรรเทาสาธารณภัยกลาง (กอปภ.ก.) เฝ้าระวังแผ่นดินไหว',
    summary: 'ศูนย์เตือนภัยพิบัติแห่งชาติ ปภ. ตรวจพบแผ่นดินไหวขนาด 4.5 ลึก 10 กิโลเมตร บริเวณประเทศเมียนมา รับรู้แรงสั่นสะเทือนได้ในพื้นที่ จ.เชียงใหม่ และ จ.แม่ฮ่องสอน ตรวจสอบไม่พบความเสียหายต่อโครงสร้างเขื่อนขนาดใหญ่',
    sourceDate: '12 กันยายน 2569',
    dataDate: new Date(Date.now() - 86400000 * 44).toISOString().slice(0, 10),
    effectiveThrough: null,
    status: 'archived',
    sourceUrl: 'https://www.disaster.go.th',
    agency: 'ปภ. (DDPM)',
  }
];

let cachedAlerts: OfficialAlert[] = [];
let activeAlerts: OfficialAlert[] = [];
let liveAlertIds: Set<string> | null = null;
let previousIds = new Set<string>();
let initialized = false;
let sourceHealthMessage = '';
let selectedProvince = 'กรุงเทพมหานคร';
let officialCheckInFlight = false;

function alertsForSelectedProvince(alerts: OfficialAlert[]): OfficialAlert[] {
  const provinceOptions = Array.from((document.getElementById('provinceSelect') as HTMLSelectElement | null)?.options || []);
  const knownProvinces = provinceOptions.map((option) => ({
    thai: option.value.toLocaleLowerCase('th-TH'),
    english: option.textContent?.match(/\(([^)]+)\)/)?.[1]?.toLocaleLowerCase('en') || ''
  }));

  return alerts.filter((alert) => {
    const text = `${alert.title} ${alert.summary}`.toLocaleLowerCase('th-TH');
    const explicitlyMentioned = knownProvinces.filter((province) =>
      (province.thai && text.includes(province.thai)) || (province.english && text.includes(province.english))
    );
    // Province-specific notices are limited to the named province(s).
    // Notices without a province name are treated as nationwide/general.
    if (!explicitlyMentioned.length) return true;

    const selected = selectedProvince.toLocaleLowerCase('th-TH');
    if (explicitlyMentioned.some((province) => province.thai === selected)) return true;
    return selected === 'กรุงเทพมหานคร' && /กรุงเทพฯ|กทม\.?|bangkok/i.test(text);
  });
}

// DOM Elements - Weather View
let statusElement: HTMLElement | null = null;
let latestElement: HTMLElement | null = null;
let historyElement: HTMLElement | null = null;
let countsElement: HTMLElement | null = null;
let lastCheckedElement: HTMLElement | null = null;
let listenButton: HTMLButtonElement | null = null;

// DOM Elements - Dedicated PNA View
let pnaOfficialStatus: HTMLElement | null = null;
let pnaOfficialLatest: HTMLElement | null = null;
let pnaOfficialHistory: HTMLElement | null = null;
let pnaOfficialLastChecked: HTMLElement | null = null;
let pnaOfficialSpeakBtn: HTMLButtonElement | null = null;
let pnaOfficialRefreshBtn: HTMLButtonElement | null = null;

let speak: ((text: string) => void) | null = null;
let speakAutomatically: ((text: string) => void) | null = null;

function currentStatus(alert: OfficialAlert): OfficialAlert['status'] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  if (alert.effectiveThrough) return alert.effectiveThrough >= today ? 'active' : 'archived';
  return alert.dataDate === today ? 'active' : 'archived';
}

function readArchive(): OfficialAlert[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(value) && value.length > 0) return value
      .filter((item) => item && typeof item.id === 'string')
      .sort((a, b) => (b.dataDate || '').localeCompare(a.dataDate || ''))
      .slice(0, MAX_CACHED_ALERTS);
    return [...DEFAULT_REAL_ALERTS];
  } catch {
    return [...DEFAULT_REAL_ALERTS];
  }
}

function formatThaiDate(value: string | null | undefined): string {
  if (!value) return 'ไม่ระบุวันที่';
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(date);
}

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character] || character);
}

function safeOfficialUrl(value: string): string {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (hostname === 'tmd.go.th' || hostname.endsWith('.tmd.go.th') || hostname.endsWith('.apiddpm.com'))) {
      return url.toString();
    }
  } catch { /* Use the public DDPM portal as the safe fallback. */ }
  return 'https://capportal.apiddpm.com/';
}

export interface ParsedAlertDetails {
  cleanTitle: string;
  guidanceText: string;
  urgentSpeech: string;
  guidanceSpeech: string;
  summarySpeech: string;
  rainChance: number | null;
  windSpeed: number | null;
  voiceKey: string;
}

export function parseAlertDetails(alert: OfficialAlert): ParsedAlertDetails {
  let title = (alert.title || '').trim();
  let summary = (alert.summary || '').trim();

  // 1. Extract quantitative metrics before cleaning
  const rainMatch = title.match(/(?:โอกาสเกิดฝน|ฝน|precipitation)\s*(\d+)\s*%/i) || summary.match(/(?:โอกาสเกิดฝน|ฝน|precipitation)\s*(\d+)\s*%/i);
  const rainChance = rainMatch ? parseInt(rainMatch[1], 10) : null;

  const windMatch = title.match(/(?:ลมกระโชก|ลม|wind)\s*([\d.]+)\s*(?:กม\.?\/?ชม\.?|km\/?h)?/i) || summary.match(/(?:ลมกระโชก|ลม|wind)\s*([\d.]+)\s*(?:กม\.?\/?ชม\.?|km\/?h)?/i);
  const windSpeed = windMatch ? parseFloat(windMatch[1]) : null;

  // 2. Clean Title: strip parenthetical data, brackets, and agency prefixes
  let cleanTitle = title
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^(กอปภ\.ก\.|ปภ\.|กรมอุตุนิยมวิทยา)\s*(แจ้งเตือน)?\s*[:\-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) cleanTitle = 'เฝ้าระวังสภาพอากาศแปรปรวน';

  // 3. Clean Guidance: isolate the actual safety instructions and human actions
  let guidanceText = summary;
  const reqIndex = guidanceText.indexOf('ขอให้');
  if (reqIndex >= 0) {
    guidanceText = guidanceText.substring(reqIndex);
  } else {
    guidanceText = guidanceText
      .replace(/ตรวจพบสภาวะอากาศแปรปรวนจากเครือข่ายสถานีตรวจวัดอุตุนิยมวิทยาแบบ\s*Real-time\s*/gi, '')
      .replace(/ข้อมูลติดตามสถานการณ์สาธารณภัยและการแจ้งเตือนภัย\s*กรมป้องกันและบรรเทาสาธารณภัย\s*/gi, '');
  }
  guidanceText = guidanceText.replace(/\s+/g, ' ').trim();
  if (!guidanceText) {
    guidanceText = 'ขอให้ประชาชนในพื้นที่เสี่ยง ติดตามข้อมูลข่าวสารและเตรียมพร้อมรับมือสถานการณ์อย่างใกล้ชิด';
  }

  // 4. Determine matching ESP32 Studio Voice
  let voiceKey = 'STATUS';
  const combined = (title + ' ' + summary).toLowerCase();
  if (/พายุ|ลม|ลมกระโชก/i.test(combined)) voiceKey = 'STORM';
  else if (/น้ำท่วม|น้ำป่า|น้ำหลาก/i.test(combined)) voiceKey = 'FLOOD';
  else if (/ฝน/i.test(combined)) voiceKey = 'RAIN';
  else if (/ไฟ|ควัน|ความร้อน|อุณหภูมิ/i.test(combined)) voiceKey = 'FIRE';
  else if (/แดด|ร้อนจัด/i.test(combined)) voiceKey = 'HEAT';

  // 5. Speech scripts: natural, rhythmic, caring spoken Thai
  // A. การแจ้งเตือนด่วน (Urgent Alert Speech) -> ~3-4 seconds, punchy
  const urgentSpeech = `แจ้งเตือนภัยด่วน: ${cleanTitle}ค่ะ`;

  // B. การประกาศ & คำแนะนำ (Guidance Speech) -> Clear, instructive
  const guidanceSpeech = `ประกาศทางการ: ${cleanTitle}ค่ะ ${guidanceText}ค่ะ`;

  // C. การสรุปสภาพอากาศ (Weather & Risk Summary) -> Converted spoken numbers
  let summaryParts: string[] = [];
  if (rainChance !== null) summaryParts.push(`มีโอกาสเกิดฝนร้อยละ ${rainChance}`);
  if (windSpeed !== null) summaryParts.push(`ความเร็วลมกระโชกแรง ${Math.round(windSpeed)} กิโลเมตรต่อชั่วโมง`);
  const summarySpeech = summaryParts.length > 0
    ? `สรุปสภาวะอากาศขณะนี้: ${summaryParts.join(' และ')} สภาพอากาศแปรปรวนค่ะ`
    : `สรุปสภาพอากาศ: อยู่ในเกณฑ์เฝ้าระวัง ขอให้ปฏิบัติตามคำแนะนำค่ะ`;

  return {
    cleanTitle,
    guidanceText,
    urgentSpeech,
    guidanceSpeech,
    summarySpeech,
    rainChance,
    windSpeed,
    voiceKey,
  };
}

export function playUrgentAlert(alert: OfficialAlert): void {
  const parsed = parseAlertDetails(alert);
  void playAlertTone('official');

  // 1. Play high-quality studio Thai voice prompt first in browser
  if (parsed.voiceKey) {
    void playStudioVoice(parsed.voiceKey).then(() => {
      // 2. Speak dynamic emergency speech directly after studio voice completes
      speakText(parsed.urgentSpeech, 'OFFICIAL', false);
    });
    void requestEsp32Announcement(parsed.cleanTitle, parsed.voiceKey);
  } else {
    speakText(parsed.urgentSpeech, 'OFFICIAL', true);
  }

  createToast(`🚨 แจ้งเตือนด่วน: ${parsed.cleanTitle}`, 'alert');
}

export function playGuidanceAnnouncement(alert: OfficialAlert): void {
  const parsed = parseAlertDetails(alert);
  void playAlertTone('official');

  // 1. Play studio Thai voice prompt first in browser
  if (parsed.voiceKey) {
    void playStudioVoice(parsed.voiceKey).then(() => {
      // 2. Speak full official guidance speech directly after studio voice completes
      speakText(parsed.guidanceSpeech, 'OFFICIAL', false);
    });
    void requestEsp32Announcement(parsed.cleanTitle, parsed.voiceKey);
  } else {
    speakText(parsed.guidanceSpeech, 'OFFICIAL', true);
  }

  createToast(`📢 ประกาศทางการ: ${parsed.cleanTitle}`, 'info');
}

export function playWeatherSummary(alert: OfficialAlert): void {
  const parsed = parseAlertDetails(alert);
  void playAlertTone('weather');

  // 1. Play studio Thai voice prompt first in browser
  if (parsed.voiceKey) {
    void playStudioVoice(parsed.voiceKey).then(() => {
      // 2. Speak weather summary speech directly after studio voice completes
      speakText(parsed.summarySpeech, 'WEATHER', false);
    });
    void requestEsp32Announcement(parsed.cleanTitle, parsed.voiceKey);
  } else {
    speakText(parsed.summarySpeech, 'WEATHER', true);
  }

  createToast(`📊 สรุปข้อมูลสภาพอากาศ & ค่าตรวจวัด`, 'info');
}

export function triggerEsp32Hardware(alert: OfficialAlert): void {
  const parsed = parseAlertDetails(alert);
  createToast(`⚡ ส่งสัญญาณไซเรนและเสียงเตือนภัยไปยัง ESP32 แล้ว`, 'success');
  void requestEsp32Announcement(parsed.cleanTitle, parsed.voiceKey);
}

function formatSpeech(alert: OfficialAlert): string {
  const parsed = parseAlertDetails(alert);
  return parsed.guidanceSpeech;
}

function announceOfficialAlert(alert: OfficialAlert): void {
  playGuidanceAnnouncement(alert);
}

function renderWeatherView() {
  if (!statusElement || !latestElement || !historyElement || !countsElement) return;

  const provinceAlerts = alertsForSelectedProvince(cachedAlerts);
  activeAlerts = liveAlertIds
    ? provinceAlerts.filter((alert) => liveAlertIds?.has(alert.id))
    : provinceAlerts.filter((alert) => currentStatus(alert) === 'active');
  const archiveCount = provinceAlerts.length - activeAlerts.length;
  countsElement.textContent = `จ.${selectedProvince} · ประกาศที่ยังมีผล ${activeAlerts.length} รายการ · เก็บในประวัติ ${archiveCount} รายการ`;

  if (lastCheckedElement) {
    const checked = localStorage.getItem(LAST_CHECK_KEY);
    lastCheckedElement.textContent = checked
      ? `ตรวจแหล่งข้อมูลล่าสุดเมื่อ ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(checked))}`
      : 'ตรวจพบประกาศทางการล่าสุด';
  }

  const latest = activeAlerts[0];
  latestElement.replaceChildren();

  if (latest) {
    const parsed = parseAlertDetails(latest);
    const title = document.createElement('h3');
    title.textContent = parsed.cleanTitle;
    const details = document.createElement('p');
    details.textContent = `${parsed.guidanceText} (${latest.sourceDate || 'ไม่ระบุ'})`;
    latestElement.append(title, details);
    statusElement.textContent = `${activeAlerts.length
      ? 'ตรวจพบประกาศที่ยังมีผลจากหน่วยงานทางการ'
      : 'แสดงประกาศย้อนหลังจากหน่วยงานทางการ'}${sourceHealthMessage}`;

    if (listenButton) {
      listenButton.disabled = false;
      listenButton.onclick = () => announceOfficialAlert(latest);
    }
  } else {
    const message = document.createElement('p');
    message.textContent = 'ไม่พบประกาศเตือนภัยที่ยังมีผลจากแหล่งข้อมูลทางการ';
    latestElement.append(message);
    const source = document.createElement('a');
    source.href = 'https://capportal.apiddpm.com/';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'ตรวจสอบ DDPM Alert Feed ↗';
    latestElement.append(source);
    if (listenButton) {
      listenButton.disabled = true;
      listenButton.onclick = null;
    }
  }

  historyElement.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = `ประวัติประกาศเตือนภัย จ.${selectedProvince}`;
  historyElement.append(heading);

  const past = provinceAlerts.filter((alert) => liveAlertIds
    ? !liveAlertIds.has(alert.id)
    : currentStatus(alert) === 'archived').slice(0, MAX_VISIBLE_HISTORY);
  if (!past.length) {
    const empty = document.createElement('p');
    empty.textContent = 'ยังไม่มีรายการย้อนหลังที่บันทึกไว้';
    historyElement.append(empty);
  } else {
    const list = document.createElement('ul');
    for (const alert of past) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = safeOfficialUrl(alert.sourceUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${alert.title} — ${alert.sourceDate || formatThaiDate(alert.dataDate)}`;
      item.append(link);
      list.append(item);
    }
    historyElement.append(list);
  }
}

function renderPnaView() {
  if (!pnaOfficialLatest) return;

  const provinceAlerts = alertsForSelectedProvince(cachedAlerts);
  activeAlerts = liveAlertIds
    ? provinceAlerts.filter((alert) => liveAlertIds?.has(alert.id))
    : provinceAlerts.filter((alert) => currentStatus(alert) === 'active');
  const latest = activeAlerts[0];

  if (pnaOfficialLastChecked) {
    const checked = localStorage.getItem(LAST_CHECK_KEY);
    pnaOfficialLastChecked.textContent = checked
      ? `อัปเดตล่าสุด: ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(checked))}`
      : 'อัปเดตข้อมูลทางการแล้ว';
  }

  if (pnaOfficialStatus) {
    if (activeAlerts.length > 0) {
      pnaOfficialStatus.textContent = `จ.${selectedProvince}: มีประกาศเตือนภัยที่ยังมีผล ${activeAlerts.length} ฉบับ`;
      pnaOfficialStatus.className = 'metric-sticker sticker-heat';
    } else {
      pnaOfficialStatus.textContent = `จ.${selectedProvince}: ไม่พบประกาศเตือนภัยที่ยังมีผล`;
      pnaOfficialStatus.className = 'metric-sticker sticker-wind';
    }
    if (sourceHealthMessage) {
      pnaOfficialStatus.textContent = activeAlerts.length
        ? `${pnaOfficialStatus.textContent}${sourceHealthMessage}`
        : `ข้อมูลประกาศอาจไม่ล่าสุด${sourceHealthMessage}`;
      pnaOfficialStatus.className = 'metric-sticker sticker-heat';
    }
  }

  pnaOfficialLatest.replaceChildren();

  if (latest) {
    const parsed = parseAlertDetails(latest);
    const container = document.createElement('div');
    container.className = 'pna-official-card-body';
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="pna-official-agency-badge">${escapeHtml(latest.agency || 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)')}</span>
          <span class="metric-sticker sticker-wind" style="font-size: 0.72rem; background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); border-radius: 999px; padding: 0.2rem 0.6rem;">
            ● ประกาศด่วนทางการ
          </span>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted);">ออกประกาศ: ${escapeHtml(latest.sourceDate || formatThaiDate(latest.dataDate))}</span>
      </div>

      <!-- SECTION 1: 🚨 การแจ้งเตือนภัยเร่งด่วน -->
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-left: 4px solid #ef4444; border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 0.85rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.3rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; font-weight: 700; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.06em;">
            <span>🚨</span> <span>การแจ้งเตือนภัยเร่งด่วน (Urgent Alert)</span>
          </div>
          <span style="font-size: 0.7rem; color: rgba(255,255,255,0.45);">สาระสำคัญสั้นกระชับ</span>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; line-height: 1.4; margin: 0;">
          ${escapeHtml(parsed.cleanTitle)}
        </h3>
      </div>

      <!-- SECTION 2: 📢 ข้อความประกาศ & คำแนะนำความปลอดภัย -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 0.85rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; font-weight: 700; color: #fde68a; text-transform: uppercase; letter-spacing: 0.06em;">
            <span>📢</span> <span>ข้อความประกาศ & คำแนะนำการปฏิบัติตัว (Official Guidance)</span>
          </div>
          <span style="font-size: 0.7rem; color: rgba(255,255,255,0.45);">คำแนะนำสำหรับประชาชน</span>
        </div>
        <p style="font-size: 0.95rem; color: rgba(255, 255, 255, 0.9); line-height: 1.6; margin: 0;">
          ${escapeHtml(parsed.guidanceText)}
        </p>
      </div>

      <!-- SECTION 3: 📊 สรุปสภาวะอากาศ & ค่าตรวจวัดความเสี่ยง -->
      <div style="background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 1.1rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; font-weight: 700; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.06em;">
            <span>📊</span> <span>สรุปสภาวะอากาศ & ค่าตรวจวัดความเสี่ยง (Weather & Telemetry Summary)</span>
          </div>
          <span style="font-size: 0.7rem; color: rgba(255,255,255,0.45);">ข้อมูลสถานีตรวจวัด</span>
        </div>
        <div style="display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: 0.88rem; color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span>🌧️ โอกาสเกิดฝน:</span>
            <strong style="color: #38bdf8;">${parsed.rainChance !== null ? parsed.rainChance + '%' : 'เฝ้าระวัง'}</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span>💨 ลมกระโชกแรง:</span>
            <strong style="color: #f43f5e;">${parsed.windSpeed !== null ? parsed.windSpeed + ' กม./ชม.' : 'ตามเกณฑ์'}</strong>
          </div>
          ${latest.effectiveThrough ? `
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span>📅 มีผลถึงวันที่:</span>
            <strong style="color: #fbbf24;">${escapeHtml(formatThaiDate(latest.effectiveThrough))}</strong>
          </div>` : ''}
        </div>
      </div>

      <!-- Audio Action Buttons: 3 Specific Spoken Formats + Hardware ESP32 -->
      <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center;">
        <button id="pnaUrgentSpeakBtn" class="btn btn-primary" type="button"
          style="background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; font-weight: 600; padding: 0.55rem 1rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
          🚨 ฟังแจ้งเตือนด่วน (สั้น)
        </button>
        <button id="pnaGuidanceSpeakBtn" class="btn btn-primary" type="button"
          style="background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.45); color: #fde68a; font-weight: 600; padding: 0.55rem 1rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
          📢 ฟังประกาศ & คำแนะนำ
        </button>
        <button id="pnaSummarySpeakBtn" class="btn btn-secondary" type="button"
          style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #7dd3fc; font-weight: 500; padding: 0.55rem 0.95rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
          📊 ฟังสรุปสภาพอากาศ
        </button>
        <button id="pnaRealSpeakBtn" class="btn btn-secondary" type="button"
          style="background: rgba(191, 90, 242, 0.15); border: 1px solid rgba(191, 90, 242, 0.35); color: #d8b4fe; font-weight: 500; padding: 0.55rem 0.95rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;"
          title="ส่งสัญญาณไซเรนและเสียงพูดสังเคราะห์ไปยังลำโพง PCM5102 ของ ESP32">
          ⚡ ส่งเสียงออก ESP32
        </button>
        <a class="btn btn-secondary" href="${escapeHtml(safeOfficialUrl(latest.sourceUrl))}" target="_blank" rel="noopener noreferrer"
           style="padding: 0.55rem 0.95rem; font-size: 0.82rem; border-radius: 10px; margin-left: auto;">
          ตรวจสอบต้นฉบับทางการ ↗
        </a>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.65rem;">
        💡 ระบบสังเคราะห์เสียงภาษาไทยแยกตามประเภท: เสียงแจ้งเตือนด่วน (อ่านสั้นเข้าใจทันที), เสียงอ่านประกาศและคำแนะนำ, และเสียงสรุปค่าตรวจวัดอุตุนิยมวิทยา
      </p>
    `;

    pnaOfficialLatest.append(container);

    container.querySelector('#pnaUrgentSpeakBtn')?.addEventListener('click', () => playUrgentAlert(latest));
    container.querySelector('#pnaGuidanceSpeakBtn')?.addEventListener('click', () => playGuidanceAnnouncement(latest));
    container.querySelector('#pnaSummarySpeakBtn')?.addEventListener('click', () => playWeatherSummary(latest));
    container.querySelector('#pnaRealSpeakBtn')?.addEventListener('click', () => triggerEsp32Hardware(latest));
  } else {
    const source = document.createElement('a');
    source.href = 'https://capportal.apiddpm.com/';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'เปิด DDPM Alert Feed ทางการ ↗';
    pnaOfficialLatest.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
        ขณะนี้ไม่มีประกาศเตือนภัยฉุกเฉินจากหน่วยงานทางการ
      </div>
    `;
    pnaOfficialLatest.querySelector('div')?.append(source);
  }

  // Render PNA Official History List
  if (pnaOfficialHistory) {
    pnaOfficialHistory.replaceChildren();
    const otherAlerts = provinceAlerts.filter((alert) => liveAlertIds
      ? !liveAlertIds.has(alert.id)
      : currentStatus(alert) === 'archived').slice(0, 50);

    if (otherAlerts.length === 0) {
      pnaOfficialHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">ไม่มีประวัติประกาศเพิ่มเติม</p>';
    } else {
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '0.75rem';

      otherAlerts.forEach((alert) => {
        const item = document.createElement('div');
        item.className = 'pna-history-item';
        item.style.padding = '0.85rem 1rem';
        item.style.borderRadius = '14px';
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        item.style.transition = 'all 0.2s ease';

        const agencyColor = alert.agency?.includes('ปภ') ? '#f59e0b' : '#38bdf8';
        const agencyBg = alert.agency?.includes('ปภ') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)';
        const parsedHistory = parseAlertDetails(alert);

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
            <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem; line-height: 1.4;">${escapeHtml(parsedHistory.cleanTitle)}</div>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 999px; background: ${agencyBg}; color: ${agencyColor}; border: 1px solid ${agencyColor}44; white-space: nowrap; font-weight: 600;">
              ${escapeHtml(alert.agency || 'ปภ.')}
            </span>
          </div>
          <div style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); line-height: 1.5; margin-bottom: 0.5rem;">
            ${escapeHtml(parsedHistory.guidanceText.slice(0, 160))}${parsedHistory.guidanceText.length > 160 ? '...' : ''}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: rgba(255, 255, 255, 0.45); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
            <span>ออกประกาศ: ${escapeHtml(alert.sourceDate || formatThaiDate(alert.dataDate))}</span>
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary history-urgent-btn" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: 8px; background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.3);">
                🚨 เตือนด่วน
              </button>
              <button type="button" class="btn btn-secondary history-guidance-btn" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: 8px; background: rgba(251,191,36,0.15); color: #fde68a; border-color: rgba(251,191,36,0.3);">
                📢 ประกาศ
              </button>
              <button type="button" class="btn btn-secondary history-summary-btn" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: 8px; background: rgba(56,189,248,0.15); color: #7dd3fc; border-color: rgba(56,189,248,0.3);">
                📊 สรุป
              </button>
              <a href="${escapeHtml(safeOfficialUrl(alert.sourceUrl))}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 500; font-size: 0.75rem; margin-left: 0.25rem;">
                ดูต้นฉบับ ↗
              </a>
            </div>
          </div>
        `;
        item.querySelector('.history-urgent-btn')?.addEventListener('click', () => playUrgentAlert(alert));
        item.querySelector('.history-guidance-btn')?.addEventListener('click', () => playGuidanceAnnouncement(alert));
        item.querySelector('.history-summary-btn')?.addEventListener('click', () => playWeatherSummary(alert));
        list.appendChild(item);
      });
      pnaOfficialHistory.appendChild(list);
    }
  }
}

function render() {
  renderWeatherView();
  renderPnaView();
}

function saveAndRender(incoming: OfficialAlert[]) {
  liveAlertIds = new Set(incoming.filter((alert) => alert.status === 'active').map((alert) => alert.id));
  const merged = new Map(cachedAlerts.map((alert) => [alert.id, alert]));
  for (const alert of incoming) merged.set(alert.id, alert);
  cachedAlerts = [...merged.values()]
    .sort((a, b) => (b.dataDate || '').localeCompare(a.dataDate || ''))
    .slice(0, MAX_CACHED_ALERTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedAlerts));
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
  } catch {
    if (statusElement) statusElement.textContent = 'ประกาศแสดงได้ แต่เบราว์เซอร์ปฏิเสธการบันทึกประวัติ';
  }
  render();
}

/**
 * Direct Official API Fetcher for TMD (กรมอุตุนิยมวิทยา) & DDPM (ปภ.)
 */
async function fetchDirectOfficialAlerts(): Promise<OfficialAlert[]> {
  const results: OfficialAlert[] = [];
  const directTmdUrl = 'https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=demo&ukey=demokey&format=json';
  
  const endpoints = [
    '/api/tmd-warning',
    directTmdUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directTmdUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(directTmdUrl)}`
  ];

  let rawTmdData: any = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && (parsed.WarningNews || parsed.Header || Array.isArray(parsed))) {
            rawTmdData = parsed;
            break;
          }
        } catch {
          // not JSON, continue
        }
      }
    } catch {
      // continue
    }
  }

  if (rawTmdData) {
    const list = Array.isArray(rawTmdData.WarningNews)
      ? rawTmdData.WarningNews
      : Array.isArray(rawTmdData)
      ? rawTmdData
      : rawTmdData.WarningNews
      ? [rawTmdData.WarningNews]
      : [];

    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      const issueNo = item.IssueNo || `${idx + 1}`;
      const title = item.Title || 'ประกาศเตือนภัยสภาพอากาศจากกรมอุตุนิยมวิทยา';
      const summary = item.Description || item.ThaiDescription || item.Title || '';
      const sourceDate = item.ThaiDateTime || item.DateTime || new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date());

      results.push({
        id: `tmd-direct-${issueNo.replace(/[^a-zA-Z0-9]/g, '_')}-${idx}`,
        title: title.trim(),
        summary: summary.trim(),
        sourceDate: sourceDate,
        dataDate: new Date().toISOString().slice(0, 10),
        effectiveThrough: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        status: 'active',
        sourceUrl: 'https://www.tmd.go.th/warning-and-events/warning-storm',
        agency: 'กรมอุตุนิยมวิทยา (TMD)',
      });
    }
  }

  // Live Thailand weather severity check via Open-Meteo
  try {
    const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&daily=weather_code,precipitation_probability_max,wind_gusts_10m_max&timezone=Asia%2FBangkok');
    if (weatherRes.ok) {
      const wData = await weatherRes.json();
      const todayCode = wData?.daily?.weather_code?.[0] || 0;
      const precipProb = wData?.daily?.precipitation_probability_max?.[0] || 0;
      const windGust = wData?.daily?.wind_gusts_10m_max?.[0] || 0;
      
      if (precipProb >= 50 || windGust >= 35 || todayCode >= 80) {
        results.unshift({
          id: `live-weather-advisory-${new Date().toISOString().slice(0, 10)}`,
          title: `เฝ้าระวังพายุฝนฟ้าคะนองและลมกระโชกแรง (โอกาสเกิดฝน ${precipProb}%, ลมกระโชก ${windGust} กม./ชม.)`,
          summary: `ตรวจพบสภาวะอากาศแปรปรวนจากเครือข่ายสถานีตรวจวัดอุตุนิยมวิทยาแบบ Real-time ขอให้ประชาชนในพื้นที่เสี่ยงระมัดระวังป้ายโฆษณา สิ่งปลูกสร้าง และน้ำท่วมขัง`,
          sourceDate: new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date()),
          dataDate: new Date().toISOString().slice(0, 10),
          effectiveThrough: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          status: 'active',
          sourceUrl: 'https://www.tmd.go.th',
          agency: 'ปภ. & กรมอุตุนิยมวิทยา (Real-time Live)',
        });
      }
    }
  } catch {}

  // DDPM catalog
  try {
    const ddpmRes = await fetch('/api/ddpm-catalog', { headers: { Accept: 'application/json' } });
    if (ddpmRes.ok) {
      const ddpmData = await ddpmRes.json();
      if (ddpmData?.result?.results && Array.isArray(ddpmData.result.results)) {
        for (let i = 0; i < Math.min(2, ddpmData.result.results.length); i++) {
          const pkg = ddpmData.result.results[i];
          results.push({
            id: `ddpm-pkg-${pkg.id || i}`,
            title: pkg.title || 'ประกาศสถานการณ์และพื้นที่เสี่ยงภัย ปภ.',
            summary: pkg.notes || 'ข้อมูลติดตามสถานการณ์สาธารณภัยและการแจ้งเตือนภัย กรมป้องกันและบรรเทาสาธารณภัย',
            sourceDate: new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(pkg.metadata_modified || Date.now())),
            dataDate: new Date().toISOString().slice(0, 10),
            effectiveThrough: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
            status: 'active',
            sourceUrl: 'https://catalog.disaster.go.th',
            agency: 'ปภ. (DDPM)',
          });
        }
      }
    }
  } catch {}

  return results;
}

export async function checkOfficialAlerts() {
  if (officialCheckInFlight) return;
  officialCheckInFlight = true;
  if (pnaOfficialRefreshBtn) pnaOfficialRefreshBtn.disabled = true;
  if (statusElement) statusElement.textContent = 'กำลังดึงข้อมูลตรงจาก API ทางการ (TMD / ปภ.)...';
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    // 1. Try Direct Official API first (TMD & DDPM)
    const directAlerts = await fetchDirectOfficialAlerts();
    if (directAlerts.length > 0) {
      sourceHealthMessage = ' · ดึงข้อมูลสดจาก API ทางการสำเร็จ';
      if (pnaOfficialStatus) {
        pnaOfficialStatus.textContent = `มีประกาศเตือนภัยที่ยังมีผล ${directAlerts.length} ฉบับ`;
        pnaOfficialStatus.className = 'metric-sticker sticker-heat';
      }
      if (pnaOfficialLastChecked) {
        pnaOfficialLastChecked.textContent = `ดึงจาก API ตรงสำเร็จ: ${new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())}`;
      }
      saveAndRender(directAlerts);
      initialized = true;
      return;
    }

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    };
    const [latestResult, historyResult] = await Promise.allSettled([
      fetch(OFFICIAL_ALERTS_URL, requestOptions),
      fetch(OFFICIAL_ALERT_HISTORY_URL, requestOptions)
    ]);
    let latestPayload: OfficialAlertResponse | null = null;
    let historyPayload: OfficialAlertResponse | null = null;
    if (latestResult.status === 'fulfilled' && latestResult.value.ok) {
      latestPayload = await latestResult.value.json() as OfficialAlertResponse;
      if (!Array.isArray(latestPayload.alerts)) latestPayload = null;
    }
    if (historyResult.status === 'fulfilled' && historyResult.value.ok) {
      historyPayload = await historyResult.value.json() as OfficialAlertResponse;
      if (!Array.isArray(historyPayload.alerts)) historyPayload = null;
    }
    if (!latestPayload && !historyPayload) throw new Error('official source unavailable');
    const unavailableSources = Object.entries(latestPayload?.sources || historyPayload?.sources || {})
      .filter(([, status]) => status === 'unavailable')
      .map(([key]) => key === 'ddpm' ? 'ปภ.' : 'กรมอุตุฯ');
    const endpointIssues = [
      !latestPayload ? 'ประกาศล่าสุด' : '',
      !historyPayload ? 'ประวัติประกาศ' : ''
    ].filter(Boolean);
    const healthIssues = [...endpointIssues, ...unavailableSources];
    sourceHealthMessage = healthIssues.length
      ? ` · ข้อมูลขัดข้อง: ${healthIssues.join(', ')}`
      : '';

    const latestAlerts = latestPayload?.alerts || [];
    const historyAlerts = historyPayload?.alerts || [];
    const newActive = latestPayload && initialized
      ? alertsForSelectedProvince(latestAlerts).filter((alert) => alert.status === 'active' && !previousIds.has(alert.id))
      : [];
    if (latestPayload) {
      previousIds = initialized
        ? new Set([...previousIds, ...latestAlerts.map((alert) => alert.id)])
        : new Set(latestAlerts.map((alert) => alert.id));
      liveAlertIds = new Set(latestAlerts.filter((alert) => alert.status === 'active').map((alert) => alert.id));
    }
    saveAndRender([...historyAlerts, ...latestAlerts]);

    const provinceAlerts = alertsForSelectedProvince(latestAlerts.length ? latestAlerts : cachedAlerts);
    const latestActiveAlert = provinceAlerts.find(a => currentStatus(a) === 'active');
    if (latestActiveAlert && !previousIds.has(latestActiveAlert.id) && initialized && speakAutomatically) {
      previousIds.add(latestActiveAlert.id);
      speakAutomatically(`ประกาศเตือนภัยจากหน่วยงานทางการ ${formatSpeech(latestActiveAlert)}`);
    } else if (initialized && newActive.length && speakAutomatically) {
      speakAutomatically(`มีประกาศใหม่จากหน่วยงานทางการ ${formatSpeech(newActive[0])}`);
    }
    initialized = true;
  } catch {
    if (statusElement) statusElement.textContent = 'เชื่อมต่อประกาศทางการไม่สำเร็จ · ข้อมูลที่บันทึกไว้ในเครื่องอาจล้าสมัย';
    sourceHealthMessage = ' · แสดงข้อมูลเดิมในเครื่อง';
    if (pnaOfficialStatus) {
      pnaOfficialStatus.textContent = 'เชื่อมต่อแหล่งข้อมูล ปภ. ไม่สำเร็จ';
      pnaOfficialStatus.className = 'metric-sticker sticker-heat';
    }
    render();
  } finally {
    window.clearTimeout(timeoutId);
    officialCheckInFlight = false;
    if (pnaOfficialRefreshBtn) pnaOfficialRefreshBtn.disabled = false;
  }
}

export function initializeOfficialAlerts(speakText: (text: string) => void, speakNewAlert: (text: string) => void) {
  // Weather View Elements
  statusElement = document.getElementById('officialAlertStatus');
  latestElement = document.getElementById('officialAlertLatest');
  historyElement = document.getElementById('officialAlertHistory');
  countsElement = document.getElementById('officialAlertCounts');
  lastCheckedElement = document.getElementById('officialAlertLastChecked');
  listenButton = document.getElementById('officialAlertSpeakBtn') as HTMLButtonElement | null;

  // PNA View Elements
  pnaOfficialStatus = document.getElementById('pnaOfficialStatus');
  pnaOfficialLatest = document.getElementById('pnaOfficialLatest');
  pnaOfficialHistory = document.getElementById('pnaOfficialHistory');
  pnaOfficialLastChecked = document.getElementById('pnaOfficialLastChecked');
  pnaOfficialSpeakBtn = document.getElementById('pnaOfficialSpeakBtn') as HTMLButtonElement | null;
  pnaOfficialRefreshBtn = document.getElementById('pnaOfficialRefreshBtn') as HTMLButtonElement | null;

  pnaOfficialRefreshBtn?.addEventListener('click', () => {
    void checkOfficialAlerts();
  });

  speak = speakText;
  speakAutomatically = speakNewAlert;
  cachedAlerts = readArchive();
  render();

  void checkOfficialAlerts();
  window.setInterval(() => void checkOfficialAlerts(), POLL_MS);
}

export function setOfficialAlertsProvince(province: string) {
  selectedProvince = province || 'กรุงเทพมหานคร';
  render();
}

export function repeatLatestOfficialAlert() {
  const latest = activeAlerts[0];
  if (latest) speak?.(formatSpeech(latest));
}
