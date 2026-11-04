/**
 * Test fixtures for Firebase data structures
 */

import { TelemetryData, DeviceStatus, RelayState, AlertLog, DeviceConfig, DeviceData } from '../../src/firebase_types';

export const mockTelemetryData: TelemetryData = {
  uv_index: 5.5,
  temperature_2m: 30.0,
  apparent_temperature: 32.0,
  relative_humidity_2m: 65,
  precipitation: 0.0,
  weather_code: 1,
  wind_speed_10m: 15.0,
  wind_gusts_10m: 25.0,
  river_discharge: 100.0,
  severity: 'NORMAL',
  province: 'กรุงเทพมหานคร',
  timestamp: new Date().toISOString(),
  _version: 1,
};

export const mockCriticalTelemetryData: TelemetryData = {
  uv_index: 12.5,
  temperature_2m: 35.0,
  apparent_temperature: 39.0,
  relative_humidity_2m: 60,
  precipitation: 0.0,
  weather_code: 0,
  wind_speed_10m: 10.0,
  wind_gusts_10m: 18.0,
  river_discharge: 50.0,
  severity: 'CRITICAL',
  province: 'กรุงเทพมหานคร',
  timestamp: new Date().toISOString(),
  _version: 1,
};

export const mockDeviceStatus: DeviceStatus = {
  uptime_sec: 86400,
  firmware_version: '1.0.0',
  last_heartbeat: new Date().toISOString(),
  battery_level: 85,
  signal_strength: 92,
  online: true,
  _version: 1,
};

export const mockDeviceStatusOffline: DeviceStatus = {
  uptime_sec: 0,
  firmware_version: '1.0.0',
  last_heartbeat: new Date(Date.now() - 300000).toISOString(),
  battery_level: 75,
  signal_strength: 0,
  online: false,
  _version: 1,
};

export const mockRelayState: RelayState = {
  strobe: false,
  door: false,
  siren: false,
  last_updated: new Date().toISOString(),
  _version: 1,
};

export const mockRelayStateActive: RelayState = {
  strobe: true,
  door: true,
  siren: true,
  last_updated: new Date().toISOString(),
  _version: 1,
};

export const mockAlertLog: AlertLog = {
  id: 'alert-001',
  severity: 'CRITICAL',
  message: 'เตือนภัยดัชนี UV สูงจัด (12.5) เสี่ยงผิวไหม้รุนแรง',
  province: 'กรุงเทพมหานคร',
  timestamp: new Date().toISOString(),
  type: 'weather',
  acknowledged: false,
  _version: 1,
};

export const mockAlertLogWarning: AlertLog = {
  id: 'alert-002',
  severity: 'WARNING',
  message: 'เตือนภัยอากาศร้อน รู้สึกเหมือน 37.5°C',
  province: 'เชียงใหม่',
  timestamp: new Date(Date.now() - 3600000).toISOString(),
  type: 'weather',
  acknowledged: true,
  _version: 1,
};

export const mockAlertLogDevice: AlertLog = {
  id: 'alert-003',
  severity: 'WARNING',
  message: 'Device battery level low (25%)',
  province: 'กรุงเทพมหานคร',
  timestamp: new Date(Date.now() - 7200000).toISOString(),
  type: 'device',
  acknowledged: false,
  _version: 1,
};

export const mockDeviceConfig: DeviceConfig = {
  province: 'กรุงเทพมหานคร',
  polling_interval: 60,
  thresholds: {
    uv_critical: 11.0,
    uv_warning: 8.0,
    heat_critical: 41.0,
    heat_warning: 37.0,
    wind_critical: 89.0,
    wind_warning: 50.0,
    rain_critical: 35.0,
    rain_warning: 10.0,
    river_warning: 500,
  },
  _version: 1,
};

export const mockDeviceData: DeviceData = {
  telemetry: {
    live: mockTelemetryData,
    historical: {},
  },
  status: mockDeviceStatus,
  relays: mockRelayState,
  alerts: [mockAlertLog, mockAlertLogWarning],
  config: mockDeviceConfig,
};

export const mockDeviceDataCritical: DeviceData = {
  telemetry: {
    live: mockCriticalTelemetryData,
    historical: {},
  },
  status: mockDeviceStatus,
  relays: mockRelayStateActive,
  alerts: [mockAlertLog],
  config: mockDeviceConfig,
};

// Firebase connection state fixtures
export const mockFirebaseConnectionState = {
  state: 'connected',
  lastConnected: new Date().toISOString(),
  reconnectAttempts: 0,
  latency: 45,
};

export const mockFirebaseConnectionStateReconnecting = {
  state: 'reconnecting',
  lastConnected: new Date(Date.now() - 5000).toISOString(),
  reconnectAttempts: 3,
  lastError: 'Connection timeout',
  latency: null,
};

export const mockFirebaseConnectionStateError = {
  state: 'error',
  lastConnected: new Date(Date.now() - 60000).toISOString(),
  reconnectAttempts: 5,
  lastError: 'Permission denied',
  latency: null,
};

// Historical telemetry data
export const mockHistoricalTelemetry: Record<string, TelemetryData> = {
  [new Date(Date.now() - 3600000).toISOString()]: mockTelemetryData,
  [new Date(Date.now() - 7200000).toISOString()]: mockTelemetryData,
  [new Date(Date.now() - 10800000).toISOString()]: mockTelemetryData,
};
