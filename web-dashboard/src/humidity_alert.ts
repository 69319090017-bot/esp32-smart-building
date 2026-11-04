import { calculateRothfuszHeatIndexC } from './weather_narration';

export type HumidityAlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export const humidityAlertConfig = {
  enabled: true,
  notifyTelegram: true,
  notifyDashboard: true,
} as const;

/**
 * Humidity alone is not assigned an invented danger threshold. When both
 * temperature and humidity are available, use the Department of Health Heat
 * Index ranges (source link in the comment) and the shared Rothfusz formula.
 * Source: https://anamai.moph.go.th/th/news-anamai/44861
 */
export function evaluateHumidityAlert(data: {
  humidity?: number;
  temperatureC?: number;
  dewPointC?: number;
}): {
  level: HumidityAlertLevel;
  message: string;
  advice: string;
  comfort: string;
  humidity: number;
  dewPoint: number;
} {
  const humidity = Number.isFinite(data?.humidity) ? Number(data.humidity) : NaN;
  const temperatureC = Number.isFinite(data?.temperatureC) ? Number(data.temperatureC) : NaN;
  const dewPoint = Number.isFinite(data?.dewPointC) ? Number(data.dewPointC) : NaN;
  const heatIndex = calculateRothfuszHeatIndexC(temperatureC, humidity);

  if (heatIndex === null) {
    return {
      level: 'NORMAL',
      message: 'ยังประเมินดัชนีความร้อนไม่ได้',
      advice: 'ต้องมีทั้งอุณหภูมิและความชื้นที่ใช้ได้ จึงจะจัดระดับตามเกณฑ์ได้',
      comfort: 'ข้อมูลไม่พอ',
      humidity,
      dewPoint,
    };
  }

  if (heatIndex >= 42) {
    return {
      level: 'CRITICAL',
      message: 'ดัชนีความร้อนอยู่ในระดับอันตรายตามเกณฑ์กรมอนามัย',
      advice: 'ลดกิจกรรมกลางแจ้ง พักในที่ร่มหรือที่เย็น และดื่มน้ำสม่ำเสมอ',
      comfort: 'อันตรายจากความร้อน',
      humidity,
      dewPoint,
    };
  }

  if (heatIndex >= 33) {
    return {
      level: 'WARNING',
      message: 'ดัชนีความร้อนอยู่ในระดับเตือนภัยตามเกณฑ์กรมอนามัย',
      advice: 'ลดกิจกรรมกลางแจ้ง พักเป็นระยะ และดื่มน้ำสม่ำเสมอ',
      comfort: 'เตือนภัยความร้อน',
      humidity,
      dewPoint,
    };
  }

  if (heatIndex >= 27) {
    return {
      level: 'WARNING',
      message: 'ดัชนีความร้อนอยู่ในระดับเฝ้าระวังตามเกณฑ์กรมอนามัย',
      advice: 'ติดตามอาการและสภาพอากาศ โดยเฉพาะผู้สูงอายุและผู้ที่อยู่กลางแจ้งนาน',
      comfort: 'เฝ้าระวังความร้อน',
      humidity,
      dewPoint,
    };
  }

  return {
    level: 'NORMAL',
    message: 'ดัชนีความร้อนต่ำกว่าเกณฑ์เฝ้าระวังของกรมอนามัย',
    advice: 'ติดตามสภาพอากาศต่อเนื่อง; ค่านี้ไม่ได้ยืนยันว่าปลอดภัยจากปัจจัยอื่น',
    comfort: 'ต่ำกว่าเกณฑ์ความร้อน',
    humidity,
    dewPoint,
  };
}
