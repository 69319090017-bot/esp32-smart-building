/**
 * AI Smart Departure & Safety Advisor
 * Computes environmental conditions (UV, Heat Index, Rain, Wind Gusts, TMD Official Forecasts, IoT Home State)
 * and generates intelligent, personalized departure checklists and voice briefings.
 */

export interface AiPreparationItem {
  id: string;
  iconSvg: string;
  title: string;
  reason: string;
  category: 'sun' | 'rain' | 'heat' | 'wind' | 'home' | 'general';
  tag: string;
  tagBg: string;
  tagColor: string;
}

export interface AiDepartureAssessment {
  status: 'READY' | 'PREPARE' | 'CAUTION';
  statusLabel: string;
  statusBg: string;
  statusColor: string;
  summaryText: string;
  checklist: AiPreparationItem[];
  spokenText: string;
  metrics: {
    tempC: number;
    feelsLikeC: number;
    uvIndex: number;
    rainMm: number;
    gustKmh: number;
  };
}

export interface AiAdvisorInput {
  tempC?: number | null;
  relativeHumidity?: number | null;
  apparentTempC?: number | null;
  rainMm?: number | null;
  windGustKmh?: number | null;
  uvIndex?: number | null;
  weatherCode?: number | null;
  province?: string;
  officialAlertTitle?: string | null;
  officialAlertSummary?: string | null;
  isDoorLocked?: boolean;
}

// Icons in crisp, scalable SVG
const ICONS = {
  sunglasses: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 10a4 4 0 008 0M13 10a4 4 0 008 0M7 6l1 4M17 6l-1 4"/></svg>`,
  sunscreen: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
  umbrella: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m0-18C7.03 3 3 7.03 3 12h18c0-4.97-4.03-9-9-9zm0 18a2.5 2.5 0 01-5 0"/></svg>`,
  water: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
  clothing: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0V2H8v2m8 0H8"/></svg>`,
  wind: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1120 12H2"/></svg>`,
  homeLock: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  readyBag: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>`,
  sparkle: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z"/></svg>`
};

