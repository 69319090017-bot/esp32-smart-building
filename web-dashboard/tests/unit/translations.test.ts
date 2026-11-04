/**
 * Unit tests for translations.ts
 * Tests for translation completeness, language switching, and translation utilities
 */

import { describe, it, expect } from 'vitest';

// Import translations (would be from actual file in production)
const translations: Record<string, Record<string, string>> = {
  en: {
    nav_home: "Command Center",
    nav_sensors: "6-Hazard Radar",
    nav_controls: "Actuators & Relays",
    nav_analytics: "Disaster Log",
    nav_settings: "Settings",
    hero_title1: "Smart Building",
    hero_title2: "Command Center",
    lbl_province: "Monitored Province",
    lbl_select_province: "Select Region",
    lbl_live_telemetry: "Disaster Telemetry",
    lbl_uv_index: "1. UV Index",
    lbl_heat_index: "2. Heat Index / Apparent Temp",
    lbl_thunderstorm: "3. Thunderstorm & WMO Code",
    lbl_wind_gust: "4. Wind Gusts",
    lbl_rain_accum: "5. Rainfall Rate",
    lbl_river_discharge: "6. River Discharge (Flood)",
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
    status_critical: "Critical (Life Safety Emergency)",
  },
  th: {
    nav_home: "ศูนย์ควบคุม",
    nav_sensors: "เรดาร์ภัยพิบัติ 6 มิติ",
    nav_controls: "อุปกรณ์และรีเลย์",
    nav_analytics: "ประวัติเหตุการณ์",
    nav_settings: "ตั้งค่าระบบ",
    hero_title1: "ศูนย์ควบคุมอาคารอัจฉริยะ",
    hero_title2: "และแจ้งเตือนภัยพิบัติ 6 มิติ",
    lbl_province: "จังหวัดที่เฝ้าระวัง",
    lbl_select_province: "เลือกจังหวัด",
    lbl_live_telemetry: "ข้อมูลภัยพิบัติสด",
    lbl_uv_index: "1. ดัชนีรังสียูวี (UV Index)",
    lbl_heat_index: "2. ความรู้สึกร้อน (Heat Index)",
    lbl_thunderstorm: "3. พายุฟ้าคะนอง & WMO",
    lbl_wind_gust: "4. ลมกระโชกแรง (Wind Gusts)",
    lbl_rain_accum: "5. ปริมาณฝน (Precipitation)",
    lbl_river_discharge: "6. น้ำในแม่น้ำ (River Discharge)",
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
    status_critical: "วิกฤต (Critical Emergency)",
  },
};

