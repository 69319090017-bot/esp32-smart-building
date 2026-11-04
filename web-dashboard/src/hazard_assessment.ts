import { calculateRothfuszHeatIndexC } from './weather_narration';

export interface HazardWeatherInput {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  precipitation?: number;
  weather_code?: number;
  uv_index?: number;
  wind_gusts_10m?: number;
  river_discharge?: number;
}

export type HazardBand = 'unknown' | 'normal' | 'watch' | 'warning' | 'danger' | 'very-dangerous' | 'information';

export interface HazardFinding {
  id: string;
  title: string;
  value: string;
  band: HazardBand;
  meaning: string;
  prevention: string;
  source?: { label: string; url: string };
}

export interface HazardAssessment {
  findings: HazardFinding[];
  combinations: string[];
  notes: string[];
}

const DOH_HEAT_SOURCE = { label: 'กรมอนามัย: เกณฑ์ดัชนีความร้อน', url: 'https://anamai.moph.go.th/th/news-anamai/44861' };
const WHO_UV_SOURCE = { label: 'WHO: ดัชนี UV และการป้องกัน', url: 'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-%28uv%29-index' };
const TMD_RAIN_SOURCE = { label: 'กรมอุตุนิยมวิทยา: การวัดปริมาณฝน', url: 'https://www5.tmd.go.th/info/%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%9B%E0%B8%A3%E0%B8%B4%E0%B8%A1%E0%B8%B2%E0%B8%93%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%AB%E0%B8%A3%E0%B8%B7%E0%B8%AD%E0%B8%AB%E0%B8%A2%E0%B8%B2%E0%B8%94%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%9F%E0%B9%89%E0%B8%B2' };
const TMD_STORM_SOURCE = { label: 'กรมอุตุนิยมวิทยา: พายุฝนฟ้าคะนอง', url: 'https://www.tmd.go.th/info/%E0%B8%9E%E0%B8%B2%E0%B8%A2%E0%B8%B8%E0%B8%9D%E0%B8%99%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%84%E0%B8%B0%E0%B8%99%E0%B8%AD%E0%B8%87' };

const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const format = (value: number | null, unit: string): string => value === null ? 'ไม่มีข้อมูล' : `${value.toFixed(1)} ${unit}`;

