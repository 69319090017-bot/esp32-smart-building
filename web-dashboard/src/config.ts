/**
 * Firebase Configuration
 * Smart Building Command Center
 * 
 * Production-grade configuration with connection management,
 * retry logic, and performance optimization settings.
 */

const runtimeWindow = typeof window !== 'undefined' ? (window as any) : undefined;

// Firebase App Configuration
export const FIREBASE_CONFIG = runtimeWindow?.SMART_GARAGE_FIREBASE_CONFIG || {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBtClW_UjXsEmTNonV9Er0hhY9Azs73ApQ",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "projectsmart-home"}.firebaseapp.com`,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://projectsmart-home-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "projectsmart-home",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Device Configuration
const deviceUrlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
export const DEVICE_ID = deviceUrlParams.get('device') || import.meta.env.VITE_DEVICE_ID || runtimeWindow?.SMART_BUILDING_DEVICE_ID || "smart_building_001";
export const devicePath = (path: string) => `devices/${DEVICE_ID}/${path}`;

// Alert Configuration
export const MAX_ALERTS = 50;

/**
 * Firebase Connection Configuration
 */
export const FIREBASE_CONNECTION_CONFIG = {
  /** Connection timeout in milliseconds */
  connectionTimeout: 10000,
  /** Heartbeat interval in milliseconds to check connection health */
  heartbeatInterval: 30000,
  /** Maximum reconnection attempts before giving up (-1 for infinite) */
  maxReconnectAttempts: -1,
  /** Initial reconnection delay in milliseconds */
  initialReconnectDelay: 1000,
  /** Maximum reconnection delay in milliseconds */
  maxReconnectDelay: 30000,
  /** Exponential backoff multiplier for reconnection */
  reconnectBackoffMultiplier: 2,
  /** Whether to add jitter to reconnection delays */
  reconnectJitter: true,
  /** Enable offline persistence */
  enableOfflinePersistence: true,
  /** Maximum cache size in bytes (10MB default) */
  maxCacheSize: 10 * 1024 * 1024,
  /** Cache TTL in milliseconds (5 minutes) */
  cacheTTL: 5 * 60 * 1000,
} as const;

/**
 * Data Debouncing Configuration
 * Prevents UI thrashing from high-frequency updates
 */
export const DEBOUNCE_CONFIG = {
  /** Debounce delay for telemetry updates in milliseconds */
  telemetryDebounceMs: 500,
  /** Debounce delay for status updates in milliseconds */
  statusDebounceMs: 1000,
  /** Debounce delay for relay updates in milliseconds */
  relayDebounceMs: 200,
  /** Maximum wait time for debounced updates in milliseconds */
  maxWaitMs: 2000,
} as const;

/**
 * Data Validation Configuration
 */
export const VALIDATION_CONFIG = {
  /** Enable strict data validation */
  strictValidation: true,
  /** Validate telemetry data on receive */
  validateTelemetry: true,
  /** Validate status data on receive */
  validateStatus: true,
  /** Sanitize invalid data instead of rejecting */
  sanitizeInvalidData: true,
  /** Log validation errors */
  logValidationErrors: true,
} as const;

/**
 * Retry Configuration for Failed Operations
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts */
  maxAttempts: 3,
  /** Maximum retry attempts for read operations */
  readMaxAttempts: 3,
  /** Maximum retry attempts for write operations */
  writeMaxAttempts: 5,
  /** Initial retry delay in milliseconds */
  initialDelay: 1000,
  /** Maximum retry delay in milliseconds */
  maxDelay: 10000,
  /** Exponential backoff multiplier */
  backoffMultiplier: 2,
  /** Whether to add jitter to retry delays */
  jitter: true,
};

/**
 * Logging Configuration
 */
export const LOGGING_CONFIG = {
  /** Enable Firebase operation logging */
  enableLogging: true,
  /** Log level: 'debug', 'info', 'warn', 'error', 'none' */
  logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error' | 'none',
  /** Log read operations */
  logReads: true,
  /** Log write operations */
  logWrites: true,
  /** Log connection events */
  logConnectionEvents: true,
  /** Log validation errors */
  logValidationErrors: true,
  /** Maximum log entries to keep in memory */
  maxLogEntries: 100,
};

/**
 * Performance Monitoring Configuration
 */
export const PERFORMANCE_CONFIG = {
  /** Enable performance monitoring */
  enableMonitoring: true,
  /** Track operation latency */
  trackLatency: true,
  /** Alert on slow operations (ms) */
  slowOperationThreshold: 1000,
  /** Track data transfer size */
  trackDataSize: true,
} as const;

/**
 * Schema Version Configuration
 * For data migration and compatibility
 */
export const SCHEMA_CONFIG = {
  /** Current schema version */
  currentVersion: 1,
  /** Minimum supported schema version */
  minSupportedVersion: 1,
  /** Enable automatic schema migration */
  enableAutoMigration: true,
  /** Schema migration paths */
  migrationPaths: {
    1: 'v1_initial',
  } as const,
} as const;

/**
 * Security Configuration
 */
export const SECURITY_CONFIG = {
  /** Enable permission checks */
  enablePermissionChecks: true,
  /** Log permission violations */
  logPermissionViolations: true,
  /** Validate read permissions */
  validateReadPermissions: false, // Disabled for client-side app
  /** Validate write permissions */
  validateWritePermissions: true,
} as const;

/**
 * Firebase Data Schema Paths
 * Centralized path management for consistency
 */
