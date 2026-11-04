/**
 * WebSocket Message Protocol Definitions
 * Version: 1.0.0
 * 
 * This file defines the JSON-based message format for bi-directional
 * communication between the web dashboard and ESP32 devices.
 */

export const PROTOCOL_VERSION = "1.0.0";

/**
 * Message types supported by the WebSocket protocol
 */
export enum MessageType {
  TELEMETRY = "telemetry",       // Live sensor data from ESP32
  COMMAND = "command",           // Command sent to ESP32
  ACK = "ack",                   // Acknowledgment for received commands
  ERROR = "error",               // Error message
  CONFIG = "config",             // Configuration updates
  HEARTBEAT = "heartbeat",       // Ping/Pong for connection health
  STATUS = "status"              // Device status updates
}

/**
 * Command types that can be sent to ESP32
 */
export enum CommandType {
  TOGGLE_STROBE = "toggle_strobe",
  TOGGLE_DOOR = "toggle_door",
  SILENCE_ALARM = "silence_alarm",
  TEST_SIREN = "test_siren",
  SET_CONFIG = "set_config",
  REBOOT_DEVICE = "reboot_device",
  GET_STATUS = "get_status"
}

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error"
}

/**
 * Base message structure with versioning
 */
export interface BaseMessage {
  version: string;
  type: MessageType;
  timestamp: number;
  id: string;
}

/**
 * Telemetry message from ESP32
 */
export interface TelemetryMessage extends BaseMessage {
  type: MessageType.TELEMETRY;
  payload: {
    device_id: string;
    temperature?: number;
    humidity?: number;
    uv_index?: number;
    wind_speed?: number;
    wind_gusts?: number;
    precipitation?: number;
    weather_code?: number;
    river_discharge?: number;
    relay_states?: {
      strobe: boolean;
      door: boolean;
      siren: boolean;
    };
    battery_level?: number;
    signal_strength?: number;
    uptime_sec?: number;
  };
}

/**
 * Command message sent to ESP32
 */
export interface CommandMessage extends BaseMessage {
  type: MessageType.COMMAND;
  payload: {
    command: CommandType;
    params?: Record<string, any>;
    retry_count?: number;
  };
}

/**
 * Acknowledgment message from ESP32
 */
export interface AckMessage extends BaseMessage {
  type: MessageType.ACK;
  payload: {
    command_id: string;
    success: boolean;
    message?: string;
    result?: any;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Configuration message
 */
export interface ConfigMessage extends BaseMessage {
  type: MessageType.CONFIG;
  payload: {
    config_key: string;
    config_value: any;
  };
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends BaseMessage {
  type: MessageType.HEARTBEAT;
  payload: {
    sequence: number;
  };
}

/**
 * Status message from ESP32
 */
export interface StatusMessage extends BaseMessage {
  type: MessageType.STATUS;
  payload: {
    device_id: string;
    online: boolean;
    uptime_sec: number;
    firmware_version: string;
    last_boot_reason?: string;
  };
}

/**
 * Union type for all WebSocket messages
 */
export type WebSocketMessage = 
  | TelemetryMessage 
  | CommandMessage 
  | AckMessage 
  | ErrorMessage 
  | ConfigMessage 
  | HeartbeatMessage 
  | StatusMessage;

/**
 * Command queue item for tracking sent commands
 */
export interface QueuedCommand {
  id: string;
  command: CommandType;
  params?: Record<string, any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  status: 'pending' | 'acknowledged' | 'failed' | 'timeout';
  callback?: (success: boolean, result?: any) => void;
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  url: string;
  deviceId: string;
  authToken?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  enableSecureMode?: boolean;
}

/**
 * Connection status callback data
 */
export interface ConnectionStatus {
  state: ConnectionState;
  latency?: number;
  lastError?: string;
  reconnectAttempt?: number;
}

/**
 * Message handler callback type
 */
export type MessageHandler = (message: WebSocketMessage) => void;

/**
 * Connection status handler callback type
 */
export type ConnectionStatusHandler = (status: ConnectionStatus) => void;
