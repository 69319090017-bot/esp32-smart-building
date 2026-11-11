/**
 * Data validation layer for Smart Building Command Center
 * Provides schema validation, sanitization, and type guards for runtime safety
 */

import { ValidationResult, ValidationSchema, WeatherData, SeverityLevel } from './store_types';
import { logger } from './logger';

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for WeatherData
 */
export function isWeatherData(data: unknown): data is WeatherData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const w = data as Record<string, unknown>;
  return (
    typeof w.uv_index === 'number' &&
    typeof w.apparent_temperature === 'number' &&
    typeof w.temperature_2m === 'number' &&
    typeof w.weather_code === 'number' &&
    typeof w.wind_gusts_10m === 'number' &&
    typeof w.wind_speed_10m === 'number' &&
    typeof w.precipitation === 'number' &&
    typeof w.river_discharge === 'number'
  );
}

/**
 * Type guard for SeverityLevel
 */
export function isSeverityLevel(value: unknown): value is SeverityLevel {
  return typeof value === 'string' && ['NORMAL', 'WARNING', 'CRITICAL'].includes(value);
}

/**
 * Type guard for province name (basic check)
 */
export function isProvinceName(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 100;
}

/**
 * Type guard for device ID
 */
export function isDeviceId(value: unknown): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) && value.length > 0;
}

/**
 * Type guard for numeric value in range
 */
export function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters except newlines and tabs
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: unknown, defaultValue: number = 0): number {
  if (typeof input === 'number' && !isNaN(input)) {
    return input;
  }

  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

/**
 * Sanitize province name
 */
export function sanitizeProvinceName(input: unknown): string {
  const sanitized = sanitizeString(input);
  // Allow Thai and English characters, numbers, spaces, and common punctuation
  return sanitized.replace(/[^\u0E00-\u0E7F\uA000-\uA48Fa-zA-Z0-9\s\-\.]/g, '');
}

/**
 * Sanitize object by removing null/undefined values and converting numbers
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: unknown): T {
  if (typeof obj !== 'object' || obj === null) {
    return {} as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'number') {
      result[key] = sanitizeNumber(value);
    } else if (typeof value === 'boolean') {
      result[key] = value;
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Weather data validation schema
 */
export const weatherDataSchema: ValidationSchema<WeatherData> = {
  validate: (data: unknown): ValidationResult<WeatherData> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isWeatherData(data)) {
      return {
        isValid: false,
        errors: ['Invalid weather data structure'],
        warnings
      };
    }

    // Validate ranges
    if (data.uv_index < 0 || data.uv_index > 20) {
      warnings.push('UV index outside expected range (0-20)');
    }

    if (data.temperature_2m < -50 || data.temperature_2m > 60) {
      errors.push('Temperature outside physically possible range (-50 to 60°C)');
    }

    if (data.apparent_temperature < -60 || data.apparent_temperature > 70) {
      warnings.push('Apparent temperature outside expected range');
    }

    if (data.wind_speed_10m < 0 || data.wind_speed_10m > 200) {
      warnings.push('Wind speed outside expected range (0-200 km/h)');
    }

    if (data.wind_gusts_10m < 0 || data.wind_gusts_10m > 300) {
      warnings.push('Wind gusts outside expected range (0-300 km/h)');
    }

    if (data.precipitation < 0 || data.precipitation > 500) {
      warnings.push('Precipitation outside expected range (0-500 mm/h)');
    }

    if (data.river_discharge < 0 || data.river_discharge > 10000) {
      warnings.push('River discharge outside expected range (0-10000 m³/s)');
    }

    if (data.weather_code < 0 || data.weather_code > 99) {
      errors.push('Invalid WMO weather code (0-99)');
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors,
      warnings
    };
  },

  sanitize: (data: unknown): WeatherData => {
    if (!isWeatherData(data)) {
      throw new Error('Cannot sanitize invalid weather data');
    }

    return {
      uv_index: Math.max(0, Math.min(20, data.uv_index)),
      apparent_temperature: Math.max(-60, Math.min(70, data.apparent_temperature)),
      temperature_2m: Math.max(-50, Math.min(60, data.temperature_2m)),
      weather_code: Math.max(0, Math.min(99, data.weather_code)),
      wind_gusts_10m: Math.max(0, Math.min(300, data.wind_gusts_10m)),
      wind_speed_10m: Math.max(0, Math.min(200, data.wind_speed_10m)),
      precipitation: Math.max(0, Math.min(500, data.precipitation)),
      river_discharge: Math.max(0, Math.min(10000, data.river_discharge)),
      relative_humidity_2m: (data as any).relative_humidity_2m !== undefined
        ? Math.max(0, Math.min(100, (data as any).relative_humidity_2m))
        : undefined
    };
  }
};

/**
 * API response validation schema
 */
