/**
 * Unit tests for data validation functions
 * Tests for weather data validation, Firebase data validation, and general utility validations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockWeatherData,
  mockCriticalUVWeather,
  mockNegativeValuesWeather,
  mockZeroValuesWeather,
  mockExtremeUVWeather,
} from '../fixtures';

// Mock severity calculation function (this would be in a utility file in production)
const calculateSeverity = (data: any): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
  const uv = data.uv_index || 0;
  const apparent = data.apparent_temperature || data.temperature_2m || 0;
  const gust = data.wind_gusts_10m || 0;
  const rain = data.precipitation || 0;
  const wmo = data.weather_code || 0;
  const riverDischarge = data.river_discharge || 0;

  if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || rain >= 35.0 || wmo === 96 || wmo === 99) {
    return 'CRITICAL';
  } else if (uv >= 8.0 || apparent >= 37.0 || gust >= 50.0 || rain >= 10.0 || wmo === 95 || riverDischarge >= 500) {
    return 'WARNING';
  }
  return 'NORMAL';
};

// Mock validation function
const validateWeatherData = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Weather data must be an object');
    return { valid: false, errors };
  }

  if (typeof data.uv_index !== 'number' || data.uv_index < 0) {
    errors.push('UV index must be a non-negative number');
  }

  if (typeof data.temperature_2m !== 'number') {
    errors.push('Temperature must be a number');
  }

  if (typeof data.apparent_temperature !== 'number') {
    errors.push('Apparent temperature must be a number');
  }

  if (typeof data.wind_speed_10m !== 'number' || data.wind_speed_10m < 0) {
    errors.push('Wind speed must be a non-negative number');
  }

  if (typeof data.wind_gusts_10m !== 'number' || data.wind_gusts_10m < 0) {
    errors.push('Wind gusts must be a non-negative number');
  }

  if (typeof data.precipitation !== 'number' || data.precipitation < 0) {
    errors.push('Precipitation must be a non-negative number');
  }

  if (typeof data.river_discharge !== 'number' || data.river_discharge < 0) {
    errors.push('River discharge must be a non-negative number');
  }

  if (typeof data.weather_code !== 'number' || data.weather_code < 0 || data.weather_code > 99) {
    errors.push('Weather code must be a number between 0 and 99');
  }

  if (data.relative_humidity_2m !== undefined && (typeof data.relative_humidity_2m !== 'number' || data.relative_humidity_2m < 0 || data.relative_humidity_2m > 100)) {
    errors.push('Relative humidity must be a number between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

describe('Weather Data Validation', () => {
  describe('validateWeatherData', () => {
    it('should validate correct weather data', () => {
      const result = validateWeatherData(mockWeatherData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative UV index', () => {
      const result = validateWeatherData(mockNegativeValuesWeather);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('UV index must be a non-negative number');
    });

    it('should reject negative wind speed', () => {
      const result = validateWeatherData(mockNegativeValuesWeather);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Wind speed must be a non-negative number');
    });

    it('should reject negative precipitation', () => {
      const result = validateWeatherData(mockNegativeValuesWeather);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Precipitation must be a non-negative number');
    });

    it('should reject invalid weather code', () => {
      const invalidData = { ...mockWeatherData, weather_code: 100 };
      const result = validateWeatherData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Weather code must be a number between 0 and 99');
    });

    it('should reject humidity outside 0-100 range', () => {
      const invalidData = { ...mockWeatherData, relative_humidity_2m: 150 };
      const result = validateWeatherData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Relative humidity must be a number between 0 and 100');
    });

    it('should accept zero values', () => {
      const result = validateWeatherData(mockZeroValuesWeather);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect multiple validation errors', () => {
      const invalidData = {
        uv_index: -1,
        temperature_2m: 'invalid' as any,
        wind_speed_10m: -5,
        weather_code: 150,
      };
      const result = validateWeatherData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('calculateSeverity', () => {
    it('should return NORMAL for safe conditions', () => {
      const severity = calculateSeverity(mockWeatherData);
      expect(severity).toBe('NORMAL');
    });

    it('should return CRITICAL for extreme UV', () => {
      const severity = calculateSeverity(mockCriticalUVWeather);
      expect(severity).toBe('CRITICAL');
    });

    it('should return CRITICAL for UV >= 11.0', () => {
      const data = { ...mockWeatherData, uv_index: 11.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for UV >= 8.0', () => {
      const data = { ...mockWeatherData, uv_index: 8.5 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should return CRITICAL for apparent temperature >= 41.0', () => {
      const data = { ...mockWeatherData, apparent_temperature: 41.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for apparent temperature >= 37.0', () => {
      const data = { ...mockWeatherData, apparent_temperature: 37.5 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should return CRITICAL for wind gusts >= 89.0', () => {
      const data = { ...mockWeatherData, wind_gusts_10m: 89.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for wind gusts >= 50.0', () => {
      const data = { ...mockWeatherData, wind_gusts_10m: 52.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should return CRITICAL for precipitation >= 35.0', () => {
      const data = { ...mockWeatherData, precipitation: 35.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for precipitation >= 10.0', () => {
      const data = { ...mockWeatherData, precipitation: 12.0 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should return CRITICAL for WMO code 96 (thunderstorm with hail)', () => {
      const data = { ...mockWeatherData, weather_code: 96 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return CRITICAL for WMO code 99 (severe hailstorm)', () => {
      const data = { ...mockWeatherData, weather_code: 99 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for WMO code 95 (thunderstorm)', () => {
      const data = { ...mockWeatherData, weather_code: 95 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should return WARNING for river discharge >= 500', () => {
      const data = { ...mockWeatherData, river_discharge: 500 };
      const severity = calculateSeverity(data);
      expect(severity).toBe('WARNING');
    });

    it('should handle extreme UV values', () => {
      const severity = calculateSeverity(mockExtremeUVWeather);
      expect(severity).toBe('CRITICAL');
    });

    it('should prioritize CRITICAL over WARNING when multiple thresholds met', () => {
      const data = {
        ...mockWeatherData,
        uv_index: 12.0,
        apparent_temperature: 38.0,
      };
      const severity = calculateSeverity(data);
      expect(severity).toBe('CRITICAL');
    });
  });
});

describe('Edge Case Validation', () => {
  it('should handle null data gracefully', () => {
    const result = validateWeatherData(null as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle undefined data gracefully', () => {
    const result = validateWeatherData(undefined as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle empty object', () => {
    const result = validateWeatherData({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle missing fields', () => {
    const result = validateWeatherData({ uv_index: 5.5 });
    expect(result.valid).toBe(false);
  });
});