/** Uses cited thresholds only. Combined messages list independent hazards; no invented additive score. */
export function assessWeatherHazards(data: HazardWeatherInput | null | undefined): HazardAssessment {
  const weather = data || {};
  const temp = numberOrNull(weather.temperature_2m);
  const humidity = numberOrNull(weather.relative_humidity_2m);
  const heat = temp !== null && humidity !== null ? calculateRothfuszHeatIndexC(temp, humidity) : null;
  const uv = numberOrNull(weather.uv_index);
  const rain = numberOrNull(weather.precipitation);
  const code = numberOrNull(weather.weather_code);
  const gust = numberOrNull(weather.wind_gusts_10m);
  const findings: HazardFinding[] = [];

  // Department of Health categories: 27–32.9 watch, 33–41.9 warning, 42–51.9 danger, >=52 very dangerous.
  // https://anamai.moph.go.th/th/news-anamai/44861. Rothfusz calculation is documented by TMD in weather_narration.ts.
  if (heat === null) {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: 'คำนวณดัชนีความร้อนไม่ได้', band: 'unknown', meaning: 'ต้องมีข้อมูลอุณหภูมิและความชื้นก่อน ตัวเลขนี้เป็นค่าประมาณว่าคนเราอาจรู้สึกร้อนแค่ไหน ไม่ใช่อุณหภูมิที่วัดจากร่างกายหรือการวินิจฉัยโรค', prevention: 'อย่าใช้ผลนี้ยืนยันว่าปลอดภัย หากรู้สึกร้อนหรือไม่สบายให้พักในที่เย็น', source: DOH_HEAT_SOURCE });
  } else if (heat >= 52) {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: `ดัชนีความร้อน ${format(heat, '°C')}`, band: 'very-dangerous', meaning: 'อันตรายมากตามเกณฑ์กรมอนามัย ตัวเลขนี้เป็นค่าประมาณว่าคนเราอาจรู้สึกร้อนแค่ไหน ไม่ใช่อุณหภูมิที่วัดจากร่างกายหรือการวินิจฉัยโรค', prevention: 'หลีกเลี่ยงกิจกรรมกลางแจ้ง ไปอยู่ในที่เย็น ดื่มน้ำสม่ำเสมอ และช่วยดูแลผู้สูงอายุหรือผู้ที่อยู่ลำพัง', source: DOH_HEAT_SOURCE });
  } else if (heat >= 42) {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: `ดัชนีความร้อน ${format(heat, '°C')}`, band: 'danger', meaning: 'อันตรายตามเกณฑ์กรมอนามัย ตัวเลขนี้เป็นค่าประมาณว่าคนเราอาจรู้สึกร้อนแค่ไหน ไม่ใช่อุณหภูมิที่วัดจากร่างกายหรือการวินิจฉัยโรค', prevention: 'ลดเวลาทำกิจกรรมกลางแจ้ง พักในที่ร่มหรือที่เย็น และดื่มน้ำสม่ำเสมอ', source: DOH_HEAT_SOURCE });
  } else if (heat >= 33) {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: `ดัชนีความร้อน ${format(heat, '°C')}`, band: 'warning', meaning: 'ระดับเตือนภัยตามเกณฑ์กรมอนามัย ตัวเลขนี้เป็นค่าประมาณว่าคนเราอาจรู้สึกร้อนแค่ไหน ไม่ใช่อุณหภูมิที่วัดจากร่างกาย', prevention: 'ลดกิจกรรมกลางแจ้ง พักเป็นระยะ และดื่มน้ำสม่ำเสมอ', source: DOH_HEAT_SOURCE });
  } else if (heat >= 27) {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: `ดัชนีความร้อน ${format(heat, '°C')}`, band: 'watch', meaning: 'ระดับเฝ้าระวังตามเกณฑ์กรมอนามัย', prevention: 'ติดตามอาการและสภาพอากาศ โดยเฉพาะผู้สูงอายุและผู้ที่อยู่กลางแจ้งนาน', source: DOH_HEAT_SOURCE });
  } else {
    findings.push({ id: 'heat', title: 'ความร้อนร่วมกับความชื้น', value: `ดัชนีความร้อน ${format(heat, '°C')}`, band: 'normal', meaning: 'ต่ำกว่าเกณฑ์เฝ้าระวังดัชนีความร้อนของกรมอนามัย', prevention: 'ใช้ชีวิตตามปกติและติดตามอากาศต่อเนื่อง', source: DOH_HEAT_SOURCE });
  }

  // WHO UVI: protection from 3; avoid midday outdoors from 8.
  if (uv === null) findings.push({ id: 'uv', title: 'รังสี UV', value: 'ไม่มีข้อมูล', band: 'unknown', meaning: 'ประเมินการรับรังสี UV ไม่ได้', prevention: 'ตรวจดัชนี UV ก่อนออกกลางแจ้ง' });
  else if (uv >= 8) findings.push({ id: 'uv', title: 'รังสี UV', value: `ดัชนี UV ${format(uv, '')}`, band: 'danger', meaning: 'WHO แนะนำหลีกเลี่ยงการอยู่นอกอาคารช่วงกลางวันเมื่อ UV ตั้งแต่ 8', prevention: 'หลบแดดช่วงกลางวัน ใช้ร่มเงา เสื้อคลุม หมวก และแว่นกันแดด', source: WHO_UV_SOURCE });
  else if (uv >= 3) findings.push({ id: 'uv', title: 'รังสี UV', value: `ดัชนี UV ${format(uv, '')}`, band: 'warning', meaning: 'WHO แนะนำการป้องกันแสงแดดเมื่อ UV ตั้งแต่ 3', prevention: 'อยู่ในร่มช่วงกลางวัน สวมเสื้อคลุมและหมวก ใช้แว่นกันแดด', source: WHO_UV_SOURCE });
  else findings.push({ id: 'uv', title: 'รังสี UV', value: `ดัชนี UV ${format(uv, '')}`, band: 'normal', meaning: 'ต่ำกว่าเกณฑ์เริ่มแนะนำการป้องกันแดดของ WHO', prevention: 'ติดตามค่า UV หากต้องอยู่กลางแจ้งเป็นเวลานาน', source: WHO_UV_SOURCE });

  // Open-Meteo current precipitation is the preceding-hour sum. TMD hourly thresholds are 25.1 and 50.1 mm.
  if (rain === null) findings.push({ id: 'rain', title: 'ฝนในชั่วโมงก่อนหน้า', value: 'ไม่มีข้อมูล', band: 'unknown', meaning: 'ประเมินปริมาณฝนไม่ได้', prevention: 'ตรวจประกาศกรมอุตุนิยมวิทยาและสภาพพื้นที่ก่อนเดินทาง' });
  else if (rain >= 50.1) findings.push({ id: 'rain', title: 'ฝนในชั่วโมงก่อนหน้า', value: format(rain, 'มม./ชั่วโมง'), band: 'danger', meaning: 'ฝนหนักมากตามเกณฑ์กรมอุตุนิยมวิทยา ตั้งแต่ 50.1 มม. ใน 1 ชั่วโมง', prevention: 'หลีกเลี่ยงทางน้ำไหลและพื้นที่น้ำท่วมง่าย ติดตามประกาศทางการ; ค่านี้เพียงอย่างเดียวไม่ยืนยันว่าจะเกิดน้ำท่วม', source: TMD_RAIN_SOURCE });
  else if (rain >= 25.1) findings.push({ id: 'rain', title: 'ฝนในชั่วโมงก่อนหน้า', value: format(rain, 'มม./ชั่วโมง'), band: 'warning', meaning: 'ฝนหนักตามเกณฑ์กรมอุตุนิยมวิทยา 25.1–50.0 มม. ใน 1 ชั่วโมง', prevention: 'ระวังพื้นลื่น หลีกเลี่ยงจุดน้ำท่วมซ้ำซาก และติดตามประกาศทางการ', source: TMD_RAIN_SOURCE });
  else findings.push({ id: 'rain', title: 'ฝนในชั่วโมงก่อนหน้า', value: format(rain, 'มม./ชั่วโมง'), band: 'normal', meaning: rain > 0 ? 'มีฝน แต่ต่ำกว่าเกณฑ์ฝนหนักรายชั่วโมงของกรมอุตุนิยมวิทยา' : 'ไม่มีฝนในชั่วโมงก่อนหน้าตามข้อมูลนี้', prevention: 'ระวังสภาพถนนตามจริง; ค่านี้ไม่แทนประกาศเตือนภัย', source: TMD_RAIN_SOURCE });

  const thunderstorm = code !== null && code >= 95 && code <= 99;
  findings.push({ id: 'storm', title: 'สัญญาณพายุฝนฟ้าคะนอง', value: code === null ? 'ไม่มีรหัสสภาพอากาศ' : `รหัส WMO ${code}`, band: code === null ? 'unknown' : thunderstorm ? 'warning' : 'information', meaning: code === null ? 'ไม่มีข้อมูลรหัสอากาศ' : thunderstorm ? `รหัสอากาศระบุพายุฝนฟ้าคะนอง${code === 96 || code === 99 ? ' และมีลูกเห็บตามชนิดรหัส' : ''}` : 'รหัสอากาศนี้ไม่ระบุพายุฝนฟ้าคะนอง', prevention: thunderstorm ? 'เข้าอาคารแข็งแรงที่ปลอดภัยจากน้ำท่วม หลีกเลี่ยงที่โล่ง ต้นไม้ใหญ่ และสิ่งปลูกสร้างไม่แข็งแรง' : 'ติดตามประกาศเตือนภัยในพื้นที่', source: TMD_STORM_SOURCE });
  findings.push({ id: 'wind', title: 'ลมกระโชก', value: format(gust, 'กม./ชม.'), band: gust === null ? 'unknown' : 'information', meaning: 'แสดงค่าจากแบบจำลอง แต่ยังไม่มีเกณฑ์อันตรายเฉพาะพื้นที่ที่ใช้อ้างอิงในหน้านี้', prevention: 'หากมีประกาศพายุจากกรมอุตุนิยมวิทยา ให้ทำตามประกาศ; อย่าใช้ตัวเลขนี้แทนประกาศทางการ' });
  findings.push({ id: 'river', title: 'น้ำในแม่น้ำ', value: 'ยังประเมินระดับอันตรายไม่ได้', band: 'unknown', meaning: 'ค่าที่เชื่อมเป็นอัตราการไหลคาดการณ์ ไม่ใช่ระดับน้ำเทียบตลิ่ง และไม่มีเกณฑ์เฉพาะสถานี จึงสรุปว่าปลอดภัยหรือเสี่ยงไม่ได้', prevention: 'ตรวจระดับจากสถานีกรมชลประทานหรือประกาศ ปภ. ในพื้นที่ก่อนตัดสินใจ' });

  const combinations: string[] = [];
  if (heat !== null && heat >= 33 && uv !== null && uv >= 3) combinations.push('มีทั้งความร้อนระดับเตือนภัยขึ้นไปและ UV ที่ต้องป้องกัน: ลดเวลานอกอาคาร เลือกอยู่ในร่มหรือที่เย็น และสวมอุปกรณ์กันแดด');
  if (rain !== null && rain >= 25.1 && thunderstorm) combinations.push('พบฝนหนักร่วมกับรหัสพายุฝนฟ้าคะนอง: เข้าที่ปลอดภัย หลีกเลี่ยงที่โล่งและเส้นทางน้ำท่วมง่าย และติดตามประกาศในพื้นที่');
  if (combinations.length === 0) combinations.push('ยังไม่พบชุดความเสี่ยงร่วมที่มีข้อมูลและเกณฑ์ทางการรองรับในขณะนี้');

  return {
    findings,
    combinations,
    notes: [
      'ความชื้นถูกนำมาคำนวณร่วมกับอุณหภูมิเป็นดัชนีความร้อนแล้ว ไม่ตั้งเกณฑ์ความชื้นแยกขึ้นเอง',
      'ไม่รวมคะแนนความเสี่ยงจากหลายค่า เพราะไม่มีสูตรทางการรองรับการบวกคะแนนดังกล่าว',
      'ข้อมูลสภาพอากาศเป็นค่าจากแบบจำลอง Open-Meteo ไม่ใช่ประกาศเตือนภัยจาก ปภ. หรือกรมอุตุนิยมวิทยา',
      'หน้านี้ไม่มีข้อมูล PM2.5, ฟ้าผ่ารายจุด, ระดับน้ำสถานี, ฝนสะสม 24 ชั่วโมง หรือประกาศทางการสด จึงไม่ประเมินความเสี่ยงเหล่านั้น',
    ],
  };
}
