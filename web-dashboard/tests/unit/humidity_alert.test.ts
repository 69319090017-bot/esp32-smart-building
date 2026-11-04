import { describe, it, expect } from 'vitest';
import { evaluateHumidityAlert } from '../../src/humidity_alert';

describe('Humidity Alert Module', () => {
  it('should return NORMAL when heat index is below warning threshold', () => {
    const result = evaluateHumidityAlert({ humidity: 40, temperatureC: 27 });

    expect(result.level).toBe('NORMAL');
    expect(result.message).toContain('ต่ำกว่าเกณฑ์เฝ้าระวัง');
  });

  it('should return WARNING when humidity and temperature produce elevated heat index', () => {
    const result = evaluateHumidityAlert({ humidity: 60, temperatureC: 30 });

    expect(result.level).toBe('WARNING');
    expect(result.message).toContain('เกณฑ์กรมอนามัย');
  });

  it('should return CRITICAL when humidity and heat index are dangerous', () => {
    const result = evaluateHumidityAlert({ humidity: 85, temperatureC: 36 });

    expect(result.level).toBe('CRITICAL');
    expect(result.message).toContain('อันตรายตามเกณฑ์กรมอนามัย');
  });

  it('should recommend different actions for each risk level', () => {
    expect(evaluateHumidityAlert({ humidity: 40, temperatureC: 27 }).advice).toContain('ติดตามสภาพอากาศ');
    expect(evaluateHumidityAlert({ humidity: 60, temperatureC: 30 }).advice).toContain('ติดตามอาการ');
    expect(evaluateHumidityAlert({ humidity: 85, temperatureC: 36 }).advice).toContain('ลดกิจกรรมกลางแจ้ง');
  });
});
