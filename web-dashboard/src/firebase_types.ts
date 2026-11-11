/**
 * Firebase Realtime Database Type Definitions
 * Smart Building Command Center
 * 
 * This file defines the TypeScript interfaces for Firebase data structures,
 * ensuring type safety and documentation for the data schema.
 */

/**
 * Connection state enumeration for Firebase
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Severity levels for threat assessment
 */
export enum SeverityLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

/**
 * Telemetry data structure for live weather/environmental readings
 */
export interface TelemetryData {
  /** UV Index (0-15+) */
  uv_index?: number;
  /** Air temperature at 2m height (°C) */
  temperature_2m?: number;
  /** Apparent/feels-like temperature (°C) */
  apparent_temperature?: number;
  /** Relative humidity at 2m height (%) */
  relative_humidity_2m?: number;
  /** Precipitation rate (mm/h) */
  precipitation?: number;
  /** WMO weather code (0-99) */
  weather_code?: number;
  /** Wind speed at 10m height (km/h) */
  wind_speed_10m?: number;
  /** Wind gusts at 10m height (km/h) */
  wind_gusts_10m?: number;
  /** River discharge rate (m³/s) */
  river_discharge?: number;
  /** Computed severity level */
  severity?: SeverityLevel;
  /** Province name (Thai) */
  province?: string;
  /** Timestamp of the reading (ISO 8601) */
  timestamp?: string;
  /** Data version for schema migration */
  _version?: number;
}

/**
 * Device status information
 */
export interface DeviceStatus {
  /** Device uptime in seconds */
  uptime_sec?: number;
  /** Firmware version string */
  firmware_version?: string;
  /** Last heartbeat timestamp (ISO 8601) */
  last_heartbeat?: string;
  /** Battery level (0-100) if applicable */
  battery_level?: number;
  /** Signal strength (0-100) if applicable */
  signal_strength?: number;
  /** Device online status */
  online?: boolean;
  /** Data version for schema migration */
  _version?: number;
}

/** Sensor values from inside the building; separate from outdoor weather. */
export interface IndoorSensorTelemetry {
  dht11?: {
    valid?: boolean;
    temperature_c?: number;
    humidity_percent?: number;
  };
  pir?: {
    ready?: boolean;
    valid?: boolean;
    motion_detected?: boolean;
    system_enabled?: boolean;
  };
  updated_at?: number;
}

/** ESP32 acknowledgement for a requested home LED state. */
export interface HomeLedState {
  state?: 'ON' | 'OFF';
  request_id?: number;
  updated_at?: number;
}

/** ESP32 acknowledgement for a requested hobby-servo position. */
export interface HomeServoState {
  state?: 'OPEN' | 'CLOSED';
  locked?: boolean;
  last_command?: 'LOCK' | 'UNLOCK' | 'OPEN' | 'CLOSED' | 'SYNC';
  result?: 'APPLIED' | 'BLOCKED_LOCKED' | 'READY';
  request_id?: number;
  updated_at?: number;
}

/** ESP32 acknowledgement for the servo 5V power supply rail switch. */
export interface HomeServoPowerState {
  enabled?: boolean;
  request_id?: number;
  updated_at?: number;
}

/** ESP32 acknowledgement for the PIR-triggered motion alert system toggle. */
export interface HomeMotionSystemState {
  enabled?: boolean;
  request_id?: number;
  updated_at?: number;
}

/**
 * Relay control state
 */
export interface RelayState {
  /** Strobe light relay state */
  strobe?: boolean;
  /** Emergency door lock state */
  door?: boolean;
  /** Siren state */
  siren?: boolean;
  /** Last updated timestamp (ISO 8601) */
  last_updated?: string;
  /** Data version for schema migration */
  _version?: number;
}

/**
 * Alert log entry
 */
export interface AlertLog {
  /** Unique alert ID */
  id: string;
  /** Severity level */
  severity: SeverityLevel;
  /** Alert message */
  message: string;
  /** Province name (Thai) */
  province: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Alert type (weather, device, system) */
  type: 'weather' | 'device' | 'system';
  /** Whether alert was acknowledged */
  acknowledged?: boolean;
  /** Data version for schema migration */
  _version?: number;
}

/**
 * Device configuration
 */
export interface DeviceConfig {
  /** Province name for weather monitoring */
  province?: string;
  /** Polling interval in seconds */
  polling_interval?: number;
  /** Alert thresholds */
  thresholds?: {
    uv_critical?: number;
    uv_warning?: number;
    heat_critical?: number;
    heat_warning?: number;
    wind_critical?: number;
    wind_warning?: number;
    rain_critical?: number;
    rain_warning?: number;
    river_warning?: number;
  };
  /** Data version for schema migration */
  _version?: number;
}

/**
 * Complete device data structure
 */
export interface DeviceData {
  /** Live telemetry data */
  telemetry?: {
    live?: TelemetryData;
    historical?: Record<string, TelemetryData>;
  };
  /** Device status */
  status?: DeviceStatus;
  /** Relay states */
  relays?: RelayState;
  /** Alert history */
  alerts?: AlertLog[];
  /** Device configuration */
  config?: DeviceConfig;
}

/**
 * Firebase connection state
 */
export interface FirebaseConnectionState {
  /** Current connection state */
  state: ConnectionState;
  /** Last connected timestamp (ISO 8601) */
  lastConnected?: string;
  /** Reconnection attempt count */
  reconnectAttempts: number;
  /** Last error message */
  lastError?: string;
  /** Connection latency in ms */
  latency?: number;
}

/**
 * Debounced data callback
 */
export interface DebouncedCallback<T> {
  (data: T): void;
}

/**
 * Error context for logging
 */
export interface ErrorContext {
  /** Error type/category */
  type: 'connection' | 'read' | 'write' | 'validation' | 'unknown' | 'error' | 'info';
  /** Error message */
  message: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Related Firebase path */
  path?: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Stack trace if available */
  stack?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Whether to jitter the delay */
  jitter: boolean;
}

/**
 * Data validation result
 */
export interface ValidationResult {
  /** Whether data is valid */
  valid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Sanitized data */
  sanitized?: any;
}

/**
 * Local cache entry
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when cached (ISO 8601) */
  timestamp: string;
  /** Cache key */
  key: string;
  /** Whether data is from offline mode */
  isOffline: boolean;
}