export const apiResponseSchema: ValidationSchema<any> = {
  validate: (data: unknown): ValidationResult<any> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return {
        isValid: false,
        errors: ['API response must be an object'],
        warnings
      };
    }

    // Check for common API response structure
    if ('error' in data && data.error) {
      errors.push(`API returned error: ${data.error}`);
    }

    if ('current' in data && typeof data.current !== 'object') {
      warnings.push('API response has invalid "current" field');
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors,
      warnings
    };
  }
};

/**
 * Firebase data validation schema
 */
export const firebaseDataSchema: ValidationSchema<any> = {
  validate: (data: unknown): ValidationResult<any> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data === null) {
      return {
        isValid: true,
        data: null,
        errors,
        warnings
      };
    }

    if (typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Firebase data must be an object or null'],
        warnings
      };
    }

    // Check for circular references (basic check)
    try {
      JSON.stringify(data);
    } catch (e) {
      errors.push('Firebase data contains circular references');
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors,
      warnings
    };
  }
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate and sanitize weather data from API
 */
export function validateWeatherData(data: unknown): ValidationResult<WeatherData> {
  logger.debug('Validating weather data', 'validators', { data });

  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Weather data is required and must be an object'],
      warnings: []
    };
  }

  try {
    // First sanitize
    const sanitized = sanitizeObject(data as Record<string, unknown>);

    // Then validate
    const result = weatherDataSchema.validate(sanitized);

    if (result.warnings.length > 0) {
      logger.warn('Weather data validation warnings', 'validators', {
        warnings: result.warnings
      });
    }

    if (!result.isValid) {
      logger.error('Weather data validation failed', undefined, 'validators', {
        errors: result.errors
      });
    }

    return result;
  } catch (error) {
    logger.error('Error during weather data validation', error as Error, 'validators');
    return {
      isValid: false,
      errors: ['Validation error: ' + (error as Error).message],
      warnings: []
    };
  }
}

/**
 * Validate user input (province selection, etc.)
 */
export function validateUserInput(input: {
  province?: unknown;
  deviceId?: unknown;
  [key: string]: unknown
}): ValidationResult<Record<string, any>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitized: Record<string, any> = {};

  if (input.province !== undefined) {
    if (!isProvinceName(input.province)) {
      errors.push('Invalid province name');
    } else {
      sanitized.province = sanitizeProvinceName(input.province);
    }
  }

  if (input.deviceId !== undefined) {
    if (!isDeviceId(input.deviceId)) {
      errors.push('Invalid device ID');
    } else {
      sanitized.deviceId = sanitizeString(input.deviceId);
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? sanitized : undefined,
    errors,
    warnings
  };
}

/**
 * Validate API response
 */
export function validateApiResponse(data: unknown): ValidationResult<any> {
  logger.debug('Validating API response', 'validators');

  const result = apiResponseSchema.validate(data);

  if (!result.isValid) {
    logger.error('API response validation failed', undefined, 'validators', {
      errors: result.errors
    });
  }

  return result;
}

/**
 * Validate Firebase data
 */
export function validateFirebaseData(data: unknown): ValidationResult<any> {
  logger.debug('Validating Firebase data', 'validators');

  const result = firebaseDataSchema.validate(data);

  if (!result.isValid) {
    logger.error('Firebase data validation failed', undefined, 'validators', {
      errors: result.errors
    });
  }

  return result;
}

/**
 * Validate severity level
 */
export function validateSeverity(value: unknown): ValidationResult<SeverityLevel> {
  if (isSeverityLevel(value)) {
    return {
      isValid: true,
      data: value,
      errors: [],
      warnings: []
    };
  }

  return {
    isValid: false,
    errors: [`Invalid severity level: ${value}`],
    warnings: []
  };
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Validate multiple data items and return combined results
 */
export function validateBatch<T>(
  items: unknown[],
  schema: ValidationSchema<T>
): ValidationResult<T[]> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const validItems: T[] = [];

  items.forEach((item, index) => {
    const result = schema.validate(item);
    if (result.isValid && result.data) {
      validItems.push(result.data);
    }
    allErrors.push(...result.errors.map(e => `[${index}] ${e}`));
    allWarnings.push(...result.warnings.map(w => `[${index}] ${w}`));
  });

  return {
    isValid: allErrors.length === 0,
    data: validItems,
    errors: allErrors,
    warnings: allWarnings
  };
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Higher-order function to add validation to async functions
 */
export function withValidation<T, R>(
  validator: (data: T) => ValidationResult<R>,
  fn: (data: R) => Promise<any>
) {
  return async (data: T): Promise<any> => {
    const result = validator(data);

    if (!result.isValid) {
      logger.error('Validation failed', undefined, 'validators', {
        errors: result.errors
      });
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }

    if (result.warnings.length > 0) {
      logger.warn('Validation warnings', 'validators', {
        warnings: result.warnings
      });
    }

    return fn(result.data!);
  };
}
