/**
 * Type definitions for the Smart Building Command Center state management system
 * All state structures, actions, and event types
 */

// ============================================================================
// WEATHER DATA TYPES
// ============================================================================

export interface WeatherData {
  uv_index: number;
  apparent_temperature: number;
  temperature_2m: number;
  weather_code: number;
  wind_gusts_10m: number;
  wind_speed_10m: number;
  precipitation: number;
  river_discharge: number;
  relative_humidity_2m?: number;
}

export type SeverityLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface WeatherState {
  data: WeatherData | null;
  severity: SeverityLevel;
  province: string;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// DEVICE STATE TYPES
// ============================================================================

export interface DeviceStatus {
  strobe: boolean;
  emergencyDoor: boolean;
  siren: boolean;
  lastCommand: Date | null;
}

export interface DeviceState {
  status: DeviceStatus;
  isConnected: boolean;
  lastHeartbeat: Date | null;
  firmwareVersion: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export type ViewName = 'dashboard' | 'history' | 'settings' | 'devices';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'alert';
  timestamp: Date;
}

export interface UIState {
  currentView: ViewName;
  language: 'th' | 'en';
  toasts: ToastMessage[];
  isSidebarOpen: boolean;
  uptime: number; // seconds
}

// ============================================================================
// HISTORY LOG TYPES
// ============================================================================

export interface HistoryLog {
  id: string;
  time: string;
  province: string;
  severity: SeverityLevel;
  description: string;
  metrics: string;
  timestamp: Date;
}

export interface HistoryState {
  logs: HistoryLog[];
  maxLogs: number;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface SettingsState {
  pollingInterval: number; // milliseconds
  autoAlert: boolean;
  speechEnabled: boolean;
  telegramEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
}

// ============================================================================
// APPLICATION STATE
// ============================================================================

export interface AppState {
  weather: WeatherState;
  device: DeviceState;
  ui: UIState;
  history: HistoryState;
  settings: SettingsState;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

export const initialWeatherState: WeatherState = {
  data: null,
  severity: 'NORMAL',
  province: 'กรุงเทพมหานคร',
  lastUpdated: null,
  isLoading: false,
  error: null
};

export const initialDeviceState: DeviceState = {
  status: {
    strobe: false,
    emergencyDoor: false,
    siren: false,
    lastCommand: null
  },
  isConnected: false,
  lastHeartbeat: null,
  firmwareVersion: '1.0.0'
};

export const initialUIState: UIState = {
  currentView: 'dashboard',
  language: (localStorage.getItem('sbc_lang') as 'th' | 'en') || 'th',
  toasts: [],
  isSidebarOpen: true,
  uptime: 0
};

export const initialHistoryState: HistoryState = {
  logs: [],
  maxLogs: 50
};

export const initialSettingsState: SettingsState = {
  pollingInterval: 60000,
  autoAlert: true,
  speechEnabled: true,
  telegramEnabled: true,
  theme: 'auto'
};

export const initialState: AppState = {
  weather: initialWeatherState,
  device: initialDeviceState,
  ui: initialUIState,
  history: initialHistoryState,
  settings: initialSettingsState
};

// ============================================================================
// ACTION TYPES
// ============================================================================

export type Action =
  // Weather Actions
  | { type: 'WEATHER_FETCH_START'; province: string }
  | { type: 'WEATHER_FETCH_SUCCESS'; data: WeatherData; severity: SeverityLevel; province: string }
  | { type: 'WEATHER_FETCH_ERROR'; error: string }
  | { type: 'WEATHER_SET_PROVINCE'; province: string }

  // Device Actions
  | { type: 'DEVICE_TOGGLE_STROBE' }
  | { type: 'DEVICE_TOGGLE_DOOR' }
  | { type: 'DEVICE_SILENCE_SIREN' }
  | { type: 'DEVICE_TEST_SIREN' }
  | { type: 'DEVICE_SET_STATUS'; status: Partial<DeviceStatus> }
  | { type: 'DEVICE_SET_CONNECTED'; connected: boolean }
  | { type: 'DEVICE_SET_FIRMWARE'; version: string }

  // UI Actions
  | { type: 'UI_SET_VIEW'; view: ViewName }
  | { type: 'UI_TOGGLE_LANGUAGE' }
  | { type: 'UI_ADD_TOAST'; message: string; toastType: 'info' | 'success' | 'alert' }
  | { type: 'UI_REMOVE_TOAST'; id: string }
  | { type: 'UI_CLEAR_TOASTS' }
  | { type: 'UI_TOGGLE_SIDEBAR' }
  | { type: 'UI_INCREMENT_UPTIME' }

  // History Actions
  | { type: 'HISTORY_ADD_LOG'; log: Omit<HistoryLog, 'id' | 'timestamp'> }
  | { type: 'HISTORY_CLEAR_LOGS' }
  | { type: 'HISTORY_SET_MAX_LOGS'; max: number }

  // Settings Actions
  | { type: 'SETTINGS_UPDATE'; settings: Partial<SettingsState> }
  | { type: 'SETTINGS_RESET' }

  // Global Actions
  | { type: 'STATE_RESET' }
  | { type: 'STATE_HYDRATE'; state: Partial<AppState> };

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventType =
  | 'weather:updated'
  | 'weather:error'
  | 'device:changed'
  | 'device:connected'
  | 'device:disconnected'
  | 'alert:triggered'
  | 'alert:cleared'
  | 'user:action'
  | 'system:startup'
  | 'system:error';

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  source: string;
}

export interface WeatherUpdatedEvent extends BaseEvent {
  type: 'weather:updated';
  data: WeatherData;
  severity: SeverityLevel;
  province: string;
}

export interface WeatherErrorEvent extends BaseEvent {
  type: 'weather:error';
  error: string;
  province: string;
}

export interface DeviceChangedEvent extends BaseEvent {
  type: 'device:changed';
  device: string;
  action: string;
  previousValue: any;
  newValue: any;
}

export interface DeviceConnectedEvent extends BaseEvent {
  type: 'device:connected';
  deviceId: string;
}

export interface DeviceDisconnectedEvent extends BaseEvent {
  type: 'device:disconnected';
  deviceId: string;
  reason?: string;
}

export interface AlertTriggeredEvent extends BaseEvent {
  type: 'alert:triggered';
  severity: SeverityLevel;
  message: string;
  province: string;
}

export interface AlertClearedEvent extends BaseEvent {
  type: 'alert:cleared';
  severity: SeverityLevel;
}

export interface UserActionEvent extends BaseEvent {
  type: 'user:action';
  action: string;
  details?: Record<string, any>;
}

export interface SystemStartupEvent extends BaseEvent {
  type: 'system:startup';
  version: string;
}

export interface SystemErrorEvent extends BaseEvent {
  type: 'system:error';
  error: Error;
  context?: Record<string, any>;
}

export type AppEvent =
  | WeatherUpdatedEvent
  | WeatherErrorEvent
  | DeviceChangedEvent
  | DeviceConnectedEvent
  | DeviceDisconnectedEvent
  | AlertTriggeredEvent
  | AlertClearedEvent
  | UserActionEvent
  | SystemStartupEvent
  | SystemErrorEvent;

// ============================================================================
// EVENT LISTENER TYPES
// ============================================================================

export type EventListener<T extends AppEvent = AppEvent> = (event: T) => void | Promise<void>;

export interface EventSubscription {
  eventType: EventType;
  listener: EventListener;
  id: string;
}

// ============================================================================
// LOGGER TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
  includeTimestamp: boolean;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

export interface ValidationSchema<T> {
  validate: (data: unknown) => ValidationResult<T>;
  sanitize?: (data: unknown) => T;
}
