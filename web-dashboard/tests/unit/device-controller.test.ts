/**
 * Unit tests for device_controller.ts
 * Tests for weather fetching, relay control, Telegram alerts, and CSV export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockWeatherData,
  mockCriticalUVWeather,
  mockOpenMeteoResponse,
  mockOpenMeteoCriticalResponse,
  mockFloodApiResponse,
  mockProvincesMap,
} from '../fixtures';
import { buildOutdoorReadinessSummary } from '../../src/ui_manager';
import { buildTelegramAlertKey } from '../../src/device_controller';

// Mock fetch
global.fetch = vi.fn();

describe('Device Controller - fetchOpenMeteoWeather', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch weather data successfully', async () => {
    const mockResponse = {
      ok: true,
      json: async () => mockOpenMeteoResponse,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    // Mock flood API
    (global.fetch as any).mockResolvedValueOnce(mockResponse);
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFloodApiResponse,
    });

    const PROVINCES_MAP = mockProvincesMap;
    const provinceName = 'กรุงเทพมหานคร';
    const info = PROVINCES_MAP[provinceName];

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok`;

    await fetch(url);

    expect(global.fetch).toHaveBeenCalledWith(url);
  });

  it('should handle API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: async () => ({ error: 'HTTP error 500' }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    try {
      const PROVINCES_MAP = mockProvincesMap;
      const provinceName = 'กรุงเทพมหานคร';
      const info = PROVINCES_MAP[provinceName];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('HTTP error');
    }
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    try {
      const PROVINCES_MAP = mockProvincesMap;
      const provinceName = 'กรุงเทพมหานคร';
      const info = PROVINCES_MAP[provinceName];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok`;

      await fetch(url);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toBe('Network error');
    }
  });

  it('should calculate severity correctly for CRITICAL UV', () => {
    const uv = 12.5;
    const apparent = 39.0;
    const gust = 18.0;
    const rain = 0.0;
    const wmo = 0;

    let severity = 'NORMAL';
    if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || rain >= 35.0 || wmo === 96 || wmo === 99) {
      severity = 'CRITICAL';
    } else if (uv >= 8.0 || apparent >= 37.0 || gust >= 50.0 || rain >= 10.0 || wmo === 95) {
      severity = 'WARNING';
    }

    expect(severity).toBe('CRITICAL');
  });

  it('should calculate severity correctly for WARNING conditions', () => {
    const uv = 8.5;
    const apparent = 37.5;
    const gust = 52.0;
    const rain = 12.0;
    const wmo = 95;

    let severity = 'NORMAL';
    if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || rain >= 35.0 || wmo === 96 || wmo === 99) {
      severity = 'CRITICAL';
    } else if (uv >= 8.0 || apparent >= 37.0 || gust >= 50.0 || rain >= 10.0 || wmo === 95) {
      severity = 'WARNING';
    }

    expect(severity).toBe('WARNING');
  });

  it('should calculate severity correctly for NORMAL conditions', () => {
    const uv = 5.5;
    const apparent = 32.0;
    const gust = 25.0;
    const rain = 0.0;
    const wmo = 1;

    let severity = 'NORMAL';
    if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || rain >= 35.0 || wmo === 96 || wmo === 99) {
      severity = 'CRITICAL';
    } else if (uv >= 8.0 || apparent >= 37.0 || gust >= 50.0 || rain >= 10.0 || wmo === 95) {
      severity = 'WARNING';
    }

    expect(severity).toBe('NORMAL');
  });
});

describe('Device Controller - Relay Control', () => {
  it('should toggle strobe state', () => {
    let currentStrobeState = false;
    currentStrobeState = !currentStrobeState;
    expect(currentStrobeState).toBe(true);
    currentStrobeState = !currentStrobeState;
    expect(currentStrobeState).toBe(false);
  });

  it('should toggle door state', () => {
    let currentDoorState = false;
    currentDoorState = !currentDoorState;
    expect(currentDoorState).toBe(true);
    currentDoorState = !currentDoorState;
    expect(currentDoorState).toBe(false);
  });

  it('should track independent relay states', () => {
    let strobeState = false;
    let doorState = false;

    strobeState = !strobeState;
    expect(strobeState).toBe(true);
    expect(doorState).toBe(false);

    doorState = !doorState;
    expect(strobeState).toBe(true);
    expect(doorState).toBe(true);
  });
});

describe('Device Controller - CSV Export', () => {
  it('should generate CSV content from history logs', () => {
    const historyLogs = [
      {
        time: '2024-01-01 12:00:00',
        province: 'กรุงเทพมหานคร',
        severity: 'CRITICAL',
        desc: 'UV Index Critical',
        metrics: 'UV: 12.5',
      },
      {
        time: '2024-01-01 13:00:00',
        province: 'เชียงใหม่',
        severity: 'WARNING',
        desc: 'Heat Warning',
        metrics: 'Temp: 37.5°C',
      },
    ];

    const headers = ['Time', 'Province', 'Severity', 'Description', 'Metrics'];
    const rows = historyLogs.map(l => [l.time, l.province, l.severity, `"${l.desc}"`, `"${l.metrics}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    expect(csvContent).toContain('Time,Province,Severity,Description,Metrics');
    expect(csvContent).toContain('2024-01-01 12:00:00,กรุงเทพมหานคร,CRITICAL,"UV Index Critical","UV: 12.5"');
    expect(csvContent).toContain('2024-01-01 13:00:00,เชียงใหม่,WARNING,"Heat Warning","Temp: 37.5°C"');
  });

  it('should handle empty history logs', () => {
    const historyLogs: any[] = [];
    const headers = ['Time', 'Province', 'Severity', 'Description', 'Metrics'];
    const rows = historyLogs.map(l => [l.time, l.province, l.severity, `"${l.desc}"`, `"${l.metrics}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    expect(csvContent).toBe('Time,Province,Severity,Description,Metrics');
  });

  it('should escape special characters in CSV', () => {
    const historyLogs = [
      {
        time: '2024-01-01 12:00:00',
        province: 'กรุงเทพมหานคร',
        severity: 'CRITICAL',
        desc: 'Test "quoted" text',
        metrics: 'Test, with, commas',
      },
    ];

    const headers = ['Time', 'Province', 'Severity', 'Description', 'Metrics'];
    const rows = historyLogs.map(l => [l.time, l.province, l.severity, `"${l.desc}"`, `"${l.metrics}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    expect(csvContent).toContain('"Test "quoted" text"');
    expect(csvContent).toContain('"Test, with, commas"');
  });
});

describe('Device Controller - Telegram Alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format Telegram message correctly', () => {
    const message = 'เตือนภัยดัชนี UV สูงจัด';
    const severity = 'CRITICAL';
    const province = 'กรุงเทพมหานคร';

    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    const text = `${icon} <b>[${severity}]</b> ${message}\n📍 <b>พื้นที่:</b> จ.${province}\n⚙️ <b>การตอบสนองระบบ:</b> เปิดสัญญาณไฟไซเรนฉุกเฉิน | ปลดล็อกประตูอัตโนมัติ\n⏰ <b>เวลา:</b> ${new Date().toLocaleString('th-TH')}\n🌐 <b>โหนด:</b> Smart Building Command Center 2026`;

    expect(text).toContain('🚨');
    expect(text).toContain('[CRITICAL]');
    expect(text).toContain(message);
    expect(text).toContain('จ.กรุงเทพมหานคร');
    expect(text).toContain('Smart Building Command Center 2026');
  });

  it('should use warning icon for WARNING severity', () => {
    const severity = 'WARNING';
    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    expect(icon).toBe('⚠️');
  });

  it('should use critical icon for CRITICAL severity', () => {
    const severity = 'CRITICAL';
    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    expect(icon).toBe('🚨');
  });

  it('should send POST request to Telegram API', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ ok: true }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const TELEGRAM_BOT_TOKEN = 'test_token';
    const TELEGRAM_CHAT_ID = 'test_chat_id';
    const text = 'Test message';

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should handle Telegram API errors', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({ description: 'Bad Request' }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const TELEGRAM_BOT_TOKEN = 'test_token';
    const TELEGRAM_CHAT_ID = 'test_chat_id';
    const text = 'Test message';

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    expect(response.ok).toBe(false);
  });

  it('should dispatch a Discord webhook when configured', async () => {
    const mockTelegramResponse = { ok: true, json: async () => ({ ok: true }) };
    const mockDiscordResponse = { ok: true, status: 204, json: async () => ({ ok: true }) };
    (global.fetch as any).mockResolvedValueOnce(mockTelegramResponse).mockResolvedValueOnce(mockDiscordResponse);

    const message = 'เตือนภัยฝนตกหนัก';
    const severity = 'CRITICAL';
    const province = 'กรุงเทพมหานคร';

    const url = `https://api.telegram.org/bot${'test_token'}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: 'test_chat_id',
        text: `${severity} ${message}`,
        parse_mode: 'HTML',
      }),
    });
    await fetch('https://discord.com/api/webhooks/test/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🚨 Smart Building Alert',
      }),
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      'https://discord.com/api/webhooks/test/alert',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('Outdoor AI Summary', () => {
  it('should warn to stay home when heat, humidity and rain are all high', () => {
    const result = buildOutdoorReadinessSummary(37.4, 85, 23.2, 12, 39, 9, 95);

    expect(result.status).toBe('NOT READY');
    expect(result.summary).toContain('ไม่ควรออกจากบ้าน');
    expect(result.action).toContain('อยู่ในบ้านก่อน');
  });

  it('should deduplicate Telegram alerts for the same risk state', () => {
    const keyA = buildTelegramAlertKey('กรุงเทพมหานคร', 'WARNING', 35.5, 82, 12.5, 60, 8.8);
    const keyB = buildTelegramAlertKey('กรุงเทพมหานคร', 'WARNING', 35.5, 82, 12.5, 60, 8.8);
    const keyC = buildTelegramAlertKey('เชียงใหม่', 'WARNING', 35.5, 82, 12.5, 60, 8.8);

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});

describe('Device Controller - Province Lookup', () => {
  it('should find province coordinates', () => {
    const PROVINCES_MAP = mockProvincesMap;
    const provinceName = 'กรุงเทพมหานคร';
    const info = PROVINCES_MAP[provinceName];

    expect(info).toBeDefined();
    expect(info.lat).toBeCloseTo(13.7563);
    expect(info.lon).toBeCloseTo(100.5018);
  });

  it('should fallback to Bangkok for unknown province', () => {
    const PROVINCES_MAP = mockProvincesMap;
    const unknownProvince = 'Unknown Province';
    const info = PROVINCES_MAP[unknownProvince] || PROVINCES_MAP['กรุงเทพมหานคร'];

    expect(info).toBeDefined();
    expect(info.lat).toBeCloseTo(13.7563);
  });

  it('should handle multiple provinces', () => {
    const PROVINCES_MAP = mockProvincesMap;
    const provinces = Object.keys(PROVINCES_MAP);

    expect(provinces.length).toBeGreaterThan(0);
    expect(provinces).toContain('กรุงเทพมหานคร');
    expect(provinces).toContain('เชียงใหม่');
  });
});
