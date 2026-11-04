/**
 * Test fixtures for WebSocket messages and communication
 */

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  deviceId?: string;
}

export const mockWebSocketMessage: WebSocketMessage = {
  type: 'telemetry_update',
  payload: {
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
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

export const mockWebSocketCriticalMessage: WebSocketMessage = {
  type: 'telemetry_update',
  payload: {
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
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

export const mockWebSocketDeviceStatusMessage: WebSocketMessage = {
  type: 'device_status',
  payload: {
    uptime_sec: 86400,
    firmware_version: '1.0.0',
    last_heartbeat: new Date().toISOString(),
    battery_level: 85,
    signal_strength: 92,
    online: true,
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

export const mockWebSocketRelayMessage: WebSocketMessage = {
  type: 'relay_update',
  payload: {
    strobe: true,
    door: true,
    siren: true,
    last_updated: new Date().toISOString(),
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

export const mockWebSocketAlertMessage: WebSocketMessage = {
  type: 'alert',
  payload: {
    id: 'alert-001',
    severity: 'CRITICAL',
    message: 'เตือนภัยดัชนี UV สูงจัด (12.5)',
    province: 'กรุงเทพมหานคร',
    timestamp: new Date().toISOString(),
    type: 'weather',
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

export const mockWebSocketCommandMessage: WebSocketMessage = {
  type: 'command',
  payload: {
    command: 'toggle_strobe',
    value: true,
    timestamp: new Date().toISOString(),
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

// WebSocket error scenarios
export const mockWebSocketMalformedMessage = {
  type: 'invalid',
  payload: null,
  timestamp: 'invalid-date',
};

export const mockWebSocketMissingTypeMessage = {
  payload: {
    uv_index: 5.5,
  },
  timestamp: new Date().toISOString(),
};

export const mockWebSocketNullPayloadMessage: WebSocketMessage = {
  type: 'telemetry_update',
  payload: null,
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

// Batch messages
export const mockWebSocketBatchMessages: WebSocketMessage[] = [
  mockWebSocketMessage,
  mockWebSocketDeviceStatusMessage,
  mockWebSocketRelayMessage,
];

// Heartbeat messages
export const mockWebSocketHeartbeatMessage: WebSocketMessage = {
  type: 'heartbeat',
  payload: {
    status: 'alive',
    uptime: 86400,
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};

// Connection messages
export const mockWebSocketConnectMessage: WebSocketMessage = {
  type: 'connect',
  payload: {
    deviceId: 'smart_building_001',
    firmware: '1.0.0',
  },
  timestamp: new Date().toISOString(),
};

export const mockWebSocketDisconnectMessage: WebSocketMessage = {
  type: 'disconnect',
  payload: {
    reason: 'connection_lost',
    code: 1006,
  },
  timestamp: new Date().toISOString(),
  deviceId: 'smart_building_001',
};
