/**
 * Firebase Realtime Database Client
 * Smart Building Command Center
 * 
 * Production-grade Firebase integration with:
 * - Connection state monitoring and automatic reconnection
 * - Data debouncing to prevent UI thrashing
 * - Data validation and sanitization
 * - Local caching for offline resilience
 * - Comprehensive error handling and retry logic
 * - Performance monitoring and logging
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDatabase,
  Database,
  ref,
  onValue,
  onDisconnect,
  set,
  get,
  update,
  remove,
  DatabaseReference,
  Unsubscribe,
  DataSnapshot
} from 'firebase/database';
import {
  FIREBASE_CONFIG,
  devicePath,
  FIREBASE_CONNECTION_CONFIG,
  DEBOUNCE_CONFIG,
  VALIDATION_CONFIG,
  RETRY_CONFIG,
  LOGGING_CONFIG,
  PERFORMANCE_CONFIG,
  SCHEMA_CONFIG,
  FIREBASE_PATHS,
  isFirebaseConfigured,
  isDevelopment
} from './config';
import {
  ConnectionState,
  TelemetryData,
  DeviceStatus,
  RelayState,
  FirebaseConnectionState,
  ErrorContext,
  RetryConfig,
  ValidationResult,
  CacheEntry,
  SeverityLevel
} from './firebase_types';
import { updateDashboardUI, createToast } from './ui_manager';
import { getCommunicationManager } from './communication_manager';

// ============================================================================
// GLOBAL STATE
// ============================================================================

export let db: Database | null = null;
export let firebaseApp: FirebaseApp | null = null;

/**
 * Current Firebase connection state
 */
let connectionState: FirebaseConnectionState = {
  state: ConnectionState.DISCONNECTED,
  reconnectAttempts: 0
};

/**
 * Map of active listeners for cleanup
 */
const activeListeners: Map<string, Unsubscribe> = new Map();

/**
 * Local cache for offline resilience
 */
const localCache: Map<string, CacheEntry<any>> = new Map();

/**
 * Operation log for debugging
 */
const operationLog: ErrorContext[] = [];

/**
 * Debounce timers map
 */
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Pending callbacks for debounced operations
 */
const pendingCallbacks: Map<string, any> = new Map();

/**
 * Connection status callback for UI updates
 */
let connectionStatusCallback: ((state: FirebaseConnectionState) => void) | null = null;
let lastAnnouncementRequestId = 0;

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log an operation with context
 */
