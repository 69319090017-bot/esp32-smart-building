/**
 * Centralized state management store for Smart Building Command Center
 * Implements Redux-like pattern with immutable state updates and persistence
 */

import {
  AppState,
  Action,
  initialState,
  WeatherState,
  DeviceState,
  UIState,
  HistoryState,
  SettingsState,
  WeatherData,
  SeverityLevel,
  HistoryLog,
  ToastMessage
} from './store_types';

// ============================================================================
// REDUCERS
// ============================================================================

const weatherReducer = (state: WeatherState, action: Action): WeatherState => {
  switch (action.type) {
    case 'WEATHER_FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
        province: action.province
      };

    case 'WEATHER_FETCH_SUCCESS':
      return {
        ...state,
        data: action.data,
        severity: action.severity,
        province: action.province,
        lastUpdated: new Date(),
        isLoading: false,
        error: null
      };

    case 'WEATHER_FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.error
      };

    case 'WEATHER_SET_PROVINCE':
      return {
        ...state,
        province: action.province
      };

    default:
      return state;
  }
};

const deviceReducer = (state: DeviceState, action: Action): DeviceState => {
  switch (action.type) {
    case 'DEVICE_TOGGLE_STROBE':
      return {
        ...state,
        status: {
          ...state.status,
          strobe: !state.status.strobe,
          lastCommand: new Date()
        }
      };

    case 'DEVICE_TOGGLE_DOOR':
      return {
        ...state,
        status: {
          ...state.status,
          emergencyDoor: !state.status.emergencyDoor,
          lastCommand: new Date()
        }
      };

    case 'DEVICE_SILENCE_SIREN':
      return {
        ...state,
        status: {
          ...state.status,
          siren: false,
          lastCommand: new Date()
        }
      };

    case 'DEVICE_TEST_SIREN':
      return {
        ...state,
        status: {
          ...state.status,
          siren: true,
          lastCommand: new Date()
        }
      };

    case 'DEVICE_SET_STATUS':
      return {
        ...state,
        status: {
          ...state.status,
          ...action.status,
          lastCommand: new Date()
        }
      };

    case 'DEVICE_SET_CONNECTED':
      return {
        ...state,
        isConnected: action.connected,
        lastHeartbeat: action.connected ? new Date() : null
      };

    case 'DEVICE_SET_FIRMWARE':
      return {
        ...state,
        firmwareVersion: action.version
      };

    default:
      return state;
  }
};

const uiReducer = (state: UIState, action: Action): UIState => {
  switch (action.type) {
    case 'UI_SET_VIEW':
      return {
        ...state,
        currentView: action.view
      };

    case 'UI_TOGGLE_LANGUAGE':
      const newLang = state.language === 'th' ? 'en' : 'th';
      localStorage.setItem('sbc_lang', newLang);
      return {
        ...state,
        language: newLang
      };

    case 'UI_ADD_TOAST': {
      const newToast: ToastMessage = {
        id: generateId(),
        message: action.message,
        type: action.toastType,
        timestamp: new Date()
      };
      return {
        ...state,
        toasts: [...state.toasts, newToast]
      };
    }

    case 'UI_REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.id)
      };

    case 'UI_CLEAR_TOASTS':
      return {
        ...state,
        toasts: []
      };

    case 'UI_TOGGLE_SIDEBAR':
      return {
        ...state,
        isSidebarOpen: !state.isSidebarOpen
      };

    case 'UI_INCREMENT_UPTIME':
      return {
        ...state,
        uptime: state.uptime + 1
      };

    default:
      return state;
  }
};

const historyReducer = (state: HistoryState, action: Action): HistoryState => {
  switch (action.type) {
    case 'HISTORY_ADD_LOG': {
      const newLog: HistoryLog = {
        id: generateId(),
        ...action.log,
        timestamp: new Date()
      };
      const logs = [newLog, ...state.logs];
      return {
        ...state,
        logs: logs.slice(0, state.maxLogs)
      };
    }

    case 'HISTORY_CLEAR_LOGS':
      return {
        ...state,
        logs: []
      };

    case 'HISTORY_SET_MAX_LOGS':
      return {
        ...state,
        maxLogs: action.max,
        logs: state.logs.slice(0, action.max)
      };

    default:
      return state;
  }
};

const settingsReducer = (state: SettingsState, action: Action): SettingsState => {
  switch (action.type) {
    case 'SETTINGS_UPDATE':
      const newSettings = { ...state, ...action.settings };
      persistSettings(newSettings);
      return newSettings;

    case 'SETTINGS_RESET':
      localStorage.removeItem('sbc_settings');
      return {
        pollingInterval: 60000,
        autoAlert: true,
        speechEnabled: true,
        telegramEnabled: true,
        theme: 'auto'
      };

    default:
      return state;
  }
};

// ============================================================================
// MAIN REDUCER
// ============================================================================

const rootReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'STATE_RESET':
      return { ...initialState };

    case 'STATE_HYDRATE':
      return {
        ...state,
        ...action.state
      };

    default:
      return {
        weather: weatherReducer(state.weather, action),
        device: deviceReducer(state.device, action),
        ui: uiReducer(state.ui, action),
        history: historyReducer(state.history, action),
        settings: settingsReducer(state.settings, action)
      };
  }
};

// ============================================================================
// STORE CLASS
// ============================================================================