export const FIREBASE_PATHS = {
  /** Live telemetry data */
  TELEMETRY_LIVE: 'telemetry/live',
  /** Indoor sensor telemetry, kept separate from outdoor weather */
  INDOOR_TELEMETRY_LIVE: 'telemetry/indoor/live',
  /** Historical telemetry data */
  TELEMETRY_HISTORY: 'telemetry/historical',
  /** Device status */
  STATUS: 'status',
  /** Relay states */
  RELAYS: 'relays',
  /** Authenticated LED command and ESP32 acknowledgement */
  HOME_LED_COMMAND: 'commands/led_command',
  HOME_LED_COMMAND_ID: 'commands/led_command_id',
  HOME_LED_STATE: 'commands/led_state',
  /** Authenticated hobby-servo command and ESP32 acknowledgement */
  HOME_SERVO_COMMAND: 'commands/servo_command',
  HOME_SERVO_COMMAND_ID: 'commands/servo_command_id',
  HOME_SERVO_STATE: 'commands/servo_state',
  /** Servo 5V power switch command and ESP32 acknowledgement */
  HOME_SERVO_POWER_COMMAND: 'commands/servo_power_enabled',
  HOME_SERVO_POWER_COMMAND_ID: 'commands/servo_power_command_id',
  HOME_SERVO_POWER_STATE: 'commands/servo_power_state',
  /** PIR-triggered LED/buzzer automation command and ESP32 acknowledgement */
  HOME_MOTION_SYSTEM_COMMAND: 'commands/motion_system_enabled',
  HOME_MOTION_SYSTEM_COMMAND_ID: 'commands/motion_system_command_id',
  HOME_MOTION_SYSTEM_STATE: 'commands/motion_system_state',
  /** One-shot request for the ESP32 PCM5102 announcement tone and its acknowledgement */
  ANNOUNCEMENT_COMMAND: 'commands/announcement_command',
  ANNOUNCEMENT_COMMAND_ID: 'commands/announcement_command_id',
  ANNOUNCEMENT_STATE: 'commands/announcement_state',
  /** Alert logs */
  ALERTS: 'alerts',
  /** Device configuration */
  CONFIG: 'config',
  /** Connection state (internal) */
  CONNECTION: '.info/connected',
} as const;

/**
 * Helper function to check if Firebase is properly configured
 */
export const isFirebaseConfigured = (): boolean => {
  const config = FIREBASE_CONFIG;
  return !!(
    config.apiKey &&
    !config.apiKey.includes('YOUR_') &&
    !config.apiKey.includes('AIzaSy_YOUR') &&
    config.projectId &&
    config.projectId !== 'your-project-id' &&
    config.databaseURL &&
    !config.databaseURL.includes('your-project')
  );
};

/**
 * Helper function to get environment name
 */
export const getEnvironment = (): 'development' | 'production' | 'test' => {
  return (import.meta.env.MODE || 'development') as 'development' | 'production' | 'test';
};

/**
 * Helper function to check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return getEnvironment() === 'development';
};

/**
 * WebSocket Configuration
 * Direct bi-directional communication with ESP32 devices
 */
const localHostnamePattern = /localhost|127\.0\.0\.1|\[::1\]/i;
const isLocalDevHost = typeof window !== 'undefined' && localHostnamePattern.test(window.location.hostname);
const websocketSecureOverride = import.meta.env.VITE_WEBSOCKET_SECURE;
const pilotUrlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
export const DEMO_PILOT_MODE = pilotUrlParams.get('demo') === '1' || import.meta.env.VITE_DEMO_MODE === 'true' || isLocalDevHost;

export const WEBSOCKET_CONFIG = {
  /** WebSocket server URL */
  url: import.meta.env.VITE_WEBSOCKET_URL || (window as any).SMART_BUILDING_WS_URL || "ws://localhost:8080/ws",
  /** Authentication token for WebSocket */
  authToken: import.meta.env.VITE_WEBSOCKET_AUTH_TOKEN || (window as any).SMART_BUILDING_WS_TOKEN || "",
  /** Automatic reconnect is disabled in pilot/demo mode so the app focuses on API + laptop audio first */
  autoReconnect: !DEMO_PILOT_MODE,
  /** Reconnection interval in milliseconds */
  reconnectInterval: 2000,
  /** Maximum reconnection attempts */
  maxReconnectAttempts: DEMO_PILOT_MODE ? 1 : 15,
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: 30000,
  /** Connection timeout in milliseconds */
  connectionTimeout: 10000,
  /** Enable secure WebSocket (wss://) only for secure remote deployments */
  enableSecureMode: websocketSecureOverride === undefined ? !isLocalDevHost : websocketSecureOverride !== 'false',
  /** Message buffer size for offline mode */
  messageBufferSize: 100,
  /** Rate limit: max messages per second */
  rateLimitMax: 10,
  /** Rate limit window in milliseconds */
  rateLimitWindow: 1000,
} as const;

/**
 * Fallback Configuration
 * Graceful degradation when WebSocket is unavailable
 */
export const FALLBACK_CONFIG = {
  /** Enable Firebase fallback when WebSocket fails */
  enableFirebaseFallback: true,
  /** Fallback polling interval in milliseconds */
  fallbackPollingInterval: 30000,
  /** Merge data from WebSocket and Firebase */
  mergeDataSources: true,
  /** Notify user when switching to fallback mode */
  notifyFallbackMode: true,
  /** Maximum time to wait for WebSocket before falling back (ms) */
  fallbackTimeout: 15000,
  /** Priority: 'websocket' | 'firebase' */
  dataSourcePriority: 'websocket' as const,
} as const;