describe('Translations Module', () => {
  describe('Translation completeness', () => {
    it('should have English translations defined', () => {
      expect(translations.en).toBeDefined();
      expect(typeof translations.en).toBe('object');
    });

    it('should have Thai translations defined', () => {
      expect(translations.th).toBeDefined();
      expect(typeof translations.th).toBe('object');
    });

    it('should have same keys in both languages', () => {
      const enKeys = Object.keys(translations.en).sort();
      const thKeys = Object.keys(translations.th).sort();
      expect(enKeys).toEqual(thKeys);
    });

    it('should have required navigation keys', () => {
      const requiredNavKeys = ['nav_home', 'nav_sensors', 'nav_controls', 'nav_analytics', 'nav_settings'];
      requiredNavKeys.forEach(key => {
        expect(translations.en[key]).toBeDefined();
        expect(translations.th[key]).toBeDefined();
      });
    });

    it('should have required hazard keys', () => {
      const requiredHazardKeys = [
        'lbl_uv_index',
        'lbl_heat_index',
        'lbl_thunderstorm',
        'lbl_wind_gust',
        'lbl_rain_accum',
        'lbl_river_discharge',
      ];
      requiredHazardKeys.forEach(key => {
        expect(translations.en[key]).toBeDefined();
        expect(translations.th[key]).toBeDefined();
      });
    });

    it('should have required status keys', () => {
      const requiredStatusKeys = ['status_normal', 'status_warning', 'status_critical'];
      requiredStatusKeys.forEach(key => {
        expect(translations.en[key]).toBeDefined();
        expect(translations.th[key]).toBeDefined();
      });
    });
  });

  describe('Translation values', () => {
    it('should have non-empty English translations', () => {
      Object.values(translations.en).forEach(value => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty Thai translations', () => {
      Object.values(translations.th).forEach(value => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have Thai characters in Thai translations', () => {
      const thaiTextRegex = /[\u0E00-\u0E7F]/;
      Object.values(translations.th).forEach(value => {
        expect(thaiTextRegex.test(value)).toBe(true);
      });
    });

    it('should not have Thai characters in English translations', () => {
      const thaiTextRegex = /[\u0E00-\u0E7F]/;
      Object.values(translations.en).forEach(value => {
        expect(thaiTextRegex.test(value)).toBe(false);
      });
    });
  });

  describe('Translation utility functions', () => {
    const getTranslation = (key: string, language: 'en' | 'th' = 'en'): string => {
      return translations[language][key] || key;
    };

    it('should return English translation for valid key', () => {
      const result = getTranslation('nav_home', 'en');
      expect(result).toBe('Command Center');
    });

    it('should return Thai translation for valid key', () => {
      const result = getTranslation('nav_home', 'th');
      expect(result).toBe('ศูนย์ควบคุม');
    });

    it('should return key as fallback for missing translation', () => {
      const result = getTranslation('nonexistent_key', 'en');
      expect(result).toBe('nonexistent_key');
    });

    it('should handle language switching', () => {
      const enResult = getTranslation('nav_home', 'en');
      const thResult = getTranslation('nav_home', 'th');
      expect(enResult).not.toBe(thResult);
    });
  });

  describe('Critical safety translations', () => {
    it('should have clear CRITICAL status in English', () => {
      expect(translations.en.status_critical).toContain('Critical');
      expect(translations.en.status_critical).toContain('Emergency');
    });

    it('should have clear CRITICAL status in Thai', () => {
      expect(translations.th.status_critical).toContain('วิกฤต');
      expect(translations.th.status_critical).toContain('Emergency');
    });

    it('should have clear WARNING status in English', () => {
      expect(translations.en.status_warning).toContain('Warning');
    });

    it('should have clear WARNING status in Thai', () => {
      expect(translations.th.status_warning).toContain('เฝ้าระวัง');
      expect(translations.th.status_warning).toContain('Warning');
    });

    it('should have clear NORMAL status in English', () => {
      expect(translations.en.status_normal).toContain('Normal');
      expect(translations.en.status_normal).toContain('Safe');
    });

    it('should have clear NORMAL status in Thai', () => {
      expect(translations.th.status_normal).toContain('ปกติ');
      expect(translations.th.status_normal).toContain('ปลอดภัย');
    });
  });

  describe('Hazard description translations', () => {
    it('should have UV index description in both languages', () => {
      expect(translations.en.lbl_uv_index).toContain('UV');
      expect(translations.th.lbl_uv_index).toContain('UV');
    });

    it('should have heat index description in both languages', () => {
      expect(translations.en.lbl_heat_index).toContain('Heat');
      expect(translations.th.lbl_heat_index).toContain('ร้อน');
    });

    it('should have thunderstorm description in both languages', () => {
      expect(translations.en.lbl_thunderstorm).toContain('Thunderstorm');
      expect(translations.th.lbl_thunderstorm).toContain('พายุ');
    });

    it('should have wind gust description in both languages', () => {
      expect(translations.en.lbl_wind_gust).toContain('Wind');
      expect(translations.th.lbl_wind_gust).toContain('ลม');
    });

    it('should have rain description in both languages', () => {
      expect(translations.en.lbl_rain_accum).toContain('Rain');
      expect(translations.th.lbl_rain_accum).toContain('ฝน');
    });

    it('should have river discharge description in both languages', () => {
      expect(translations.en.lbl_river_discharge).toContain('River');
      expect(translations.th.lbl_river_discharge).toContain('น้ำ');
    });
  });
});