type Listener = (state: AppState) => void;
type Middleware = (action: Action, state: AppState, next: (action: Action) => void) => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private middleware: Middleware[] = [];
  private storageKey = 'sbc_state';

  constructor() {
    this.state = this.loadState();
  }

  // Get current state
  getState(): AppState {
    return this.state;
  }

  // Dispatch an action
  dispatch(action: Action): void {
    // Run middleware
    let index = 0;
    const runMiddleware = (currentAction: Action) => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index++];
        mw(currentAction, this.state, runMiddleware);
      } else {
        // Apply reducer
        const prevState = this.state;
        this.state = rootReducer(this.state, currentAction);

        // Persist state if changed
        if (prevState !== this.state) {
          this.persistState();
        }

        // Notify listeners
        this.notifyListeners();
      }
    };

    runMiddleware(action);
  }

  // Subscribe to state changes
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Add middleware
  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  // Load state from localStorage
  private loadState(): AppState {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initial state to handle new fields
        return {
          ...initialState,
          ...parsed,
          // Reset UI state that shouldn't persist
          ui: {
            ...initialState.ui,
            language: parsed.ui?.language || initialState.ui.language
          }
        };
      }
    } catch (error) {
      console.error('Error loading state from storage:', error);
    }
    return { ...initialState };
  }

  // Persist state to localStorage
  private persistState(): void {
    try {
      const toSave = {
        weather: this.state.weather,
        device: this.state.device,
        settings: this.state.settings,
        history: this.state.history
      };
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving state to storage:', error);
    }
  }

  // Clear persisted state
  clearStorage(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('sbc_settings');
    this.state = { ...initialState };
    this.notifyListeners();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function persistSettings(settings: SettingsState): void {
  try {
    localStorage.setItem('sbc_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// ============================================================================
// CREATE STORE INSTANCE
// ============================================================================

export const store = new Store();

// ============================================================================
// CONVENIENCE SELECTORS
// ============================================================================

export const selectWeather = (state: AppState) => state.weather;
export const selectDevice = (state: AppState) => state.device;
export const selectUI = (state: AppState) => state.ui;
export const selectHistory = (state: AppState) => state.history;
export const selectSettings = (state: AppState) => state.settings;

export const selectCurrentSeverity = (state: AppState) => state.weather.severity;
export const selectIsLoading = (state: AppState) => state.weather.isLoading;
export const selectCurrentProvince = (state: AppState) => state.weather.province;
export const selectDeviceStatus = (state: AppState) => state.device.status;
export const selectCurrentView = (state: AppState) => state.ui.currentView;
export const selectLanguage = (state: AppState) => state.ui.language;
export const selectToasts = (state: AppState) => state.ui.toasts;

// ============================================================================
// CONVENIENCE ACTION CREATORS
// ============================================================================

export const actions = {
  // Weather actions
  fetchWeatherStart: (province: string) => ({
    type: 'WEATHER_FETCH_START' as const,
    province
  }),
  fetchWeatherSuccess: (data: WeatherData, severity: SeverityLevel, province: string) => ({
    type: 'WEATHER_FETCH_SUCCESS' as const,
    data,
    severity,
    province
  }),
  fetchWeatherError: (error: string) => ({
    type: 'WEATHER_FETCH_ERROR' as const,
    error
  }),
  setProvince: (province: string) => ({
    type: 'WEATHER_SET_PROVINCE' as const,
    province
  }),

  // Device actions
  toggleStrobe: () => ({ type: 'DEVICE_TOGGLE_STROBE' as const }),
  toggleDoor: () => ({ type: 'DEVICE_TOGGLE_DOOR' as const }),
  silenceSiren: () => ({ type: 'DEVICE_SILENCE_SIREN' as const }),
  testSiren: () => ({ type: 'DEVICE_TEST_SIREN' as const }),
  setDeviceStatus: (status: Partial<AppState['device']['status']>) => ({
    type: 'DEVICE_SET_STATUS' as const,
    status
  }),
  setDeviceConnected: (connected: boolean) => ({
    type: 'DEVICE_SET_CONNECTED' as const,
    connected
  }),
  setFirmwareVersion: (version: string) => ({
    type: 'DEVICE_SET_FIRMWARE' as const,
    version
  }),

  // UI actions
  setView: (view: AppState['ui']['currentView']) => ({
    type: 'UI_SET_VIEW' as const,
    view
  }),
  toggleLanguage: () => ({ type: 'UI_TOGGLE_LANGUAGE' as const }),
  addToast: (message: string, toastType: 'info' | 'success' | 'alert') => ({
    type: 'UI_ADD_TOAST' as const,
    message,
    toastType
  }),
  removeToast: (id: string) => ({
    type: 'UI_REMOVE_TOAST' as const,
    id
  }),
  clearToasts: () => ({ type: 'UI_CLEAR_TOASTS' as const }),
  toggleSidebar: () => ({ type: 'UI_TOGGLE_SIDEBAR' as const }),
  incrementUptime: () => ({ type: 'UI_INCREMENT_UPTIME' as const }),

  // History actions
  addHistoryLog: (log: Omit<HistoryLog, 'id' | 'timestamp'>) => ({
    type: 'HISTORY_ADD_LOG' as const,
    log
  }),
  clearHistory: () => ({ type: 'HISTORY_CLEAR_LOGS' as const }),
  setMaxLogs: (max: number) => ({
    type: 'HISTORY_SET_MAX_LOGS' as const,
    max
  }),

  // Settings actions
  updateSettings: (settings: Partial<SettingsState>) => ({
    type: 'SETTINGS_UPDATE' as const,
    settings
  }),
  resetSettings: () => ({ type: 'SETTINGS_RESET' as const }),

  // Global actions
  resetState: () => ({ type: 'STATE_RESET' as const }),
  hydrateState: (state: Partial<AppState>) => ({
    type: 'STATE_HYDRATE' as const,
    state
  })
};
