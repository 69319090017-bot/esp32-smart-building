import { describe, it, expect } from 'vitest';
import { evaluateRainAlert } from '../../src/rain_alert';

describe('Rain Alert Module', () => {
  it('should return NORMAL when rainfall is below warning threshold', () => {
    const result = evaluateRainAlert({ precipitation: 4.5, weather_code: 1 });

    expect(result.level).toBe('NORMAL');
    expect(result.message).toContain('ปกติ');
  });

  it('should return WARNING when rainfall reaches the warning threshold', () => {
    const result = evaluateRainAlert({ precipitation: 10.0, weather_code: 1 });

    expect(result.level).toBe('WARNING');
    expect(result.message).toContain('WARNING');
  });

  it('should return CRITICAL when rainfall reaches the critical threshold', () => {
    const result = evaluateRainAlert({ precipitation: 35.0, weather_code: 1 });

    expect(result.level).toBe('CRITICAL');
    expect(result.message).toContain('CRITICAL');
  });

  it('should return WARNING for thunderstorm code 95', () => {
    const result = evaluateRainAlert({ precipitation: 2.0, weather_code: 95 });

    expect(result.level).toBe('WARNING');
  });

  it('should return CRITICAL for severe thunderstorm codes 96 and 99', () => {
    expect(evaluateRainAlert({ precipitation: 0, weather_code: 96 }).level).toBe('CRITICAL');
    expect(evaluateRainAlert({ precipitation: 0, weather_code: 99 }).level).toBe('CRITICAL');
  });
});