const logOperation = (context: ErrorContext): void => {
  if (!LOGGING_CONFIG.enableLogging) return;

  const level = context.type === 'error' ? 'error' : 'info';
  if (LOGGING_CONFIG.logLevel === 'none') return;
  if (LOGGING_CONFIG.logLevel === 'error' && level !== 'error') return;
  if (LOGGING_CONFIG.logLevel === 'warn' && (level === 'info')) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[FIREBASE ${timestamp}] [${context.type.toUpperCase()}] ${context.message}`;
  
  if (context.path) {
    console[level](logMessage, { path: context.path, ...context.context });
  } else {
    console[level](logMessage, context.context);
  }

  // Add to in-memory log
  operationLog.push(context);
  if (operationLog.length > LOGGING_CONFIG.maxLogEntries) {
    operationLog.shift();
  }
};

/**
 * Log a read operation
 */
const logRead = (path: string, dataSize?: number, latency?: number): void => {
  if (!LOGGING_CONFIG.logReads) return;
  
  logOperation({
    type: 'read',
    message: 'Data read operation',
    timestamp: new Date().toISOString(),
    path,
    context: {
      dataSize,
      latency
    }
  });
};

/**
 * Log a write operation
 */
const logWrite = (path: string, dataSize?: number, latency?: number): void => {
  if (!LOGGING_CONFIG.logWrites) return;
  
  logOperation({
    type: 'write',
    message: 'Data write operation',
    timestamp: new Date().toISOString(),
    path,
    context: {
      dataSize,
      latency
    }
  });
};

/**
 * Log a connection event
 */
const logConnection = (event: string, details?: Record<string, any>): void => {
  if (!LOGGING_CONFIG.logConnectionEvents) return;
  
  logOperation({
    type: 'connection',
    message: `Connection event: ${event}`,
    timestamp: new Date().toISOString(),
    context: details
  });
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate telemetry data
 */
const validateTelemetry = (data: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Telemetry data is not an object');
    return { valid: false, errors };
  }

  // Validate numeric fields
  const numericFields = [
    'uv_index', 'temperature_2m', 'apparent_temperature',
    'relative_humidity_2m', 'precipitation', 'weather_code',
    'wind_speed_10m', 'wind_gusts_10m', 'river_discharge'
  ];

  for (const field of numericFields) {
    if (data[field] !== undefined && typeof data[field] !== 'number') {
      errors.push(`${field} must be a number`);
    }
  }

  // Validate ranges
  if (data.uv_index !== undefined && (data.uv_index < 0 || data.uv_index > 20)) {
    errors.push('uv_index out of valid range (0-20)');
  }

  if (data.temperature_2m !== undefined && (data.temperature_2m < -50 || data.temperature_2m > 60)) {
    errors.push('temperature_2m out of valid range (-50 to 60°C)');
  }

  if (data.relative_humidity_2m !== undefined && (data.relative_humidity_2m < 0 || data.relative_humidity_2m > 100)) {
    errors.push('relative_humidity_2m out of valid range (0-100%)');
  }

  if (data.weather_code !== undefined && (data.weather_code < 0 || data.weather_code > 99)) {
    errors.push('weather_code out of valid range (0-99)');
  }

  // Validate severity
  if (data.severity !== undefined && !['NORMAL', 'WARNING', 'CRITICAL'].includes(data.severity)) {
    errors.push('severity must be one of: NORMAL, WARNING, CRITICAL');
  }

  // Validate schema version
  if (data._version !== undefined && data._version > SCHEMA_CONFIG.currentVersion) {
    errors.push(`Schema version ${data._version} is not supported (current: ${SCHEMA_CONFIG.currentVersion})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate status data
 */
const validateStatus = (data: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Status data is not an object');
    return { valid: false, errors };
  }

  // Validate uptime
  if (data.uptime_sec !== undefined && (typeof data.uptime_sec !== 'number' || data.uptime_sec < 0)) {
    errors.push('uptime_sec must be a non-negative number');
  }

  // Validate battery level
  if (data.battery_level !== undefined && (data.battery_level < 0 || data.battery_level > 100)) {
    errors.push('battery_level out of valid range (0-100)');
  }

  // Validate signal strength
  if (data.signal_strength !== undefined && (data.signal_strength < 0 || data.signal_strength > 100)) {
    errors.push('signal_strength out of valid range (0-100)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize data by removing invalid fields
 */
const sanitizeData = (data: any, validationErrors: string[]): any => {
  if (!VALIDATION_CONFIG.sanitizeInvalidData) return null;

  const sanitized = { ...data };
  
  // Remove fields that caused validation errors
  for (const error of validationErrors) {
    const match = error.match(/(\w+) must be/);
    if (match) {
      delete sanitized[match[1]];
    }
  }

  return sanitized;
};

// ============================================================================
// DEBOUNCING UTILITIES
// ============================================================================

/**
 * Debounce a function call
 */
const debounce = <T>(
  key: string,
  callback: (data: T) => void,
  data: T,
  delayMs: number
): void => {
  // Clear existing timer
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Store pending data
  pendingCallbacks.set(key, { callback, data });

  // Set new timer
  const timer = setTimeout(() => {
    const pending = pendingCallbacks.get(key);
    if (pending) {
      pending.callback(pending.data);
      pendingCallbacks.delete(key);
    }
    debounceTimers.delete(key);
  }, delayMs);

  debounceTimers.set(key, timer);
};

/**
 * Clear all debounce timers
 */
const clearDebounceTimers = (): void => {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  pendingCallbacks.clear();
};

// ============================================================================
// CACHING UTILITIES
// ============================================================================

/**
 * Get data from cache
 */
const getFromCache = <T>(key: string): T | null => {
  const entry = localCache.get(key);
  if (!entry) return null;

  const age = Date.now() - new Date(entry.timestamp).getTime();
  if (age > FIREBASE_CONNECTION_CONFIG.cacheTTL) {
    localCache.delete(key);
    return null;
  }

  return entry.data as T;
};

/**
 * Set data in cache
 */
const setCache = <T>(key: string, data: T, isOffline = false): void => {
  localCache.set(key, {
    data,
    timestamp: new Date().toISOString(),
    key,
    isOffline
  });

  // Limit cache size
  if (localCache.size > 100) {
    const oldestKey = localCache.keys().next().value;
    localCache.delete(oldestKey);
  }
};

/**
 * Clear cache
 */
const clearCache = (): void => {
  localCache.clear();
};

// ============================================================================
// RETRY UTILITIES
// ============================================================================

/**
 * Calculate delay with exponential backoff and jitter
 */
const calculateDelay = (attempt: number, config: RetryConfig): number => {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  if (config.jitter) {
    const jitter = cappedDelay * 0.1 * Math.random();
    return cappedDelay + jitter;
  }
  
  return cappedDelay;
};

/**
 * Retry an operation with exponential backoff
 */
const retryOperation = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  context: string
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < config.maxAttempts - 1) {
        const delay = calculateDelay(attempt, config);
        logOperation({
          type: 'error',
          message: `Retry attempt ${attempt + 1}/${config.maxAttempts} for ${context}`,
          timestamp: new Date().toISOString(),
          context: { delay, nextAttemptIn: delay }
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Update connection state
 */
const updateConnectionState = (state: ConnectionState, details?: Record<string, any>): void => {
  const oldState = connectionState.state;
  connectionState.state = state;
  
  if (details) {
    Object.assign(connectionState, details);
  }

  if (oldState !== state) {
    logConnection(`State changed: ${oldState} -> ${state}`, details);
    
    // Notify UI callback
    if (connectionStatusCallback) {
      connectionStatusCallback(connectionState);
    }
  }
};

/**
 * Attempt to reconnect to Firebase
 */
const attemptReconnect = async (): Promise<void> => {
  if (connectionState.state === ConnectionState.CONNECTING ||
      connectionState.state === ConnectionState.RECONNECTING) {
    return;
  }

  updateConnectionState(ConnectionState.RECONNECTING);
  
  const maxAttempts = FIREBASE_CONNECTION_CONFIG.maxReconnectAttempts;
  const attempt = connectionState.reconnectAttempts + 1;
  
  if (maxAttempts >= 0 && attempt > maxAttempts) {
    updateConnectionState(ConnectionState.ERROR, {
      lastError: 'Max reconnection attempts reached'
    });
    return;
  }

  connectionState.reconnectAttempts = attempt;
  
  const delay = calculateDelay(
    attempt - 1,
    {
      maxAttempts: maxAttempts >= 0 ? maxAttempts : 100,
      initialDelay: FIREBASE_CONNECTION_CONFIG.initialReconnectDelay,
      maxDelay: FIREBASE_CONNECTION_CONFIG.maxReconnectDelay,
      backoffMultiplier: FIREBASE_CONNECTION_CONFIG.reconnectBackoffMultiplier,
      jitter: FIREBASE_CONNECTION_CONFIG.reconnectJitter
    }
  );

  logConnection(`Reconnection attempt ${attempt} in ${delay.toFixed(0)}ms`);

  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    // Re-initialize Firebase
    if (firebaseApp) {
      await initializeFirebase();
    }
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Reconnection failed',
      timestamp: new Date().toISOString(),
      context: { error: error.message, attempt }
    });
    
    // Schedule next reconnection attempt
    attemptReconnect();
  }
};

/**
 * Monitor Firebase connection state
 */
const monitorConnection = (): void => {
  if (!db) return;

  const connectedRef = ref(db, '.info/connected');
  
  const unsubscribe = onValue(connectedRef, (snapshot: DataSnapshot) => {
    const connected = snapshot.val();
    
    if (connected) {
      updateConnectionState(ConnectionState.CONNECTED, {
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
        lastError: undefined
      });
      
      if (isDevelopment()) {
        createToast('Firebase connected', 'success');
      }
    } else {
      updateConnectionState(ConnectionState.DISCONNECTED);
      
      // Attempt reconnection
      attemptReconnect();
    }
  });

  activeListeners.set('connection', unsubscribe);
};

// ============================================================================
// DATA LISTENERS
// ============================================================================

/**
 * Handle incoming telemetry data
 */
const handleTelemetryData = (data: any): void => {
  // Validate data
  let telemetryData = data;
  if (VALIDATION_CONFIG.validateTelemetry) {
    const validation = validateTelemetry(data);
    
    if (!validation.valid) {
      if (VALIDATION_CONFIG.logValidationErrors) {
        logOperation({
          type: 'validation',
          message: 'Telemetry validation failed',
          timestamp: new Date().toISOString(),
          path: devicePath(FIREBASE_PATHS.TELEMETRY_LIVE),
          context: { errors: validation.errors }
        });
      }
      
      if (VALIDATION_CONFIG.sanitizeInvalidData) {
        telemetryData = sanitizeData(data, validation.errors);
      } else {
        return; // Reject invalid data
      }
    }
  }

  // Cache the data
  setCache(devicePath(FIREBASE_PATHS.TELEMETRY_LIVE), telemetryData);

  // Also send to communication manager for fallback mode
  try {
    const commManager = getCommunicationManager();
    commManager.handleFirebaseTelemetry(telemetryData);
  } catch (error) {
    // Communication manager may not be initialized yet
    console.log('[Firebase] Communication manager not available for telemetry forwarding');
  }

  // Debounce UI update
  debounce(
    'telemetry',
    (debouncedData: any) => {
      const startTime = performance.now();
      
      updateDashboardUI(
        debouncedData,
        debouncedData.severity || 'NORMAL',
        debouncedData.province || 'Bangkok'
      );
      
      const latency = performance.now() - startTime;
      if (PERFORMANCE_CONFIG.trackLatency && latency > PERFORMANCE_CONFIG.slowOperationThreshold) {
        logOperation({
          type: 'unknown',
          message: `Slow telemetry update: ${latency.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
          context: { latency }
        });
      }
    },
    telemetryData,
    DEBOUNCE_CONFIG.telemetryDebounceMs
  );
};

/**
 * Handle incoming status data
 */
const handleStatusData = (data: any): void => {
  // Validate data
  let statusData = data;
  if (VALIDATION_CONFIG.validateStatus) {
    const validation = validateStatus(data);
    
    if (!validation.valid) {
      if (VALIDATION_CONFIG.logValidationErrors) {
        logOperation({
          type: 'validation',
          message: 'Status validation failed',
          timestamp: new Date().toISOString(),
          path: devicePath(FIREBASE_PATHS.STATUS),
          context: { errors: validation.errors }
        });
      }
      
      if (VALIDATION_CONFIG.sanitizeInvalidData) {
        statusData = sanitizeData(data, validation.errors);
      } else {
        return; // Reject invalid data
      }
    }
  }

  // Cache the data
  setCache(devicePath(FIREBASE_PATHS.STATUS), statusData);

  // Debounce UI update
  debounce(
    'status',
    (debouncedData: any) => {
      const uptimeEl = document.getElementById('uptimeDisplay');
      if (uptimeEl && debouncedData.uptime_sec !== undefined) {
        const h = Math.floor(debouncedData.uptime_sec / 3600);
        const m = Math.floor((debouncedData.uptime_sec % 3600) / 60);
        const s = debouncedData.uptime_sec % 60;
        uptimeEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }

      const firmwareEl = document.getElementById('firmwareDisplay');
      if (firmwareEl && debouncedData.firmware_version) {
        firmwareEl.textContent = debouncedData.firmware_version;
      }
    },
    statusData,
    DEBOUNCE_CONFIG.statusDebounceMs
  );
};

/**
 * Setup telemetry listener
 */
const setupTelemetryListener = (): void => {
  if (!db) return;

  const telemetryRef = ref(db, devicePath(FIREBASE_PATHS.TELEMETRY_LIVE));
  
  const unsubscribe = onValue(telemetryRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    
    if (data) {
      handleTelemetryData(data);
      logRead(devicePath(FIREBASE_PATHS.TELEMETRY_LIVE));
    } else {
      // Try to use cached data
      const cached = getFromCache<TelemetryData>(devicePath(FIREBASE_PATHS.TELEMETRY_LIVE));
      if (cached) {
        handleTelemetryData(cached);
      }
    }
  }, (error: Error) => {
    logOperation({
      type: 'error',
      message: 'Telemetry listener error',
      timestamp: new Date().toISOString(),
      path: devicePath(FIREBASE_PATHS.TELEMETRY_LIVE),
      context: { error: error.message },
      stack: error.stack
    });
  });

  activeListeners.set('telemetry', unsubscribe);
};

/**
 * Setup status listener
 */
const setupStatusListener = (): void => {
  if (!db) return;

  const statusRef = ref(db, devicePath(FIREBASE_PATHS.STATUS));
  
  const unsubscribe = onValue(statusRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    
    if (data) {
      handleStatusData(data);
      logRead(devicePath(FIREBASE_PATHS.STATUS));
    } else {
      // Try to use cached data
      const cached = getFromCache<DeviceStatus>(devicePath(FIREBASE_PATHS.STATUS));
      if (cached) {
        handleStatusData(cached);
      }
    }
  }, (error: Error) => {
    logOperation({
      type: 'error',
      message: 'Status listener error',
      timestamp: new Date().toISOString(),
      path: devicePath(FIREBASE_PATHS.STATUS),
      context: { error: error.message },
      stack: error.stack
    });
  });

  activeListeners.set('status', unsubscribe);
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize Firebase connection
 */
export const initializeFirebase = async (): Promise<boolean> => {
  try {
    // Check if Firebase is properly configured
    if (!isFirebaseConfigured()) {
      console.log("[FIREBASE] Using standalone direct satellite & simulation mode (not configured).");
      updateConnectionState(ConnectionState.DISCONNECTED, {
        lastError: 'Firebase not configured'
      });
      return false;
    }

    updateConnectionState(ConnectionState.CONNECTING);

    // Initialize Firebase app
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(firebaseApp);

    // Auto sign-in anonymously so auth != null for database security rules
    try {
      const auth = getAuth(firebaseApp);
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        logConnection(`Firebase authenticated anonymously as ${auth.currentUser?.uid}`);
      }
    } catch (authErr: any) {
      console.warn("[FIREBASE] Anonymous auth notice:", authErr?.message);
    }

    // Setup connection monitoring
    monitorConnection();

    // Setup data listeners
    setupTelemetryListener();
    setupStatusListener();

    logConnection('Firebase initialized successfully');
    
    return true;
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Firebase initialization failed',
      timestamp: new Date().toISOString(),
      context: { error: error.message },
      stack: error.stack
    });
    
    updateConnectionState(ConnectionState.ERROR, {
      lastError: error.message
    });
    
    console.warn("[FIREBASE] Running in standalone local mode:", error);
    createToast('Firebase connection failed, using offline mode', 'alert');
    
    return false;
  }
};

/**
 * Get current connection state
 */
export const getConnectionState = (): FirebaseConnectionState => {
  return { ...connectionState };
};

/**
 * Set connection status callback
 */
export const setConnectionStatusCallback = (callback: (state: FirebaseConnectionState) => void): void => {
  connectionStatusCallback = callback;
};

/**
 * Disconnect from Firebase
 */
export const disconnectFirebase = (): void => {
  // Clear all listeners
  for (const [key, unsubscribe] of activeListeners) {
    unsubscribe();
  }
  activeListeners.clear();

  // Clear debounce timers
  clearDebounceTimers();

  // Clear cache
  clearCache();

  // Reset state
  db = null;
  firebaseApp = null;
  updateConnectionState(ConnectionState.DISCONNECTED, {
    reconnectAttempts: 0,
    lastError: undefined
  });

  logConnection('Firebase disconnected');
};

/**
 * Manually trigger reconnection
 */
export const reconnectFirebase = async (): Promise<void> => {
  disconnectFirebase();
  connectionState.reconnectAttempts = 0;
  await initializeFirebase();
};

/**
 * Write data to Firebase with retry logic
 */
export const writeData = async (path: string, data: any): Promise<boolean> => {
  if (!db) {
    logOperation({
      type: 'error',
      message: 'Cannot write: Firebase not initialized',
      timestamp: new Date().toISOString(),
      path
    });
    return false;
  }

  try {
    const startTime = performance.now();
    
    await retryOperation(
      async () => {
        const dataRef = ref(db, path);
        await set(dataRef, data);
      },
      RETRY_CONFIG,
      `write to ${path}`
    );
    
    const latency = performance.now() - startTime;
    logWrite(path, JSON.stringify(data).length, latency);
    
    return true;
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Write operation failed',
      timestamp: new Date().toISOString(),
      path,
      context: { error: error.message },
      stack: error.stack
    });
    return false;
  }
};

/** Send a one-shot audible announcement cue or buzzer sound to the ESP32. */
export const requestEsp32Announcement = async (text: string, cueType: string = 'OFFICIAL'): Promise<void> => {
  if (!db || !firebaseApp) throw new Error('Firebase ยังไม่พร้อมเชื่อมต่อ');
  const announcementText = (text || cueType).replace(/\s+/g, ' ').trim().slice(0, 360);

  lastAnnouncementRequestId = Math.max(Date.now(), lastAnnouncementRequestId + 1);
  const requestId = lastAnnouncementRequestId;
  const commandFields = FIREBASE_PATHS.ANNOUNCEMENT_COMMAND.split('/');
  const commandIdFields = FIREBASE_PATHS.ANNOUNCEMENT_COMMAND_ID.split('/');
  const commandParent = commandFields.slice(0, -1).join('/');
  const commandRef = ref(db, devicePath(commandParent));

  await update(commandRef, {
    [commandFields[commandFields.length - 1]]: cueType,
    [commandIdFields[commandIdFields.length - 1]]: requestId,
    buzzer_command: cueType,
    buzzer_command_id: requestId,
    announcement_text: announcementText,
    updated_at: Date.now()
  });
};

/**
 * Update data in Firebase with retry logic
 */
export const updateData = async (path: string, data: any): Promise<boolean> => {
  if (!db) {
    logOperation({
      type: 'error',
      message: 'Cannot update: Firebase not initialized',
      timestamp: new Date().toISOString(),
      path
    });
    return false;
  }

  try {
    const startTime = performance.now();
    
    await retryOperation(
      async () => {
        const dataRef = ref(db, path);
        await update(dataRef, data);
      },
      RETRY_CONFIG,
      `update ${path}`
    );
    
    const latency = performance.now() - startTime;
    logWrite(path, JSON.stringify(data).length, latency);
    
    return true;
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Update operation failed',
      timestamp: new Date().toISOString(),
      path,
      context: { error: error.message },
      stack: error.stack
    });
    return false;
  }
};

/**
 * Read data from Firebase with retry logic
 */
export const readData = async <T>(path: string): Promise<T | null> => {
  if (!db) {
    logOperation({
      type: 'error',
      message: 'Cannot read: Firebase not initialized',
      timestamp: new Date().toISOString(),
      path
    });
    return null;
  }

  try {
    const startTime = performance.now();
    
    const result = await retryOperation(
      async () => {
        const dataRef = ref(db, path);
        const snapshot = await get(dataRef);
        return snapshot.val();
      },
      RETRY_CONFIG,
      `read from ${path}`
    );
    
    const latency = performance.now() - startTime;
    logRead(path, JSON.stringify(result).length, latency);
    
    return result;
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Read operation failed',
      timestamp: new Date().toISOString(),
      path,
      context: { error: error.message },
      stack: error.stack
    });
    
    // Try to return cached data
    return getFromCache<T>(path);
  }
};

/**
 * Get operation log
 */
export const getOperationLog = (): ErrorContext[] => {
  return [...operationLog];
};

/**
 * Clear operation log
 */
export const clearOperationLog = (): void => {
  operationLog.length = 0;
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: localCache.size,
    keys: Array.from(localCache.keys())
  };
};
