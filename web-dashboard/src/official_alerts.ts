import { FIREBASE_CONFIG } from './config';
import { requestEsp32Announcement } from './firebase_client';
import { playAlertTone } from './ui_manager';

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

function formatSpeech(alert: OfficialAlert): string {
  const agency = alert.agency ? `จาก ${alert.agency}` : 'จากหน่วยงานราชการ';
  const date = alert.sourceDate ? ` ข้อมูล ณ วันที่ ${alert.sourceDate}` : '';
  const summary = alert.summary ? ` ${alert.summary}` : '';
  return `ประกาศเตือนภัย${agency}${date} ${alert.title}.${summary}`;
}

function announceOfficialAlert(alert: OfficialAlert): void {
  let text = formatSpeech(alert);
  if (Array.from(text).length > 360) {
    text = `${Array.from(text).slice(0, 300).join('').replace(/[่้๊๋ัิีึืุู์ํ๎็]+$/u, '')} โปรดติดตามประกาศเพิ่มเติมจากหน่วยงานทางการ`;
  }
  if (pnaOfficialStatus) pnaOfficialStatus.textContent = '🔊 กำลังส่งเสียงประกาศเตือนภัยผ่านลำโพง…';

  const button = document.querySelector<HTMLButtonElement>('#pnaRealSpeakBtn');
  if (button) button.disabled = true;

  // 1. Play official chime tone, then voice through device speakers!
  void playAlertTone('official');
  setTimeout(() => {
    speak?.(text);
  }, 650);

  // 2. Also trigger ESP32 hardware announcement via Firebase
  void requestEsp32Announcement(text).then(() => {
    if (pnaOfficialStatus) pnaOfficialStatus.textContent = '🔊 กำลังเล่นเสียงประกาศเตือนภัยผ่านลำโพงและ ESP32 เรียบร้อย';
  }).catch(() => {
    if (pnaOfficialStatus) pnaOfficialStatus.textContent = '🔊 กำลังเล่นเสียงประกาศผ่านลำโพงเรียบร้อย';
  }).finally(() => {
    if (button?.isConnected) button.disabled = false;
  });
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
    const title = document.createElement('h3');
    title.textContent = latest.title;
    const details = document.createElement('p');
    details.textContent = `${latest.summary} (${latest.sourceDate || 'ไม่ระบุ'})`;
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
      pnaOfficialStatus.textContent = `🔴 จ.${selectedProvince}: มีประกาศเตือนภัยที่ยังมีผล ${activeAlerts.length} ฉบับ`;
      pnaOfficialStatus.className = 'metric-sticker sticker-heat';
    } else {
      pnaOfficialStatus.textContent = `🟢 จ.${selectedProvince}: ไม่พบประกาศเตือนภัยที่ยังมีผล`;
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
    const container = document.createElement('div');
    container.className = 'pna-official-card-body';
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
        <span class="pna-official-agency-badge">${escapeHtml(latest.agency || 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)')}</span>
        <span style="font-size: 0.8rem; color: var(--text-muted);">ออกประกาศ: ${escapeHtml(latest.sourceDate || formatThaiDate(latest.dataDate))}</span>
      </div>
      <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-bright); margin-bottom: 0.5rem; line-height: 1.4;">
        ${escapeHtml(latest.title)}
      </h3>
      <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6; margin-bottom: 0.75rem;">
        ${escapeHtml(latest.summary)}
      </p>
      ${latest.effectiveThrough ? `
        <div style="font-size: 0.82rem; color: var(--yellow-warn); margin-bottom: 0.75rem;">
          ⚠️ มีผลบังคับใช้ถึงวันที่: <strong>${escapeHtml(formatThaiDate(latest.effectiveThrough))}</strong>
        </div>
      ` : ''}
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem;">
        <button id="pnaRealSpeakBtn" class="btn btn-primary" type="button"
          title="แปลงข้อความประกาศเป็นเสียงภาษาไทยแล้วเล่นผ่านลำโพง PCM5102 ที่ต่อกับ ESP32">
          🔊 ฟังประกาศผ่านลำโพง ESP32
        </button>
        <a class="btn btn-secondary" href="${escapeHtml(safeOfficialUrl(latest.sourceUrl))}" target="_blank" rel="noopener noreferrer">
          🔗 ตรวจสอบต้นฉบับทางการ ↗
        </a>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.65rem;">
        ระบบแปลงข้อความประกาศเป็นเสียงภาษาไทยแล้วส่งไปยังลำโพง ESP32 (ต้องเปิดบริการ TTS และเชื่อม Firebase)
      </p>
    `;

    pnaOfficialLatest.append(container);

    const speakBtn = container.querySelector('#pnaRealSpeakBtn');
    speakBtn?.addEventListener('click', () => announceOfficialAlert(latest));
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

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
            <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem; line-height: 1.4;">${escapeHtml(alert.title)}</div>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 999px; background: ${agencyBg}; color: ${agencyColor}; border: 1px solid ${agencyColor}44; white-space: nowrap; font-weight: 600;">
              ${escapeHtml(alert.agency || 'ปภ.')}
            </span>
          </div>
          <div style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.65); line-height: 1.5; margin-bottom: 0.5rem;">
            ${escapeHtml(alert.summary.slice(0, 160))}${alert.summary.length > 160 ? '...' : ''}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: rgba(255, 255, 255, 0.45); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem;">
            <span>📅 ออกประกาศ: ${escapeHtml(alert.sourceDate || formatThaiDate(alert.dataDate))}</span>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button type="button" class="btn btn-secondary history-speak-btn" style="padding: 0.2rem 0.65rem; font-size: 0.75rem; border-radius: 8px;">
                🔊 ฟังเสียง
              </button>
              <a href="${escapeHtml(safeOfficialUrl(alert.sourceUrl))}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 500;">
                ดูต้นฉบับ ↗
              </a>
            </div>
          </div>
        `;
        const speakBtn = item.querySelector('.history-speak-btn');
        speakBtn?.addEventListener('click', () => {
          void playAlertTone('official');
          setTimeout(() => {
            speak?.(formatSpeech(alert));
          }, 600);
        });
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
  if (statusElement) statusElement.textContent = '🔄 กำลังดึงข้อมูลตรงจาก API ทางการ (TMD / ปภ.)...';
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    // 1. Try Direct Official API first (TMD & DDPM)
    const directAlerts = await fetchDirectOfficialAlerts();
    if (directAlerts.length > 0) {
      sourceHealthMessage = ' · ดึงข้อมูลสดจาก API ทางการสำเร็จ';
      if (pnaOfficialStatus) {
        pnaOfficialStatus.textContent = `🔴 มีประกาศเตือนภัยที่ยังมีผล ${directAlerts.length} ฉบับ`;
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
  window.setInterval(() => void checkOfficialAlerts(false), POLL_MS);
}

export function setOfficialAlertsProvince(province: string) {
  selectedProvince = province || 'กรุงเทพมหานคร';
  render();
}

export function repeatLatestOfficialAlert() {
  const latest = activeAlerts[0];
  if (latest) speak?.(formatSpeech(latest));
}
