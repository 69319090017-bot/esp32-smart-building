import { describe, it, expect } from 'vitest';
import { evaluateHumidityAlert } from '../../src/humidity_alert';

describe('Humidity Alert Module', () => {
  it('should return NORMAL when humidity is comfortable', () => {
    const result = evaluateHumidityAlert({ humidity: 52, temperatureC: 31 });

    expect(result.level).toBe('NORMAL');
    expect(result.message).toContain('ปกติ');
  });

  it('should return WARNING when humidity is elevated and uncomfortable', () => {
    const result = evaluateHumidityAlert({ humidity: 78, temperatureC: 34 });

    expect(result.level).toBe('WARNING');
    expect(result.message).toContain('เฝ้าระวัง');
  });

  it('should return CRITICAL when humidity is excessively high', () => {
    const result = evaluateHumidityAlert({ humidity: 92, temperatureC: 36 });

    expect(result.level).toBe('CRITICAL');
    expect(result.message).toContain('วิกฤต');
  });

  it('should recommend different actions for each risk level', () => {
    expect(evaluateHumidityAlert({ humidity: 50, temperatureC: 30 }).advice).toContain('เหมาะสม');
    expect(evaluateHumidityAlert({ humidity: 78, temperatureC: 34 }).advice).toContain('ระบายอากาศ');
    expect(evaluateHumidityAlert({ humidity: 92, temperatureC: 36 }).advice).toContain('ลดความชื้น');
  });
});
