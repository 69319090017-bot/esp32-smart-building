export interface NarrationWeatherData {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  weather_code?: number;
}

export interface WeatherNarrationInput {
  mode: 'live' | 'demo';
  province: string;
  data: NarrationWeatherData | null;
  /** Provider observation time; do not use fetch or cache time. */
  observedAt?: string | Date | null;
  /** Required policy input; this function does not invent a freshness limit. */
  maxAgeMinutes: number;
  sourceLabel?: string;
  now?: Date;
}

const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function thaiInteger(value: number): string {
  if (value === 0) return digits[0];
  if (value >= 1_000_000) {
    const millions = Math.floor(value / 1_000_000);
    const remainder = value % 1_000_000;
    return thaiInteger(millions) + 'ล้าน' + (remainder ? thaiInteger(remainder) : '');
  }
  const parts = String(value).split('').map(Number);
  return parts.map((digit, index) => {
    const place = parts.length - index - 1;
    if (digit === 0) return '';
    if (place === 1 && digit === 1) return 'สิบ';
    if (place === 1 && digit === 2) return 'ยี่สิบ';
    if (place === 0 && digit === 1 && parts.length > 1 && parts[parts.length - 2] !== 0) return 'เอ็ด';
    return digits[digit] + (places[place] || '');
  }).join('');
}

function thaiNumber(value: number): string {
  if (!Number.isFinite(value)) return 'ไม่ทราบ';
  const sign = value < 0 ? 'ลบ' : '';
  const parts = Math.abs(value).toFixed(1).split('.');
  return sign + thaiInteger(Number(parts[0])) + 'จุด' + digits[Number(parts[1])];
}

function thaiTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return thaiInteger(hour) + ' นาฬิกา ' + thaiInteger(minute) + ' นาที';
}

/**
 * Rothfusz regression Heat Index. Convert Celsius to Fahrenheit for the
 * regression, then convert the result back to Celsius. Source: TMD document
 * "ความรู้เรื่องดัชนีความร้อน" (Rothfusz, 1990a),
 * https://www.rnd.tmd.go.th/doc/public/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%9C%E0%B8%A2%E0%B9%81%E0%B8%9E%E0%B8%A3%E0%B9%88%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B8%B9%E0%B9%89_%E0%B8%84%E0%B9%88%E0%B8%B2%E0%B8%94%E0%B8%B1%E0%B8%8A%E0%B8%99%E0%B8%B5%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%99%2824AUG%29.pdf
 */
export function calculateRothfuszHeatIndexC(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(relativeHumidity)
      || relativeHumidity < 0 || relativeHumidity > 100) return null;

  const t = temperatureC * 9 / 5 + 32;
  const r = relativeHumidity;
  if (t < 80 || r < 40) return null;

  let hi = -42.379 + 2.04901523 * t + 10.14333127 * r
    - 0.22475541 * t * r - 0.00683783 * t * t - 0.05481717 * r * r
    + 0.00122874 * t * t * r + 0.00085282 * t * r * r
    - 0.00000199 * t * t * r * r;
  if (r < 13 && t <= 112) {
    hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (r > 85 && t <= 87) {
    hi += ((r - 85) / 10) * ((87 - t) / 5);
  }
  return (hi - 32) * 5 / 9;
}

function validWeather(data: NarrationWeatherData | null): data is Required<NarrationWeatherData> {
  return Boolean(data)
    && Number.isFinite(data?.temperature_2m)
    && Number.isFinite(data?.relative_humidity_2m)
    && Number.isFinite(data?.precipitation)
    && Number.isFinite(data?.weather_code);
}

function unavailable(mode: WeatherNarrationInput['mode']): string {
  return (mode === 'demo' ? 'นี่คือข้อมูลตัวอย่าง. ' : '')
    + 'ขณะนี้ไม่มีข้อมูลล่าสุด จึงยังสรุปคำแนะนำตามสภาพอากาศไม่ได้';
}

