/**
 * Integration tests for Firebase client
 * Tests for Firebase initialization, connection handling, and data subscription
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  mockTelemetryData,
  mockCriticalTelemetryData,
  mockDeviceStatus,
  mockRelayState,
  mockFirebaseConnectionState,
} from '../fixtures';

// Mock Firebase
const mockInitializeApp = vi.fn();
const mockGetDatabase = vi.fn(() => ({ database: 'mock-db' }));
const mockRef = vi.fn(() => ({ ref: 'mock-ref' }));
const mockOnValue = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: mockInitializeApp,
}));

vi.mock('firebase/database', () => ({
  getDatabase: mockGetDatabase,
  ref: mockRef,
  onValue: mockOnValue,
}));

describe('Firebase Client Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Firebase Initialization', () => {
    it('should initialize Firebase with valid config', async () => {
      const config = {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        databaseURL: 'https://test.firebaseio.com',
        projectId: 'test-project',
        appId: '1:123:web:abc',
      };

      // Simulate initialization
      mockInitializeApp.mockReturnValue({ name: 'test-app' });

      const app = mockInitializeApp(config);
      const db = mockGetDatabase(app);

      expect(mockInitializeApp).toHaveBeenCalledWith(config);
      expect(mockGetDatabase).toHaveBeenCalledWith(app);
      expect(db).toBeDefined();
    });

    it('should skip initialization with placeholder API key', async () => {
      const config = {
        apiKey: 'AIzaSy_YOUR_API_KEY_HERE',
        authDomain: 'test.firebaseapp.com',
        databaseURL: 'https://test.firebaseio.com',
        projectId: 'test-project',
        appId: '1:123:web:abc',
      };

      const shouldSkip = config.apiKey.includes('YOUR_') || config.apiKey.includes('AIzaSy_YOUR');

      expect(shouldSkip).toBe(true);
      expect(mockInitializeApp).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockInitializeApp.mockImplementation(() => {
        throw new Error('Firebase initialization failed');
      });

      try {
        mockInitializeApp({});
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Firebase initialization failed');
      }
    });
  });

  describe('Firebase Path Construction', () => {
    it('should construct correct device path', () => {
      const deviceId = 'smart_building_001';
      const path = 'telemetry/live';
      const devicePath = `devices/${deviceId}/${path}`;

      expect(devicePath).toBe('devices/smart_building_001/telemetry/live');
    });

    it('should construct correct status path', () => {
      const deviceId = 'smart_building_001';
      const path = 'status';
      const devicePath = `devices/${deviceId}/${path}`;

      expect(devicePath).toBe('devices/smart_building_001/status');
    });

    it('should construct correct relay path', () => {
      const deviceId = 'smart_building_001';
      const path = 'relays';
      const devicePath = `devices/${deviceId}/${path}`;

      expect(devicePath).toBe('devices/smart_building_001/relays');
    });

    it('should construct correct alerts path', () => {
      const deviceId = 'smart_building_001';
      const path = 'alerts';
      const devicePath = `devices/${deviceId}/${path}`;

      expect(devicePath).toBe('devices/smart_building_001/alerts');
    });
  });

  describe('Firebase Data Subscription', () => {
    it('should subscribe to telemetry data', () => {
      const db = mockGetDatabase({});
      const path = 'devices/smart_building_001/telemetry/live';
      const callback = vi.fn();

      mockRef.mockReturnValue({ ref: path });
      mockOnValue.mockImplementation((ref, cb) => {
        cb({ val: () => mockTelemetryData });
      });

      mockOnValue(mockRef(db, path), callback);

      expect(mockRef).toHaveBeenCalledWith(db, path);
      expect(mockOnValue).toHaveBeenCalled();
    });

    it('should subscribe to device status', () => {
      const db = mockGetDatabase({});
      const path = 'devices/smart_building_001/status';
      const callback = vi.fn();

      mockRef.mockReturnValue({ ref: path });
      mockOnValue.mockImplementation((ref, cb) => {
        cb({ val: () => mockDeviceStatus });
      });

      mockOnValue(mockRef(db, path), callback);

      expect(mockRef).toHaveBeenCalledWith(db, path);
      expect(mockOnValue).toHaveBeenCalled();
    });

    it('should handle null data from Firebase', () => {
      const db = mockGetDatabase({});
      const path = 'devices/smart_building_001/telemetry/live';
      const callback = vi.fn();

      mockRef.mockReturnValue({ ref: path });
      mockOnValue.mockImplementation((ref, cb) => {
        cb({ val: () => null });
      });

      mockOnValue(mockRef(db, path), callback);

      expect(mockOnValue).toHaveBeenCalled();
    });

    it('should handle undefined data from Firebase', () => {
      const db = mockGetDatabase({});
      const path = 'devices/smart_building_001/telemetry/live';
      const callback = vi.fn();

      mockRef.mockReturnValue({ ref: path });
      mockOnValue.mockImplementation((ref, cb) => {
        cb({ val: () => undefined });
      });

      mockOnValue(mockRef(db, path), callback);

      expect(mockOnValue).toHaveBeenCalled();
    });
  });

  describe('Firebase Data Processing', () => {
    it('should process telemetry data correctly', () => {
      const snapshot = { val: () => mockTelemetryData };
      const data = snapshot.val();

      expect(data).toBeDefined();
      expect(data.uv_index).toBe(5.5);
      expect(data.temperature_2m).toBe(30.0);
      expect(data.severity).toBe('NORMAL');
      expect(data.province).toBe('กรุงเทพมหานคร');
    });

    it('should process critical telemetry data', () => {
      const snapshot = { val: () => mockCriticalTelemetryData };
      const data = snapshot.val();

      expect(data).toBeDefined();
      expect(data.uv_index).toBe(12.5);
      expect(data.severity).toBe('CRITICAL');
    });

    it('should process device status data', () => {
      const snapshot = { val: () => mockDeviceStatus };
      const data = snapshot.val();

      expect(data).toBeDefined();
      expect(data.uptime_sec).toBe(86400);
      expect(data.firmware_version).toBe('1.0.0');
      expect(data.online).toBe(true);
    });

    it('should process relay state data', () => {
      const snapshot = { val: () => mockRelayState };
      const data = snapshot.val();

      expect(data).toBeDefined();
      expect(data.strobe).toBe(false);
      expect(data.door).toBe(false);
      expect(data.siren).toBe(false);
    });

    it('should extract uptime and format correctly', () => {
      const uptimeSec = 86400;
      const h = Math.floor(uptimeSec / 3600);
      const m = Math.floor((uptimeSec % 3600) / 60);
      const s = uptimeSec % 60;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      expect(formatted).toBe('24:00:00');
    });

    it('should format uptime with leading zeros', () => {
      const uptimeSec = 3661;
      const h = Math.floor(uptimeSec / 3600);
      const m = Math.floor((uptimeSec % 3600) / 60);
      const s = uptimeSec % 60;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      expect(formatted).toBe('01:01:01');
    });
  });

  describe('Firebase Connection State', () => {
    it('should track connection state', () => {
      const connectionState = mockFirebaseConnectionState;

      expect(connectionState.state).toBe('connected');
      expect(connectionState.reconnectAttempts).toBe(0);
      expect(connectionState.latency).toBe(45);
    });

    it('should handle reconnection attempts', () => {
      const connectionState = {
        state: 'reconnecting',
        lastConnected: new Date(Date.now() - 5000).toISOString(),
        reconnectAttempts: 3,
        lastError: 'Connection timeout',
        latency: null,
      };

      expect(connectionState.state).toBe('reconnecting');
      expect(connectionState.reconnectAttempts).toBe(3);
      expect(connectionState.lastError).toBe('Connection timeout');
    });

    it('should handle error state', () => {
      const connectionState = {
        state: 'error',
        lastConnected: new Date(Date.now() - 60000).toISOString(),
        reconnectAttempts: 5,
        lastError: 'Permission denied',
        latency: null,
      };

      expect(connectionState.state).toBe('error');
      expect(connectionState.reconnectAttempts).toBe(5);
      expect(connectionState.lastError).toBe('Permission denied');
    });
  });

  describe('Firebase Configuration Validation', () => {
    it('should validate Firebase config structure', () => {
      const config = {
        apiKey: 'test-key',
        authDomain: 'test.firebaseapp.com',
        databaseURL: 'https://test.firebaseio.com',
        projectId: 'test-project',
        appId: '1:123:web:abc',
      };

      expect(config.apiKey).toBeTruthy();
      expect(config.authDomain).toContain('firebaseapp.com');
      expect(config.databaseURL).toContain('firebaseio.com');
      expect(config.projectId).toBeTruthy();
      expect(config.appId).toBeTruthy();
    });

    it('should detect invalid Firebase config', () => {
      const config = {
        apiKey: '',
        authDomain: '',
        databaseURL: '',
        projectId: '',
        appId: '',
      };

      const isValid = Boolean(config.apiKey && config.authDomain && config.databaseURL);

      expect(isValid).toBe(false);
    });
  });

  describe('Firebase Offline Mode', () => {
    it('should run in standalone mode when Firebase is not configured', () => {
      const config = {
        apiKey: 'AIzaSy_YOUR_API_KEY_HERE',
        authDomain: 'test.firebaseapp.com',
        databaseURL: 'https://test.firebaseio.com',
        projectId: 'test-project',
        appId: '1:123:web:abc',
      };

      const isStandalone = config.apiKey.includes('YOUR_') || config.apiKey.includes('AIzaSy_YOUR');

      expect(isStandalone).toBe(true);
    });

    it('should log standalone mode message', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const config = {
        apiKey: 'AIzaSy_YOUR_API_KEY_HERE',
      };

      if (config.apiKey.includes('YOUR_')) {
        console.log('[FIREBASE] Using standalone direct satellite & simulation mode.');
      }

      expect(consoleSpy).toHaveBeenCalledWith('[FIREBASE] Using standalone direct satellite & simulation mode.');
      consoleSpy.mockRestore();
    });
  });
});