export function computeAiDepartureAdvice(input: AiAdvisorInput): AiDepartureAssessment {
  const province = input.province || 'สิงห์บุรี';
  const temp = Number.isFinite(input.tempC) ? Number(input.tempC) : 28.0;
  const humidity = Number.isFinite(input.relativeHumidity) ? Number(input.relativeHumidity) : 65.0;
  const apparent = Number.isFinite(input.apparentTempC) ? Number(input.apparentTempC) : temp;
  const rain = Number.isFinite(input.rainMm) ? Number(input.rainMm) : 0;
  const gust = Number.isFinite(input.windGustKmh) ? Number(input.windGustKmh) : 10;
  const uv = Number.isFinite(input.uvIndex) ? Number(input.uvIndex) : 0;
  const weatherCode = Number.isFinite(input.weatherCode) ? Number(input.weatherCode) : 0;
  const isDoorLocked = input.isDoorLocked !== false;

  const checklist: AiPreparationItem[] = [];

  // Check TMD official alerts
  const officialAlertText = ((input.officialAlertTitle || '') + ' ' + (input.officialAlertSummary || '')).toLowerCase();
  const hasOfficialStormAlert = officialAlertText.includes('พายุ') || officialAlertText.includes('ฝน') || officialAlertText.includes('ลมกระโชกแรง');

  // 1. SUN & UV RADIATION
  if (uv >= 6.0) {
    checklist.push({
      id: 'item-sunglasses',
      iconSvg: ICONS.sunglasses,
      title: 'แว่นกันแดด & หมวกปีกกว้าง',
      reason: `แดดจ้า รังสี UV สูงระดับ ${uv.toFixed(1)} (เกณฑ์ WHO แดดแรง ควรปกป้องสายตาและใบหน้า)`,
      category: 'sun',
      tag: `UV ${uv.toFixed(1)} สูง`,
      tagBg: 'rgba(255, 159, 10, 0.15)',
      tagColor: '#ff9f0a'
    });
    checklist.push({
      id: 'item-sunscreen',
      iconSvg: ICONS.sunscreen,
      title: 'ทาครีมกันแดด SPF 30+',
      reason: 'ทาก่อนออกแดด 15 นาที ช่วยป้องกันผิวไหม้เกรียมและรังสี UV ทำร้ายผิว',
      category: 'sun',
      tag: 'ปกป้องผิว',
      tagBg: 'rgba(255, 159, 10, 0.15)',
      tagColor: '#ff9f0a'
    });
  } else if (uv >= 3.0) {
    checklist.push({
      id: 'item-sunscreen',
      iconSvg: ICONS.sunscreen,
      title: 'ทาครีมกันแดด / ร่มกันแดด',
      reason: `รังสี UV ปานกลาง (${uv.toFixed(1)}) แนะนำปกป้องผิวหากต้องอยู่กลางแจ้งนานเกิน 30 นาที`,
      category: 'sun',
      tag: `UV ${uv.toFixed(1)} ปานกลาง`,
      tagBg: 'rgba(56, 189, 248, 0.15)',
      tagColor: '#38bdf8'
    });
  }

  // 2. RAIN & STORM PRECAUTIONS
  if (rain > 0) {
    checklist.push({
      id: 'item-umbrella',
      iconSvg: ICONS.umbrella,
      title: 'พกร่มหรือเสื้อกันฝน',
      reason: `ขณะนี้มีฝนตกในพื้นที่ (${rain.toFixed(1)} มม./ชม.) ระวังพื้นผิวถนนลื่น`,
      category: 'rain',
      tag: 'ฝนตกขณะนี้',
      tagBg: 'rgba(14, 165, 233, 0.2)',
      tagColor: '#38bdf8'
    });
  } else if (hasOfficialStormAlert) {
    checklist.push({
      id: 'item-umbrella',
      iconSvg: ICONS.umbrella,
      title: 'พกร่มพับติดตัวไว้ด้วย',
      reason: 'ขณะนี้แดดยังออก แต่กรมอุตุฯ เฝ้าระวังพายุฝนฟ้าคะนองช่วงบ่าย-ค่ำ',
      category: 'rain',
      tag: 'เฝ้าระวังฝนช่วงบ่าย',
      tagBg: 'rgba(255, 159, 10, 0.15)',
      tagColor: '#ff9f0a'
    });
  } else if (weatherCode >= 51 && weatherCode <= 99) {
    checklist.push({
      id: 'item-umbrella',
      iconSvg: ICONS.umbrella,
      title: 'พกร่มพับติดตัว',
      reason: 'แบบจำลองตรวจพบกลุ่มเมฆฝน อาจมีฝนตกเป็นช่วงๆ ตลอดวัน',
      category: 'rain',
      tag: 'โอกาสมีฝน',
      tagBg: 'rgba(14, 165, 233, 0.15)',
      tagColor: '#38bdf8'
    });
  }

  // 3. HEAT & HYDRATION
  if (apparent >= 32.0 || temp >= 31.0) {
    checklist.push({
      id: 'item-water',
      iconSvg: ICONS.water,
      title: 'พกกระบอกน้ำดื่ม',
      reason: `อุณหภูมิที่รู้สึก ${apparent.toFixed(1)}°C อากาศค่อนข้างอบอ้าว ควรจิบน้ําบ่อยๆ ป้องกันร่างกายขาดน้ำ`,
      category: 'heat',
      tag: 'ป้องกันเพลียแดด',
      tagBg: 'rgba(249, 115, 22, 0.15)',
      tagColor: '#f97316'
    });
    checklist.push({
      id: 'item-clothing',
      iconSvg: ICONS.clothing,
      title: 'สวมเสื้อผ้าโปร่งสบาย',
      reason: 'เลือกเสื้อผ้าที่ระบายอากาศและเหงื่อได้ดี ไม่อับชื้นท่ามกลางแดดร้อน',
      category: 'heat',
      tag: 'ระบายความร้อน',
      tagBg: 'rgba(148, 163, 184, 0.15)',
      tagColor: '#94a3b8'
    });
  }

  // 4. WIND GUSTS
  if (gust >= 40.0) {
    checklist.push({
      id: 'item-wind',
      iconSvg: ICONS.wind,
      title: 'ระมัดระวังลมกระโชกแรง',
      reason: `ตรวจพบความเร็วลมกระโชก ${gust.toFixed(1)} กม./ชม. หลีกเลี่ยงจอดรถใต้ต้นไม้ใหญ่หรือป้ายโฆษณา`,
      category: 'wind',
      tag: `ลม ${gust.toFixed(0)} กม./ชม.`,
      tagBg: 'rgba(239, 68, 68, 0.15)',
      tagColor: '#ef4444'
    });
  }

  // 5. SMART HOME SECURITY STATUS
  checklist.push({
    id: 'item-home',
    iconSvg: ICONS.homeLock,
    title: isDoorLocked ? 'ตรวจเช็คบ้าน: ปลอดภัย' : 'ตรวจเช็คบ้าน: ประตูยังไม่ล็อค',
    reason: isDoorLocked
      ? 'ระบบล็อคประตูอัจฉริยะล็อคสนิท และเซนเซอร์ในบ้านเฝ้าระวังปกติ 100%'
      : '⚠️ ตรวจพบประตูดิจิทัลยังปลดล็อคอยู่ แนะนำกดสั่งล็อคจาก Dashboard ก่อนออกเดินทาง',
    category: 'home',
    tag: isDoorLocked ? 'IoT บ้านปลอดภัย' : 'แจ้งเตือนประตู',
    tagBg: isDoorLocked ? 'rgba(48, 209, 88, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    tagColor: isDoorLocked ? '#30d158' : '#ef4444'
  });

  // Default fallback if mild weather
  if (checklist.length <= 1) {
    checklist.unshift({
      id: 'item-general',
      iconSvg: ICONS.readyBag,
      title: 'สัมภาระและของใช้ส่วนตัว',
      reason: 'สภาพอากาศแจ่มใส ปลอดภัย พร้อมสำหรับการเดินทางและดำเนินกิจกรรมกลางแจ้งตามปกติ',
      category: 'general',
      tag: 'สภาพอากาศปกติ',
      tagBg: 'rgba(48, 209, 88, 0.15)',
      tagColor: '#30d158'
    });
  }

  // Determine overall AI status
  let status: 'READY' | 'PREPARE' | 'CAUTION' = 'READY';
  let statusLabel = '🟢 สภาพอากาศพร้อมเดินทาง';
  let statusBg = 'rgba(48, 209, 88, 0.15)';
  let statusColor = '#30d158';

  if (rain >= 10.0 || gust >= 50.0) {
    status = 'CAUTION';
    statusLabel = '🔴 ควรระวังภัยสภาพอากาศ';
    statusBg = 'rgba(239, 68, 68, 0.15)';
    statusColor = '#ef4444';
  } else if (uv >= 6.0 || hasOfficialStormAlert || rain > 0 || apparent >= 35.0) {
    status = 'PREPARE';
    statusLabel = '🟡 แนะนำเตรียมอุปกรณ์ป้องกัน';
    statusBg = 'rgba(255, 159, 10, 0.15)';
    statusColor = '#ff9f0a';
  }

  // Generate natural AI Summary Text
  let summaryText = '';
  if (rain > 0) {
    summaryText = `ขณะนี้ใน จ.${province} มีฝนตกในพื้นที่ (${rain.toFixed(1)} มม./ชม.) อุณหภูมิ ${temp.toFixed(1)}°C อากาศค่อนข้างชื้นและถนนอาจลื่น`;
  } else if (uv >= 6.0 && hasOfficialStormAlert) {
    summaryText = `ขณะนี้ใน จ.${province} ท้องฟ้าโปร่ง แดดจ้า อุณหภูมิ ${temp.toFixed(1)}°C (รู้สึกเหมือน ${apparent.toFixed(1)}°C) แต่รังสี UV สูงระดับ ${uv.toFixed(1)} และกรมอุตุฯ มีประกาศเฝ้าระวังพายุฝนช่วงบ่าย-ค่ำ`;
  } else if (uv >= 6.0) {
    summaryText = `ขณะนี้ใน จ.${province} แดดสว่างจ้า ท้องฟ้าโปร่ง อุณหภูมิ ${temp.toFixed(1)}°C แต่รังสี UV สูง (${uv.toFixed(1)}) ควรป้องกันผิวและสายตา`;
  } else if (hasOfficialStormAlert) {
    summaryText = `ขณะนี้ใน จ.${province} สภาพอากาศโดยรวมยังปกติ แต่มีประกาศกรมอุตุฯ เฝ้าระวังพายุฝนฟ้าคะนองช่วงบ่าย แนะนำพกร่มพับเผื่อไว้`;
  } else {
    summaryText = `ขณะนี้ใน จ.${province} สภาพอากาศดี ท้องฟ้าแจ่มใส อุณหภูมิ ${temp.toFixed(1)}°C สภาวะโดยรวมปลอดภัยสำหรับการดำเนินกิจกรรมกลางแจ้ง`;
  }

  // Generate smooth, pleasant spoken AI script
  const spokenParts: string[] = [];
  spokenParts.push(`สวัสดีครับ AI ได้ประเมินสภาพแวดล้อมวันนี้ให้แล้วครับ สำหรับจังหวัด${province}`);

  if (rain > 0) {
    spokenParts.push(`ขณะนี้มีฝนตกในพื้นที่ ${rain.toFixed(1)} มิลลิเมตรต่อชั่วโมง อุณหภูมิ ${temp.toFixed(0)} องศาเซลเซียส อย่าลืมพกร่มหรือเสื้อกันฝน และเดินทางระมัดระวังถนนลื่นนะครับ`);
  } else if (uv >= 6.0 && hasOfficialStormAlert) {
    spokenParts.push(`ตอนนี้ท้องฟ้าโปร่ง แดดค่อนข้างแรง อุณหภูมิ ${temp.toFixed(0)} องศาเซลเซียส แต่รังสียูวีสูงที่ระดับ ${uv.toFixed(0)} ก่อนออกจากบ้านแนะนำให้ทาครีมกันแดดและสวมแว่นตานะครับ นอกจากนี้ กรมอุตุนิยมวิทยามีเฝ้าระวังพายุฝนฟ้าคะนองช่วงบ่าย แนะนำพกร่มพับติดตัวไว้ด้วยนะครับ`);
  } else if (uv >= 6.0) {
    spokenParts.push(`ตอนนี้แดดจัด ท้องฟ้าโปร่ง อุณหภูมิ ${temp.toFixed(0)} องศาเซลเซียส รังสียูวีค่อนข้างแรงที่ระดับ ${uv.toFixed(0)} แนะนำให้ทาครีมกันแดดและสวมแว่นตากันแดดก่อนออกกลางแจ้งนะครับ`);
  } else if (hasOfficialStormAlert) {
    spokenParts.push(`ตอนนี้สภาพอากาศแจ่มใสดีครับ แต่ช่วงบ่ายกรมอุตุนิยมวิทยามีประกาศเฝ้าระวังพายุฝนฟ้าคะนอง แนะนำให้พกร่มพับติดตัวไว้เผื่อฝนตกนะครับ`);
  } else {
    spokenParts.push(`วันนี้สภาพอากาศแจ่มใส ปลอดภัย อุณหภูมิ ${temp.toFixed(0)} องศาเซลเซียส พร้อมสำหรับกิจกรรมกลางแจ้งครับ`);
  }

  if (apparent >= 33.0) {
    spokenParts.push(`และอากาศค่อนข้างร้อนอบอ้าว อย่าลืมพกน้ำดื่มจิบบ่อยๆ ด้วยนะครับ`);
  }

  if (isDoorLocked) {
    spokenParts.push(`ระบบความปลอดภัยในบ้านล็อคเรียบร้อย ขอให้เดินทางราบรื่นและปลอดภัยตลอดวันครับ`);
  } else {
    spokenParts.push(`แต่อย่าลืมกดล็อคประตูดิจิทัลก่อนออกจากบ้านด้วยนะครับ ขอให้เดินทางปลอดภัยครับ`);
  }

  const spokenText = spokenParts.join(' ');

  return {
    status,
    statusLabel,
    statusBg,
    statusColor,
    summaryText,
    checklist,
    spokenText,
    metrics: {
      tempC: temp,
      feelsLikeC: apparent,
      uvIndex: uv,
      rainMm: rain,
      gustKmh: gust
    }
  };
}