export function buildWeatherNarration(input: WeatherNarrationInput): string {
  if (!Number.isFinite(input.maxAgeMinutes) || input.maxAgeMinutes <= 0) {
    throw new RangeError('maxAgeMinutes must be a positive finite number');
  }
  if (!validWeather(input.data)) return unavailable(input.mode);

  const data = input.data;
  const heat = calculateRothfuszHeatIndexC(data.temperature_2m, data.relative_humidity_2m);
  const demo = input.mode === 'demo' ? 'นี่คือข้อมูลตัวอย่าง. ' : '';
  let provenance = '';

  if (input.mode === 'live') {
    const observedText = typeof input.observedAt === "string" ? input.observedAt : null;
    const hasZone = observedText ? /([zZ]|[+-][0-9]{2}:[0-9]{2})$/.test(observedText) : false;
    const parsedObservation = observedText && !hasZone ? new Date(observedText + "+07:00") : null;
    const observed = input.observedAt instanceof Date
      ? input.observedAt
      : observedText ? (hasZone ? new Date(observedText) : parsedObservation) : null;
    const now = input.now || new Date();
    if (!observed || !Number.isFinite(observed.getTime()) || observed.getTime() > now.getTime()) {
      return unavailable(input.mode);
    }
    const age = now.getTime() - observed.getTime();
    if (age > input.maxAgeMinutes * 60_000) return unavailable(input.mode);
    provenance = 'ข้อมูลจาก ' + (input.sourceLabel?.trim() || 'โอเพนเมทีโอ')
      + ' ณ เวลา ' + thaiTime(observed) + ' อายุข้อมูล '
      + thaiInteger(Math.ceil(age / 60_000)) + ' นาที. ';
  }

  // Thai Department of Health Heat Index categories (2026): watch 27–32.9 C, warning 33–41.9 C, danger 42–51.9 C, very dangerous from 52 C.
  // Source: https://www.anamai.go.th/th/news-anamai/44861
  let status: string;
  let action: string;
  let supplies: string;
  let danger: string;
  if (heat !== null && heat >= 52) {
    status = 'อากาศร้อนอันตรายมาก รู้สึกเหมือน ' + thaiNumber(heat) + ' องศาเซลเซียส.';
    action = 'ควรหยุดกิจกรรมกลางแจ้งและไปพักในที่เย็น.';
    supplies = 'เตรียมน้ำดื่ม.';
    danger = 'ความเสี่ยงคือผลกระทบจากความร้อน.';
  } else if (heat !== null && heat >= 42) {
    status = 'อากาศร้อนอันตราย รู้สึกเหมือน ' + thaiNumber(heat) + ' องศาเซลเซียส.';
    action = 'ควรหลีกเลี่ยงกิจกรรมกลางแจ้งและพักในที่เย็น.';
    supplies = 'เตรียมน้ำดื่มและหมวก.';
    danger = 'ความเสี่ยงคือผลกระทบจากความร้อน.';
  } else if (heat !== null && heat >= 33) {
    status = 'อากาศร้อนระดับเตือนภัย รู้สึกเหมือน ' + thaiNumber(heat) + ' องศาเซลเซียส.';
    action = 'ควรลดกิจกรรมกลางแจ้งและพักเป็นระยะ.';
    supplies = 'เตรียมน้ำดื่มและหมวก.';
    danger = 'ความเสี่ยงคือการเจ็บป่วยจากความร้อน.';
  } else if (data.precipitation > 0 || rainyCode(data.weather_code)) {
    status = 'มีฝนในข้อมูลอากาศ.';
    action = 'ควรหาที่หลบฝนและเดินทางระมัดระวัง.';
    supplies = 'เตรียมร่มหรือเสื้อกันฝน.';
    danger = 'ความเสี่ยงคือพื้นลื่น.';
  } else {
    status = 'อากาศโดยรวมปกติ.';
    action = 'ทำกิจกรรมได้ตามปกติและติดตามข้อมูล.';
    supplies = 'เตรียมน้ำดื่ม.';
    danger = 'ยังไม่พบความเสี่ยงเด่นในข้อมูลนี้.';
  }

  return provenance + demo + 'จังหวัด' + input.province + ' สถานะ ' + status
    + ' ควรทำ ' + action + ' เตรียมอะไร ' + supplies + ' อันตราย ' + danger;
}

function rainyCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
}



