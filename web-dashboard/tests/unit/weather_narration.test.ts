import { describe, expect, it } from 'vitest';
import { buildWeatherNarration, calculateRothfuszHeatIndexC } from '../../src/weather_narration';

const now = new Date('2026-10-14T05:00:00.000Z');
const live = {
  mode: 'live' as const,
  province: 'กรุงเทพมหานคร',
  observedAt: '2026-10-14T04:55:00.000Z',
  maxAgeMinutes: 10,
  now,
};

describe('buildWeatherNarration', () => {
  it('describes heat using a calculated heat index and gives practical steps', () => {
    const result = buildWeatherNarration({
      ...live,
      data: { temperature_2m: 35, relative_humidity_2m: 70, precipitation: 0, weather_code: 0 },
    });
    expect(result).toContain('ข้อมูลจาก โอเพนเมทีโอ');
    expect(result).toContain('อากาศร้อน');
    expect(result).toContain('รู้สึกเหมือน');
    expect(result).toContain('ควรหลีกเลี่ยงกิจกรรมกลางแจ้ง');
    expect(result).toContain('เตรียมน้ำดื่ม');
    expect(result).toContain('ความเสี่ยง');
    expect(result).not.toMatch(/[0-9°]/);
  });

  it('describes rain without calling hourly data an official heavy-rain threshold', () => {
    const result = buildWeatherNarration({
      ...live,
      data: { temperature_2m: 28, relative_humidity_2m: 70, precipitation: 1.2, weather_code: 61 },
    });
    expect(result).toContain('มีฝนในข้อมูลอากาศ');
    expect(result).toContain('เตรียมร่มหรือเสื้อกันฝน');
    expect(result).toContain('พื้นลื่น');
    expect(result).not.toContain('ฝนตกหนัก');
  });

  it('describes ordinary conditions', () => {
    const result = buildWeatherNarration({
      ...live,
      data: { temperature_2m: 25, relative_humidity_2m: 60, precipitation: 0, weather_code: 0 },
    });
    expect(result).toContain('อากาศโดยรวมปกติ');
    expect(result).toContain('ทำกิจกรรมได้ตามปกติ');
  });

  it('reports missing data without substituting zero or cached values', () => {
    expect(buildWeatherNarration({ ...live, data: null }))
      .toContain('ขณะนี้ไม่มีข้อมูลล่าสุด');
  });

  it('reports stale observations as unavailable and does not speak old measurements', () => {
    const result = buildWeatherNarration({
      ...live,
      observedAt: '2026-10-14T04:00:00.000Z',
      data: { temperature_2m: 40, relative_humidity_2m: 80, precipitation: 0, weather_code: 0 },
    });
    expect(result).toBe('ขณะนี้ไม่มีข้อมูลล่าสุด จึงยังสรุปคำแนะนำตามสภาพอากาศไม่ได้');
    expect(result).not.toContain('สี่สิบ');
  });

  it('labels demo data and does not present it as live sourced data', () => {
    const result = buildWeatherNarration({
      mode: 'demo',
      province: 'กรุงเทพมหานคร',
      data: { temperature_2m: 35, relative_humidity_2m: 70, precipitation: 0, weather_code: 0 },
      maxAgeMinutes: 10,
    });
    expect(result).toContain('นี่คือข้อมูลตัวอย่าง');
    expect(result).not.toContain('ข้อมูลจาก โอเพนเมทีโอ');
  });

  it('requires the caller to provide a positive freshness limit', () => {
    expect(() => buildWeatherNarration({ ...live, maxAgeMinutes: 0, data: null }))
      .toThrow('maxAgeMinutes must be a positive finite number');
  });
});

describe('calculateRothfuszHeatIndexC', () => {
  it('does not claim a heat index outside the equation operating range', () => {
    expect(calculateRothfuszHeatIndexC(25, 60)).toBeNull();
  });

  it('calculates heat index from measured temperature and humidity', () => {
    const result = calculateRothfuszHeatIndexC(35, 70);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(35);
  });
});

