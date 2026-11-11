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

const DOH_HEAT_SOURCE = { label: 'กรมอนามัย & NOAA: เกณฑ์ดัชนีความร้อนสากล', url: 'https://anamai.moph.go.th/th/news-anamai/44861' };
const WHO_UV_SOURCE = { label: 'WHO & WMO: ดัชนี UV สากล (Global Solar UV Index)', url: 'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-%28uv%29-index' };
const WMO_WIND_SOURCE = { label: 'WMO & กรมอุตุนิยมวิทยา: เกณฑ์ลมกระโชกและมาตราโบฟอร์ต (Beaufort Scale)', url: 'https://www.tmd.go.th' };
const TMD_RAIN_SOURCE = { label: 'กรมอุตุนิยมวิทยา & WMO: เกณฑ์ปริมาณฝนรายชั่วโมง', url: 'https://www5.tmd.go.th/info/%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%9B%E0%B8%A3%E0%B8%B4%E0%B8%A1%E0%B8%B2%E0%B8%93%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%AB%E0%B8%A3%E0%B8%B7%E0%B8%AD%E0%B8%AB%E0%B8%A2%E0%B8%B2%E0%B8%94%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%9F%E0%B9%89%E0%B8%B2' };
const TMD_STORM_SOURCE = { label: 'WMO & กรมอุตุนิยมวิทยา: พายุฝนฟ้าคะนองและลูกเห็บ', url: 'https://www.tmd.go.th/info/%E0%B8%9E%E0%B8%B2%E0%B8%A2%E0%B8%B8%E0%B8%9D%E0%B8%99%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%84%E0%B8%B0%E0%B8%99%E0%B8%AD%E0%B8%87' };
const GLOFAS_RIVER_SOURCE = { label: 'GloFAS & Copernicus ECMWF: แบบจำลองการไหลของน้ำระดับโลก', url: 'https://www.globalfloods.eu/' };

const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const format = (value: number | null, unit: string): string => value === null ? 'ไม่มีข้อมูล' : `${value.toFixed(1)} ${unit}`;

/**
 * Assess weather hazards across 6 critical dimensions using global consensus benchmarks:
 * WMO, WHO, NOAA NWS, Thai Department of Health, TMD, and GloFAS/Copernicus.
 */
