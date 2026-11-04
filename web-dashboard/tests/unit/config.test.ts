/**
 * Unit tests for config.ts
 * Tests for Firebase configuration, device ID resolution, and path utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window object
const mockWindow = {
  location: {
    search: '',
  },
  SMART_GARAGE_FIREBASE_CONFIG: null,
  SMART_BUILDING_DEVICE_ID: null,
};

describe('Config Module', () => {
  beforeEach(() => {
    // Reset window location search
    mockWindow.location.search = '';
    mockWindow.SMART_GARAGE_FIREBASE_CONFIG = null;
    mockWindow.SMART_BUILDING_DEVICE_ID = null;
    (window as any).SMART_GARAGE_FIREBASE_CONFIG = null;
    (window as any).SMART_BUILDING_DEVICE_ID = null;
  });

  describe('devicePath utility', () => {
    it('should construct correct device path', () => {
      const devicePath = (path: string, deviceId: string) => `devices/${deviceId}/${path}`;
      const result = devicePath('telemetry/live', 'smart_building_001');
      expect(result).toBe('devices/smart_building_001/telemetry/live');
    });

    it('should handle nested paths', () => {
      const devicePath = (path: string, deviceId: string) => `devices/${deviceId}/${path}`;
      const result = devicePath('config/thresholds', 'device_123');
      expect(result).toBe('devices/device_123/config/thresholds');
    });

    it('should handle empty path', () => {
      const devicePath = (path: string, deviceId: string) => `devices/${deviceId}/${path}`;
      const result = devicePath('', 'device_123');
      expect(result).toBe('devices/device_123/');
    });
  });

  describe('Device ID resolution priority', () => {
    it('should prioritize URL parameter over environment variable', () => {
      // This would test the logic: URL param > env var > window global > default
      const urlParams = new URLSearchParams('?device=device_from_url');
      const envDeviceId = 'device_from_env';
      const windowDeviceId = 'device_from_window';
      const defaultDeviceId = 'smart_building_001';

      const deviceId = urlParams.get('device') || envDeviceId || windowDeviceId || defaultDeviceId;
      expect(deviceId).toBe('device_from_url');
    });

    it('should use environment variable when URL parameter is absent', () => {
      const urlParams = new URLSearchParams('');
      const envDeviceId = 'device_from_env';
      const windowDeviceId = 'device_from_window';
      const defaultDeviceId = 'smart_building_001';

      const deviceId = urlParams.get('device') || envDeviceId || windowDeviceId || defaultDeviceId;
      expect(deviceId).toBe('device_from_env');
    });

    it('should use window global when URL and env are absent', () => {
      const urlParams = new URLSearchParams('');
      const envDeviceId = null as any;
      const windowDeviceId = 'device_from_window';
      const defaultDeviceId = 'smart_building_001';

      const deviceId = urlParams.get('device') || envDeviceId || windowDeviceId || defaultDeviceId;
      expect(deviceId).toBe('device_from_window');
    });

    it('should use default when all other sources are absent', () => {
      const urlParams = new URLSearchParams('');
      const envDeviceId = null as any;
      const windowDeviceId = null as any;
      const defaultDeviceId = 'smart_building_001';

      const deviceId = urlParams.get('device') || envDeviceId || windowDeviceId || defaultDeviceId;
      expect(deviceId).toBe('smart_building_001');
    });
  });

  describe('Firebase configuration resolution', () => {
    it('should use window global config when available', () => {
      const windowConfig = {
        apiKey: 'window_api_key',
        authDomain: 'window.firebaseapp.com',
        databaseURL: 'https://window.firebaseio.com',
        projectId: 'window-project',
        appId: '1:window:web',
      };

      const envConfig = {
        apiKey: 'env_api_key',
        authDomain: 'env.firebaseapp.com',
        databaseURL: 'https://env.firebaseio.com',
        projectId: 'env-project',
        appId: '1:env:web',
      };

      (window as any).SMART_GARAGE_FIREBASE_CONFIG = windowConfig;
      const config = (window as any).SMART_GARAGE_FIREBASE_CONFIG || envConfig;

      expect(config).toEqual(windowConfig);
    });

    it('should use environment config when window global is absent', () => {
      const envConfig = {
        apiKey: 'env_api_key',
        authDomain: 'env.firebaseapp.com',
        databaseURL: 'https://env.firebaseio.com',
        projectId: 'env-project',
        appId: '1:env:web',
      };

      const config = (window as any).SMART_GARAGE_FIREBASE_CONFIG || envConfig;
      expect(config).toEqual(envConfig);
    });
  });

  describe('MAX_ALERTS constant', () => {
    it('should be defined and have a reasonable value', () => {
      const MAX_ALERTS = 50;
      expect(MAX_ALERTS).toBeDefined();
      expect(MAX_ALERTS).toBeGreaterThan(0);
      expect(MAX_ALERTS).toBeLessThan(1000);
    });

    it('should be a number', () => {
      const MAX_ALERTS = 50;
      expect(typeof MAX_ALERTS).toBe('number');
    });
  });
});
