export const translations: Record<string, Record<string, string>> = {
  en: {
      nav_home: "Command Center",
      nav_sensors: "6-Hazard Radar",
      nav_controls: "Actuators & Relays",
      nav_analytics: "Disaster Log",
      nav_settings: "Settings",

      hero_title1: "Smart Building",
      hero_title2: "Command Center",
      hero_subtitle: "Real-time 6-dimensional multi-hazard early warning & automated life safety system powered by ESP32 Dual-Core (2026).",
      stat_uptime: "Uptime",
      stat_last_update: "Last Update",
      stat_firmware: "Firmware",

      lbl_province: "Monitored Province",
      lbl_select_province: "Select Region",
      lbl_live_telemetry: "Disaster Telemetry",
      title_live_telemetry: "6-Dimensional Hazard Assessment",

      // 6 Hazards
      lbl_uv_index: "1. UV Index",
      desc_uv_index: "WHO Standard: Warning ≥ 8.0 (Very High) | Critical ≥ 11.0 (Extreme)",
      lbl_heat_index: "2. Heat Index / Apparent Temp",
      desc_heat_index: "Heat Exhaustion ≥ 37.0°C | Heatstroke Emergency ≥ 41.0°C",
      lbl_thunderstorm: "3. Thunderstorm & WMO Code",
      desc_thunderstorm: "WMO 95 (Thunderstorm) | WMO 96, 99 (Severe Hailstorm)",
      lbl_wind_gust: "4. Wind Gusts",
      desc_wind_gust: "Strong Gust ≥ 50.0 km/h | Hurricane-force Storm ≥ 89.0 km/h",
      lbl_rain_accum: "5. Rainfall Rate",
      desc_rain_accum: "Heavy Rain ≥ 10.0 mm/h | Flash Flood Risk ≥ 35.0 mm/h",
      lbl_river_discharge: "6. River Discharge (Flood)",
      desc_river_discharge: "Flood Warning Level ≥ 500 m³/s",

      // Actuators
      lbl_strobe_relay: "Strobe Alarm (GPIO 2)",
      lbl_door_relay: "Emergency Doors (GPIO 4)",
      lbl_audio_siren: "Audio Siren / Voice",
      lbl_silence_alarm: "Silence Alarm",
      lbl_test_mode: "Emergency Test Mode",
      btn_test_telegram: "Test Telegram Alert",
      btn_download_csv: "Download History (CSV)",

      lbl_system_status: "System Status",
      lbl_highest_threat: "Highest Threat Level",
      status_normal: "Normal (Safe)",
      status_warning: "Warning (Elevated)",
      status_critical: "Critical (Life Safety Emergency)"
  },
  th: {
      nav_home: "ศูนย์ควบคุม",
      nav_sensors: "เรดาร์ภัยพิบัติ 6 มิติ",
      nav_controls: "อุปกรณ์และรีเลย์",
      nav_analytics: "ประวัติเหตุการณ์",
      nav_settings: "ตั้งค่าระบบ",

      hero_title1: "ศูนย์ควบคุมอาคารอัจฉริยะ",
      hero_title2: "และแจ้งเตือนภัยพิบัติ 6 มิติ",
      hero_subtitle: "ระบบเฝ้าระวัง ประเมินความเสี่ยง และแจ้งเตือนภัยพิบัติล่วงหน้าแบบเรียลไทม์ 77 จังหวัดทั่วไทย ขับเคลื่อนด้วย ESP32 Dual-Core (2026)",
      stat_uptime: "ระยะเวลาทำงาน",
      stat_last_update: "อัปเดตล่าสุด",
      stat_firmware: "เวอร์ชันเฟิร์มแวร์",

      lbl_province: "จังหวัดที่เฝ้าระวัง",
      lbl_select_province: "เลือกจังหวัด",
      lbl_live_telemetry: "ข้อมูลภัยพิบัติสด",
      title_live_telemetry: "การประเมินความเสี่ยง 6 มิติ (WHO/WMO)",

      // 6 Hazards
      lbl_uv_index: "1. ดัชนีรังสียูวี (UV Index)",
      desc_uv_index: "เกณฑ์สากล WHO: เฝ้าระวัง ≥ 8.0 (สูงมาก) | วิกฤต ≥ 11.0 (จัดมาก)",
      lbl_heat_index: "2. ความรู้สึกร้อน (Heat Index)",
      desc_heat_index: "เสี่ยงเพลียแดด ≥ 37.0°C | เสี่ยงโรคลมแดด (Heatstroke) ≥ 41.0°C",
      lbl_thunderstorm: "3. พายุฟ้าคะนอง & WMO",
      desc_thunderstorm: "WMO 95 (ฝนฟ้าคะนอง) | WMO 96, 99 (พายุรุนแรงพร้อมลูกเห็บ)",
      lbl_wind_gust: "4. ลมกระโชกแรง (Wind Gusts)",
      desc_wind_gust: "ลมกระโชกแรง ≥ 50.0 กม./ชม. | พายุลมกระโชกวิกฤต ≥ 89.0 กม./ชม.",
      lbl_rain_accum: "5. ปริมาณฝน (Precipitation)",
      desc_rain_accum: "ฝนตกหนัก ≥ 10.0 มม./ชม. | เสี่ยงน้ำท่วมฉับพลัน ≥ 35.0 มม./ชม.",
      lbl_river_discharge: "6. น้ำในแม่น้ำ (River Discharge)",
      desc_river_discharge: "เฝ้าระวังน้ำล้นตลิ่ง/น้ำท่วม ≥ 500 ลบ.ม./วินาที",

      // Actuators
      lbl_strobe_relay: "ไฟไซเรนฉุกเฉิน (GPIO 2)",
      lbl_door_relay: "ประตูหนีไฟฉุกเฉิน (GPIO 4)",
      lbl_audio_siren: "เสียงไซเรน / เสียงพูด",
      lbl_silence_alarm: "ปิดเสียงไซเรน (Silence)",
      lbl_test_mode: "ทดสอบสัญญาณฉุกเฉิน",
      btn_test_telegram: "ทดสอบส่ง Telegram",
      btn_download_csv: "ดาวน์โหลดประวัติ (CSV)",

      lbl_system_status: "สถานะระบบความปลอดภัย",
      lbl_highest_threat: "ระดับความเสี่ยงสูงสุด",
      status_normal: "ปกติ (ปลอดภัย)",
      status_warning: "เฝ้าระวัง (Warning)",
      status_critical: "วิกฤต (Critical Emergency)"
  }
};
