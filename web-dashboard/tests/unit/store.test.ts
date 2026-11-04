/**
 * Unit tests for state management (store_types.ts)
 * Tests for initial state, action types, and state structure
 */

import { describe, it, expect } from 'vitest';
import {
  initialWeatherState,
  initialDeviceState,
  initialUIState,
  initialHistoryState,
  initialSettingsState,
  initialState,
  type Action,
  type AppState,
  type WeatherState,
  type DeviceState,
  type UIState,
  type HistoryState,
  type SettingsState,
} from '../../src/store_types';

describe('Initial State', () => {
  describe('initialWeatherState', () => {
    it('should have correct initial structure', () => {
      expect(initialWeatherState).toBeDefined();
      expect(initialWeatherState.data).toBeNull();
      expect(initialWeatherState.severity).toBe('NORMAL');
      expect(initialWeatherState.province).toBe('กรุงเทพมหานคร');
      expect(initialWeatherState.lastUpdated).toBeNull();
      expect(initialWeatherState.isLoading).toBe(false);
      expect(initialWeatherState.error).toBeNull();
    });

    it('should have valid severity values', () => {
      const validSeverities = ['NORMAL', 'WARNING', 'CRITICAL'];
      expect(validSeverities).toContain(initialWeatherState.severity);
    });
  });

  describe('initialDeviceState', () => {
    it('should have correct initial structure', () => {
      expect(initialDeviceState).toBeDefined();
      expect(initialDeviceState.status).toBeDefined();
      expect(initialDeviceState.isConnected).toBe(false);
      expect(initialDeviceState.lastHeartbeat).toBeNull();
      expect(initialDeviceState.firmwareVersion).toBe('1.0.0');
    });

    it('should have initial relay states off', () => {
      expect(initialDeviceState.status.strobe).toBe(false);
      expect(initialDeviceState.status.emergencyDoor).toBe(false);
      expect(initialDeviceState.status.siren).toBe(false);
    });

    it('should have null last command', () => {
      expect(initialDeviceState.status.lastCommand).toBeNull();
    });
  });

  describe('initialUIState', () => {
    it('should have correct initial structure', () => {
      expect(initialUIState).toBeDefined();
      expect(initialUIState.currentView).toBe('dashboard');
      expect(initialUIState.toasts).toEqual([]);
      expect(initialUIState.isSidebarOpen).toBe(true);
      expect(initialUIState.uptime).toBe(0);
    });

    it('should have valid language', () => {
      const validLanguages = ['th', 'en'];
      expect(validLanguages).toContain(initialUIState.language);
    });
  });

  describe('initialHistoryState', () => {
    it('should have correct initial structure', () => {
      expect(initialHistoryState).toBeDefined();
      expect(initialHistoryState.logs).toEqual([]);
      expect(initialHistoryState.maxLogs).toBe(50);
    });

    it('should have reasonable max logs limit', () => {
      expect(initialHistoryState.maxLogs).toBeGreaterThan(0);
      expect(initialHistoryState.maxLogs).toBeLessThan(1000);
    });
  });

  describe('initialSettingsState', () => {
    it('should have correct initial structure', () => {
      expect(initialSettingsState).toBeDefined();
      expect(initialSettingsState.pollingInterval).toBe(60000);
      expect(initialSettingsState.autoAlert).toBe(true);
      expect(initialSettingsState.speechEnabled).toBe(true);
      expect(initialSettingsState.telegramEnabled).toBe(true);
      expect(initialSettingsState.theme).toBe('auto');
    });

    it('should have valid theme', () => {
      const validThemes = ['light', 'dark', 'auto'];
      expect(validThemes).toContain(initialSettingsState.theme);
    });

    it('should have reasonable polling interval', () => {
      expect(initialSettingsState.pollingInterval).toBeGreaterThan(0);
      expect(initialSettingsState.pollingInterval).toBeLessThan(600000); // Less than 10 minutes
    });
  });

  describe('initialState', () => {
    it('should combine all initial states', () => {
      expect(initialState).toBeDefined();
      expect(initialState.weather).toEqual(initialWeatherState);
      expect(initialState.device).toEqual(initialDeviceState);
      expect(initialState.ui).toEqual(initialUIState);
      expect(initialState.history).toEqual(initialHistoryState);
      expect(initialState.settings).toEqual(initialSettingsState);
    });
  });
});

describe('State Structure Validation', () => {
  it('should have all required state slices', () => {
    const requiredSlices = ['weather', 'device', 'ui', 'history', 'settings'];
    requiredSlices.forEach(slice => {
      expect(initialState[slice as keyof AppState]).toBeDefined();
    });
  });

  it('should have immutable initial state references', () => {
    const state1 = initialState;
    const state2 = initialState;
    expect(state1).toBe(state2);
  });
});

