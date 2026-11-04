export type RainAlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

// TMD hourly rain categories: heavy 25.1–50.0 mm, very heavy >=50.1 mm.
// Source: https://www5.tmd.go.th/info/การวัดปริมาณน้ำฟ้าหรือหยาดน้ำฟ้า
export const rainAlertConfig = {
  enabled: true,
  warningThresholdMmHr: 25.1,
  criticalThresholdMmHr: 50.1,
  forecastWindowHours: 3,
  notifyTelegram: true,
  notifyDashboard: true,
  notifyMqtt: true,
  notifySiren: false,
} as const;

export function evaluateRainAlert(data: {
  precipitation?: number;
  weather_code?: number;
  river_discharge?: number;
}): {
  level: RainAlertLevel;
  message: string;
  precipitation: number;
  weatherCode: number;
} {
  const precipitation = Number(data?.precipitation ?? 0);
  const weatherCode = Number(data?.weather_code ?? 0);
  if (precipitation >= rainAlertConfig.criticalThresholdMmHr) {
    return {
      level: 'CRITICAL',
      message: `ฝนหนักมาก ${precipitation.toFixed(1)} มม./ชั่วโมง ตามเกณฑ์กรมอุตุนิยมวิทยา`,
      precipitation,
      weatherCode,
    };
  }

  if (
    precipitation >= rainAlertConfig.warningThresholdMmHr ||
    (weatherCode >= 95 && weatherCode <= 99) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return {
      level: 'WARNING',
      message: precipitation >= rainAlertConfig.warningThresholdMmHr
        ? `ฝนหนัก ${precipitation.toFixed(1)} มม./ชั่วโมง ตามเกณฑ์กรมอุตุนิยมวิทยา`
        : 'รหัสอากาศพบพายุฝนฟ้าคะนองหรือฝนซู่ ควรติดตามประกาศทางการ',
      precipitation,
      weatherCode,
    };
  }

  return {
    level: 'NORMAL',
      message: 'ยังไม่พบฝนหนักตามเกณฑ์ที่ใช้ในระบบ',
    precipitation,
    weatherCode,
  };
}