export function assessWeatherHazards(data: HazardWeatherInput | null | undefined): HazardAssessment {
  const weather = data || {};
  const temp = numberOrNull(weather.temperature_2m);
  const humidity = numberOrNull(weather.relative_humidity_2m);
  const apparent = numberOrNull(weather.apparent_temperature);
  const rothfuszHeat = temp !== null && humidity !== null ? calculateRothfuszHeatIndexC(temp, humidity) : null;
  // If temp is mild (<27°C), heat index danger does not trigger; fallback to apparent or ambient temp
  const heat = rothfuszHeat !== null ? rothfuszHeat : (temp !== null && temp < 27 ? temp : (apparent ?? temp));
  
  const uv = numberOrNull(weather.uv_index);
  const rain = numberOrNull(weather.precipitation);
  const code = numberOrNull(weather.weather_code);
  const gust = numberOrNull(weather.wind_gusts_10m);
  const discharge = numberOrNull(weather.river_discharge);
  const findings: HazardFinding[] = [];

  // =========================================================================
  // 1. HEAT INDEX (NOAA NWS & กรมอนามัย กระทรวงสาธารณสุข)
  // =========================================================================
  if (heat === null) {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: 'ไม่มีข้อมูลอุณหภูมิ', 
      band: 'unknown', 
      meaning: 'ต้องมีข้อมูลอุณหภูมิและความชื้นสัมพัทธ์ในการคำนวณ', 
      prevention: 'ตรวจวัดอุณหภูมิและหลีกเลี่ยงการอยู่ในที่ร้อนอบอ้าว', 
      source: DOH_HEAT_SOURCE 
    });
  } else if (heat >= 52) {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: `${format(heat, '°C')}`, 
      band: 'very-dangerous', 
      meaning: 'อันตรายมากระดับวิกฤต (Extreme Danger ≥52°C) เสี่ยงโรคลมแดด (Heat Stroke) เฉียบพลันขั้นรุนแรง', 
      prevention: 'หลีกเลี่ยงกิจกรรมกลางแจ้งเด็ดขาด อยู่ในห้องปรับอากาศหรือที่ร่ม และดื่มน้ำสม่ำเสมอ', 
      source: DOH_HEAT_SOURCE 
    });
  } else if (heat >= 42) {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: `${format(heat, '°C')}`, 
      band: 'danger', 
      meaning: 'ระดับอันตราย (Danger 42–51.9°C) เสี่ยงเกิดตะคริวแดด เพลียแดด และลมแดด', 
      prevention: 'ลดเวลาทำกิจกรรมกลางแจ้ง พักในที่ร่มหรือที่เย็น และจิบน้ำบ่อยๆ', 
      source: DOH_HEAT_SOURCE 
    });
  } else if (heat >= 33) {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: `${format(heat, '°C')}`, 
      band: 'warning', 
      meaning: 'ระดับเตือนภัย (Warning 33–41.9°C) ร่างกายสูญเสียเหงื่อเร็ว อาจอ่อนเพลีย', 
      prevention: 'ลดกิจกรรมหนักกลางแจ้ง ดื่มน้ำให้เพียงพอ และพักผ่อนเป็นระยะ', 
      source: DOH_HEAT_SOURCE 
    });
  } else if (heat >= 27) {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: `${format(heat, '°C')}`, 
      band: 'watch', 
      meaning: 'ระดับเฝ้าระวัง (Watch 27–32.9°C) เริ่มรู้สึกร้อน', 
      prevention: 'ทำกิจกรรมได้ปกติ ควรสังเกตอาการหากทำงานกลางแจ้งเป็นเวลานาน', 
      source: DOH_HEAT_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'heat', 
      title: 'ดัชนีความร้อน', 
      value: `${format(heat, '°C')}`, 
      band: 'normal', 
      meaning: 'สภาวะสบาย อุณหภูมิและความชื้นอยู่ในเกณฑ์ปกติ (<27°C)', 
      prevention: 'สภาวะอากาศปกติ ดำเนินชีวิตและกิจกรรมกลางแจ้งได้ตามปกติ', 
      source: DOH_HEAT_SOURCE 
    });
  }

  // =========================================================================
  // 2. UV INDEX (WHO & WMO Global Solar UV Index Standard)
  // =========================================================================
  if (uv === null) {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: 'ไม่มีข้อมูล', 
      band: 'unknown', 
      meaning: 'ประเมินการรับรังสี UV ไม่ได้', 
      prevention: 'ตรวจดัชนี UV ก่อนออกกลางแจ้ง', 
      source: WHO_UV_SOURCE 
    });
  } else if (uv >= 11) {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: `ดัชนี UV ${format(uv, '')}`, 
      band: 'very-dangerous', 
      meaning: 'ระดับวิกฤต/อันตรายสุดขีด (Extreme ≥11) ตามเกณฑ์ WHO ผิวไหม้แดดใน 5–10 นาที', 
      prevention: 'งดออกแดดเด็ดขาด สวมแว่นกันแดด UV400 เสื้อคลุมแขนยาว หมวกปีกกว้าง', 
      source: WHO_UV_SOURCE 
    });
  } else if (uv >= 8) {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: `ดัชนี UV ${format(uv, '')}`, 
      band: 'danger', 
      meaning: 'ระดับสูงมาก (Very High 8–10.9) ตามเกณฑ์ WHO ผิวไหม้แดดใน 15 นาที', 
      prevention: 'หลีกเลี่ยงแดดจัดช่วง 10:00–16:00 ทาครีมกันแดด SPF 30+ สวมหมวกและแว่นกันแดด', 
      source: WHO_UV_SOURCE 
    });
  } else if (uv >= 6) {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: `ดัชนี UV ${format(uv, '')}`, 
      band: 'warning', 
      meaning: 'ระดับสูง (High 6–7.9) ตามเกณฑ์ WHO แดดแรง ผิวไหม้แดดได้ใน 30 นาที', 
      prevention: 'หลบแดดช่วงเที่ยง สวมเสื้อแขนยาวและทาครีมกันแดดป้องกันผิว', 
      source: WHO_UV_SOURCE 
    });
  } else if (uv >= 3) {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: `ดัชนี UV ${format(uv, '')}`, 
      band: 'watch', 
      meaning: 'ระดับปานกลาง (Moderate 3–5.9) ตามเกณฑ์ WHO เริ่มส่งผลต่อผิวหนัง', 
      prevention: 'ทาครีมกันแดดและสวมหมวกหากต้องอยู่กลางแจ้งนาน', 
      source: WHO_UV_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'uv', 
      title: 'รังสี UV', 
      value: `ดัชนี UV ${format(uv, '')}`, 
      band: 'normal', 
      meaning: 'ระดับต่ำและปลอดภัย (Low 0–2.9) ตามเกณฑ์ WHO ไม่เป็นอันตรายต่อผิวหนัง', 
      prevention: 'ทำกิจกรรมกลางแจ้งได้ปลอดภัย ไม่จำเป็นต้องใช้อุปกรณ์ป้องกันพิเศษ', 
      source: WHO_UV_SOURCE 
    });
  }

  // =========================================================================
  // 3. WIND GUSTS (WMO Beaufort Scale & กรมอุตุนิยมวิทยา TMD)
  // =========================================================================
  if (gust === null) {
    findings.push({ 
      id: 'wind', 
      title: 'ลมกระโชก', 
      value: 'ไม่มีข้อมูล', 
      band: 'unknown', 
      meaning: 'ไม่มีข้อมูลความเร็วลมกระโชก', 
      prevention: 'ตรวจสอบสภาวะลมก่อนทำกิจกรรมในที่สูง', 
      source: WMO_WIND_SOURCE 
    });
  } else if (gust >= 89) {
    findings.push({ 
      id: 'wind', 
      title: 'ลมกระโชก', 
      value: format(gust, 'กม./ชม.'), 
      band: 'very-dangerous', 
      meaning: 'วิกฤตพายุรุนแรง (Storm ≥89 กม./ชม. Beaufort 10+) ต้นไม้หักโค่น เสาไฟและโครงสร้างเสียหาย', 
      prevention: 'หลบในอาคารคอนกรีตที่มั่นคงทันที ระวังหลังคาปลิวและวัตถุตกหล่น', 
      source: WMO_WIND_SOURCE 
    });
  } else if (gust >= 62) {
    findings.push({ 
      id: 'wind', 
      title: 'ลมกระโชก', 
      value: format(gust, 'กม./ชม.'), 
      band: 'danger', 
      meaning: 'ลมกระโชกแรงอันตราย (Gale 62–88.9 กม./ชม. Beaufort 8-9) กิ่งไม้ใหญ่หัก ป้ายโฆษณาเสี่ยงพัง', 
      prevention: 'หลีกเลี่ยงการอยู่ใกล้ต้นไม้ใหญ่ ป้ายโฆษณา และโครงสร้างชั่วคราวที่ไม่แข็งแรง', 
      source: WMO_WIND_SOURCE 
    });
  } else if (gust >= 40) {
    findings.push({ 
      id: 'wind', 
      title: 'ลมกระโชก', 
      value: format(gust, 'กม./ชม.'), 
      band: 'warning', 
      meaning: 'ลมแรงระดับเฝ้าระวัง (Strong Breeze 40–61.9 กม./ชม. Beaufort 6-7) ร่มต้านลมยาก ของเบาปลิว', 
      prevention: 'ระวังสิ่งของน้ำหนักเบาปลิวตกหล่น ตรวจความมั่นคงของกันสาดรอบบ้าน', 
      source: WMO_WIND_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'wind', 
      title: 'ลมกระโชก', 
      value: format(gust, 'กม./ชม.'), 
      band: 'normal', 
      meaning: 'ความเร็วลมปกติ (<40 กม./ชม.) สภาวะลมสงบถึงปานกลาง ปลอดภัยต่อโครงสร้างอาคาร', 
      prevention: 'สภาวะลมปกติ ดำเนินชีวิตและกิจกรรมกลางแจ้งได้ตามปกติ', 
      source: WMO_WIND_SOURCE 
    });
  }

  // =========================================================================
  // 4. RAINFALL (TMD กรมอุตุนิยมวิทยา & WMO Hourly Precipitation)
  // =========================================================================
  if (rain === null) {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: 'ไม่มีข้อมูล', 
      band: 'unknown', 
      meaning: 'ไม่มีข้อมูลปริมาณน้ำฝน', 
      prevention: 'ตรวจสภาพท้องฟ้าและประกาศทางการก่อนเดินทาง', 
      source: TMD_RAIN_SOURCE 
    });
  } else if (rain >= 50.1) {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: format(rain, 'มม./ชม.'), 
      band: 'very-dangerous', 
      meaning: 'ฝนตกหนักมากระดับวิกฤต (Torrential Rain ≥50.1 มม./ชม.) เสี่ยงน้ำท่วมฉับพลัน น้ำป่าไหลหลาก', 
      prevention: 'หลีกเลี่ยงเส้นทางน้ำหลากและพื้นที่ลุ่มต่ำเด็ดขาด เตรียมพร้อมอพยพหากอยู่ในจุดเสี่ยง', 
      source: TMD_RAIN_SOURCE 
    });
  } else if (rain >= 25.1) {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: format(rain, 'มม./ชม.'), 
      band: 'danger', 
      meaning: 'ฝนตกหนักเตือนภัย (Heavy Rain 25.1–50.0 มม./ชม.) เสี่ยงน้ำท่วมขังบนผิวถนน ผิวทางลื่น', 
      prevention: 'ขับขี่ด้วยความระมัดระวัง หลีกเลี่ยงจุดน้ำท่วมขังซ้ำซาก', 
      source: TMD_RAIN_SOURCE 
    });
  } else if (rain >= 10.1) {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: format(rain, 'มม./ชม.'), 
      band: 'warning', 
      meaning: 'ฝนหนักระดับเฝ้าระวัง (Moderate-Heavy Rain 10.1–25.0 มม./ชม.) เริ่มมีน้ำรอระบาย', 
      prevention: 'เปิดไฟหน้ารถเมื่อทัศนวิสัยลดลง ตรวจการระบายน้ำบริเวณบ้าน', 
      source: TMD_RAIN_SOURCE 
    });
  } else if (rain >= 2.5) {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: format(rain, 'มม./ชม.'), 
      band: 'watch', 
      meaning: 'ฝนปานกลาง (Moderate Rain 2.5–10.0 มม./ชม.)', 
      prevention: 'พกร่มหรือเสื้อกันฝน ระวังพื้นลื่น', 
      source: TMD_RAIN_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'rain', 
      title: 'ปริมาณฝน', 
      value: format(rain, 'มม./ชม.'), 
      band: 'normal', 
      meaning: rain > 0 ? 'ฝนเล็กน้อย (<2.5 มม./ชม.) ระบายน้ำได้ตามปกติ' : 'ไม่มีฝนตกในชั่วโมงที่ผ่านมา', 
      prevention: 'สภาวะฝนปกติ ดำเนินกิจกรรมกลางแจ้งได้ตามปกติ', 
      source: TMD_RAIN_SOURCE 
    });
  }

  // =========================================================================
  // 5. THUNDERSTORM & HAIL (WMO Code Table 4677 & TMD)
  // =========================================================================
  const thunderstorm = code !== null && code >= 95 && code <= 99;
  const severeHail = code === 96 || code === 99;
  if (code === null) {
    findings.push({ 
      id: 'storm', 
      title: 'พายุฟ้าคะนอง', 
      value: 'ไม่มีรหัสอากาศ', 
      band: 'unknown', 
      meaning: 'ไม่มีข้อมูลรหัสอากาศ WMO', 
      prevention: 'ติดตามประกาศเตือนภัยในพื้นที่', 
      source: TMD_STORM_SOURCE 
    });
  } else if (severeHail) {
    findings.push({ 
      id: 'storm', 
      title: 'พายุฟ้าคะนอง & ลูกเห็บ', 
      value: `WMO Code ${code}`, 
      band: 'very-dangerous', 
      meaning: 'พายุฝนฟ้าคะนองรุนแรงร่วมกับลูกเห็บตก เสี่ยงกระจกและหลังคาแตก ป้ายโฆษณาพังถล่ม', 
      prevention: 'เข้าอาคารคอนกรีตแข็งแรงทันที ระวังลูกเห็บตกใส่ยานพาหนะ หลีกเลี่ยงที่โล่งแจ้ง', 
      source: TMD_STORM_SOURCE 
    });
  } else if (thunderstorm) {
    findings.push({ 
      id: 'storm', 
      title: 'พายุฟ้าคะนอง', 
      value: `WMO Code ${code}`, 
      band: 'warning', 
      meaning: 'ตรวจพบพายุฝนฟ้าคะนองและฟ้าผ่าตามรหัสสากล WMO Code 95', 
      prevention: 'หลีกเลี่ยงการอยู่ในที่โล่งแจ้ง ใต้ต้นไม้ใหญ่ หรือใกล้โครงสร้างโลหะ เข้าหลบในอาคารที่ปลอดภัย', 
      source: TMD_STORM_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'storm', 
      title: 'พายุฟ้าคะนอง', 
      value: `WMO Code ${code}`, 
      band: 'normal', 
      meaning: 'ไม่มีสัญญาณพายุฝนฟ้าคะนอง ท้องฟ้าอยู่ในสภาวะปกติ', 
      prevention: 'สภาวะอากาศปกติ ติดตามการพยากรณ์ต่อเนื่อง', 
      source: TMD_STORM_SOURCE 
    });
  }

  // =========================================================================
  // 6. RIVER DISCHARGE (GloFAS / Copernicus ECMWF Hydrological Model)
  // =========================================================================
  if (discharge === null) {
    findings.push({ 
      id: 'river', 
      title: 'น้ำในแม่น้ำ', 
      value: 'ไม่มีข้อมูล', 
      band: 'unknown', 
      meaning: 'ไม่มีข้อมูลอัตราการไหลของน้ำในพื้นที่นี้', 
      prevention: 'ตรวจสอบระดับน้ำจากสถานีตรวจวัดของกรมชลประทานหรือ ปภ.', 
      source: GLOFAS_RIVER_SOURCE 
    });
  } else if (discharge >= 800) {
    findings.push({ 
      id: 'river', 
      title: 'น้ำในแม่น้ำ', 
      value: format(discharge, 'm³/s'), 
      band: 'very-dangerous', 
      meaning: 'อัตราการไหลระดับวิกฤต (≥800 m³/s) เสี่ยงน้ำล้นตลิ่งท่วมพื้นที่ลุ่มต่ำฉับพลัน', 
      prevention: 'ขนย้ายสิ่งของขึ้นที่สูง เสริมแนวกระสอบทราย และติดตามประกาศอพยพจาก ปภ.', 
      source: GLOFAS_RIVER_SOURCE 
    });
  } else if (discharge >= 500) {
    findings.push({ 
      id: 'river', 
      title: 'น้ำในแม่น้ำ', 
      value: format(discharge, 'm³/s'), 
      band: 'danger', 
      meaning: 'อัตราการไหลระดับเตือนภัยสูง (500–799 m³/s) น้ำเริ่มเอ่อล้นตลิ่งในจุดลุ่มต่ำ', 
      prevention: 'เฝ้าระวังแนวตลิ่งและการสูบระบายน้ำ ตรวจสอบระบบป้องกันน้ำท่วมรอบบ้าน', 
      source: GLOFAS_RIVER_SOURCE 
    });
  } else if (discharge >= 200) {
    findings.push({ 
      id: 'river', 
      title: 'น้ำในแม่น้ำ', 
      value: format(discharge, 'm³/s'), 
      band: 'warning', 
      meaning: 'อัตราการไหลระดับเฝ้าระวัง (200–499 m³/s) กระแสน้ำไหลแรง ระดับน้ำเพิ่มขึ้น', 
      prevention: 'ตรวจสอบสิ่งกีดขวางทางน้ำ เฝ้าระวังการเปลี่ยนแปลงระดับน้ำอย่างต่อเนื่อง', 
      source: GLOFAS_RIVER_SOURCE 
    });
  } else {
    findings.push({ 
      id: 'river', 
      title: 'น้ำในแม่น้ำ', 
      value: format(discharge, 'm³/s'), 
      band: 'normal', 
      meaning: 'อัตราการไหลระดับปกติ (<200 m³/s) อยู่ในเกณฑ์มาตรฐานลำน้ำ การระบายน้ำคล่องตัว', 
      prevention: 'สภาวะลำน้ำปกติ ปลอดภัยต่อชุมชนริมน้ำ', 
      source: GLOFAS_RIVER_SOURCE 
    });
  }

  // =========================================================================
  // MULTI-HAZARD COMPOUND RISK EVALUATION
  // =========================================================================
  const combinations: string[] = [];
  if (heat !== null && heat >= 33 && uv !== null && uv >= 6) {
    combinations.push('ดัชนีความร้อนระดับเตือนภัยร่วมกับรังสี UV สูง: หลีกเลี่ยงแดดจัด อยู่ในที่ร่มหรือห้องเย็น และดื่มน้ำสม่ำเสมอ');
  }
  if (rain !== null && rain >= 25.1 && thunderstorm) {
    combinations.push('ฝนตกหนักร่วมกับพายุฟ้าคะนอง: หลบในอาคารที่มั่นคงทันที หลีกเลี่ยงทางน้ำหลากและพื้นที่ลุ่มต่ำ');
  }
  if (gust !== null && gust >= 62 && thunderstorm) {
    combinations.push('พายุฟ้าคะนองร่วมกับลมกระโชกแรงอันตราย: ระวังต้นไม้โค่นล้ม ป้ายโฆษณาพังถล่ม และหลังคาบ้านเรือนเสียหาย');
  }
  if (rain !== null && rain >= 25.1 && discharge !== null && discharge >= 500) {
    combinations.push('ฝนตกหนักต่อเนื่องร่วมกับอัตราไหลลำน้ำสูง: เสี่ยงน้ำล้นตลิ่งและน้ำท่วมฉับพลัน ขนย้ายสิ่งของขึ้นที่สูง');
  }
  if (combinations.length === 0) {
    combinations.push('สภาวะอากาศโดยรวมอยู่ในเกณฑ์ปกติ ไม่พบความเสี่ยงภัยรุนแรงร่วมในขณะนี้');
  }

  return {
    findings,
    combinations,
    notes: [
      'เกณฑ์การประเมินอ้างอิงค่าเฉลี่ยมาตรฐานสากล: WMO, WHO, NOAA NWS, กรมอนามัย, กรมอุตุนิยมวิทยา (TMD) และ GloFAS/Copernicus ECMWF',
      'ดัชนีความร้อนคำนวณตามสมการ Rothfusz (อุณหภูมิ + ความชื้น) ซึ่งเป็นเกณฑ์มาตรฐานร่วมของ NOAA และกรมอนามัย',
      'ความเร็วลมและลมกระโชกประเมินตามเกณฑ์มาตราโบฟอร์ต (Beaufort Scale) ขององค์การอุตุนิยมวิทยาโลก (WMO)',
      'ข้อมูลสภาพอากาศดึงจากแบบจำลองความละเอียดสูงสุด Multi-Model Ensemble (ECMWF IFS + ICON + JMA + GFS) ของ Open-Meteo API',
    ],
  };
}