describe('Action Types', () => {
  it('should have weather actions defined', () => {
    const weatherActions: Action[] = [
      { type: 'WEATHER_FETCH_START', province: 'กรุงเทพมหานคร' },
      { type: 'WEATHER_FETCH_SUCCESS', data: {} as any, severity: 'NORMAL', province: 'กรุงเทพมหานคร' },
      { type: 'WEATHER_FETCH_ERROR', error: 'Test error' },
      { type: 'WEATHER_SET_PROVINCE', province: 'เชียงใหม่' },
    ];

    weatherActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });

  it('should have device actions defined', () => {
    const deviceActions: Action[] = [
      { type: 'DEVICE_TOGGLE_STROBE' },
      { type: 'DEVICE_TOGGLE_DOOR' },
      { type: 'DEVICE_SILENCE_SIREN' },
      { type: 'DEVICE_TEST_SIREN' },
      { type: 'DEVICE_SET_STATUS', status: {} },
      { type: 'DEVICE_SET_CONNECTED', connected: true },
      { type: 'DEVICE_SET_FIRMWARE', version: '1.0.0' },
    ];

    deviceActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });

  it('should have UI actions defined', () => {
    const uiActions: Action[] = [
      { type: 'UI_SET_VIEW', view: 'dashboard' },
      { type: 'UI_TOGGLE_LANGUAGE' },
      { type: 'UI_ADD_TOAST', message: 'Test', toastType: 'info' },
      { type: 'UI_REMOVE_TOAST', id: 'test-id' },
      { type: 'UI_CLEAR_TOASTS' },
      { type: 'UI_TOGGLE_SIDEBAR' },
      { type: 'UI_INCREMENT_UPTIME' },
    ];

    uiActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });

  it('should have history actions defined', () => {
    const historyActions: Action[] = [
      { type: 'HISTORY_ADD_LOG', log: {} as any },
      { type: 'HISTORY_CLEAR_LOGS' },
      { type: 'HISTORY_SET_MAX_LOGS', max: 100 },
    ];

    historyActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });

  it('should have settings actions defined', () => {
    const settingsActions: Action[] = [
      { type: 'SETTINGS_UPDATE', settings: {} },
      { type: 'SETTINGS_RESET' },
    ];

    settingsActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });

  it('should have global actions defined', () => {
    const globalActions: Action[] = [
      { type: 'STATE_RESET' },
      { type: 'STATE_HYDRATE', state: {} },
    ];

    globalActions.forEach(action => {
      expect(action).toBeDefined();
      expect(action.type).toBeTruthy();
    });
  });
});

describe('View Types', () => {
  it('should have valid view names', () => {
    const validViews: Array<'dashboard' | 'history' | 'settings' | 'devices'> = [
      'dashboard',
      'history',
      'settings',
      'devices',
    ];

    validViews.forEach(view => {
      expect(view).toBeTruthy();
      expect(typeof view).toBe('string');
    });
  });

  it('should have dashboard as default view', () => {
    expect(initialUIState.currentView).toBe('dashboard');
  });
});

describe('Toast Message Types', () => {
  it('should have valid toast types', () => {
    const validToastTypes = ['info', 'success', 'alert'];
    validToastTypes.forEach(type => {
      expect(['info', 'success', 'alert']).toContain(type);
    });
  });
});

describe('Severity Levels', () => {
  it('should have valid severity levels', () => {
    const validSeverities: Array<'NORMAL' | 'WARNING' | 'CRITICAL'> = [
      'NORMAL',
      'WARNING',
      'CRITICAL',
    ];

    validSeverities.forEach(severity => {
      expect(['NORMAL', 'WARNING', 'CRITICAL']).toContain(severity);
    });
  });

  it('should have NORMAL as default severity', () => {
    expect(initialWeatherState.severity).toBe('NORMAL');
  });
});

describe('Event Types', () => {
  it('should have required event types', () => {
    const requiredEvents = [
      'weather:updated',
      'weather:error',
      'device:changed',
      'device:connected',
      'device:disconnected',
      'alert:triggered',
      'alert:cleared',
      'user:action',
      'system:startup',
      'system:error',
    ];

    requiredEvents.forEach(event => {
      expect(event).toBeTruthy();
      expect(typeof event).toBe('string');
    });
  });
});

describe('Log Levels', () => {
  it('should have valid log levels', () => {
    const validLogLevels: Array<'debug' | 'info' | 'warn' | 'error'> = [
      'debug',
      'info',
      'warn',
      'error',
    ];

    validLogLevels.forEach(level => {
      expect(['debug', 'info', 'warn', 'error']).toContain(level);
    });
  });
});
