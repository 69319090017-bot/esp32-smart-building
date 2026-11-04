import { describe, it, expect } from 'vitest';
import { evaluateRainAlert } from '../../src/rain_alert';

describe('Rain Alert Module', () => {
  it('should return NORMAL when rainfall is below warning threshold', () => {
    const result = evaluateRainAlert({ precipitation: 4.5, weather_code: 1 });

    expect(result.level).toBe('NORMAL');
    expect(result.message).toContain('ยังไม่พบฝนหนัก');
  });

  it('should return WARNING when rainfall reaches TMD heavy rain threshold (>= 25.1 mm/hr)', () => {
    const result = evaluateRainAlert({ precipitation: 28.0, weather_code: 1 });

    expect(result.level).toBe('WARNING');
    expect(result.message).toContain('ฝนหนัก');
  });

  it('should return CRITICAL when rainfall reaches TMD very heavy rain threshold (>= 50.1 mm/hr)', () => {
    const result = evaluateRainAlert({ precipitation: 55.0, weather_code: 1 });

    expect(result.level).toBe('CRITICAL');
    expect(result.message).toContain('ฝนหนักมาก');
  });

  it('should return WARNING for thunderstorm code 95', () => {
    const result = evaluateRainAlert({ precipitation: 2.0, weather_code: 95 });

    expect(result.level).toBe('WARNING');
    expect(result.message).toContain('พายุฝนฟ้าคะนอง');
  });

  it('should return WARNING for convective storm codes 96 and 99 without extreme rain', () => {
    expect(evaluateRainAlert({ precipitation: 0, weather_code: 96 }).level).toBe('WARNING');
    expect(evaluateRainAlert({ precipitation: 0, weather_code: 99 }).level).toBe('WARNING');
  });
});
