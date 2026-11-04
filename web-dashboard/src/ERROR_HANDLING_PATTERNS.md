# Firebase Error Handling Patterns
## Smart Building Command Center

This document describes the comprehensive error handling patterns implemented in the Firebase integration.

---

## Table of Contents
1. [Error Classification](#error-classification)
2. [Error Context Structure](#error-context-structure)
3. [Error Handling Strategies](#error-handling-strategies)
4. [Retry Mechanisms](#retry-mechanisms)
5. [User-Facing Error Messages](#user-facing-error-messages)
6. [Error Logging](#error-logging)
7. [Error Recovery](#error-recovery)
8. [Examples](#examples)

---

## Error Classification

Errors are classified into the following categories:

### 1. Connection Errors
- Firebase initialization failure
- Network connectivity issues
- Authentication failures
- Connection timeout

### 2. Read Errors
- Permission denied on read
- Data not found
- Malformed data
- Read timeout

### 3. Write Errors
- Permission denied on write
- Data validation failure
- Write conflict
- Write timeout

### 4. Validation Errors
- Invalid data format
- Out-of-range values
- Missing required fields
- Schema version mismatch

### 5. Unknown Errors
- Unexpected error types
- Unhandled exceptions

---

## Error Context Structure

Each error is captured with rich context for debugging:

```typescript
interface ErrorContext {
  type: 'connection' | 'read' | 'write' | 'validation' | 'unknown';
  message: string;
  timestamp: string;
  path?: string;
  context?: Record<string, any>;
  stack?: string;
}
```

### Example Error Context

```typescript
{
  type: 'read',
  message: 'Read operation failed',
  timestamp: '2026-01-15T10:30:00.000Z',
  path: 'devices/smart_building_001/telemetry/live',
  context: {
    error: 'Permission denied',
    dataSize: 1024,
    latency: 1500
  },
  stack: 'Error: Permission denied\n    at...'
}
```

---

## Error Handling Strategies

### 1. Try-Catch Wrappers

All Firebase operations are wrapped in try-catch blocks:

```typescript
try {
  const result = await get(dataRef);
  return result.val();
} catch (error: any) {
  logOperation({
    type: 'error',
    message: 'Read operation failed',
    timestamp: new Date().toISOString(),
    path,
    context: { error: error.message },
    stack: error.stack
  });
  throw error;
}
```

### 2. Error Boundaries

Each major operation has its own error boundary:

- **Initialization Boundary**: Handles Firebase initialization errors
- **Read Boundary**: Handles data read errors
- **Write Boundary**: Handles data write errors
- **Validation Boundary**: Handles data validation errors

### 3. Graceful Degradation

When errors occur, the system degrades gracefully:

```typescript
// Attempt Firebase read, fall back to cache
const firebaseData = await readData(path);
if (!firebaseData) {
  const cachedData = getFromCache(path);
  if (cachedData) {
    logOperation({
      type: 'read',
      message: 'Using cached data due to read failure',
      timestamp: new Date().toISOString(),
      path,
      context: { isOffline: true }
    });
    return cachedData;
  }
}
```

---

## Retry Mechanisms

### Exponential Backoff with Jitter

Retry operations use exponential backoff with jitter to prevent thundering herd:

```typescript
const calculateDelay = (attempt: number, config: RetryConfig): number => {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  if (config.jitter) {
    const jitter = cappedDelay * 0.1 * Math.random();
    return cappedDelay + jitter;
  }
  
  return cappedDelay;
};
```

### Retry Configuration

```typescript
export const RETRY_CONFIG = {
  readMaxAttempts: 3,
  writeMaxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
};
```

### Retry Operation Wrapper

```typescript
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
```

---

## User-Facing Error Messages

Error messages are translated to user-friendly notifications:

### Connection Errors

```typescript
// Firebase not configured
"FIREBASE_NOT_CONFIGURED" → "Using offline mode - Firebase not configured"

// Connection failed
"CONNECTION_FAILED" → "Firebase connection failed, using offline mode"

// Max reconnection attempts reached
"MAX_RECONNECT_ATTEMPTS" → "Unable to connect to Firebase. Please check your network connection."
```

### Read Errors

```typescript
// Permission denied
"READ_PERMISSION_DENIED" → "Unable to read data. Check your permissions."

// Data not found
"DATA_NOT_FOUND" → "Data not available. Using cached data if available."

// Read timeout
"READ_TIMEOUT" → "Data read timed out. Please try again."
```

### Write Errors

```typescript
// Permission denied
"WRITE_PERMISSION_DENIED" → "Unable to save data. Check your permissions."

// Validation failed
"VALIDATION_FAILED" → "Invalid data format. Please check your input."

// Write conflict
"WRITE_CONFLICT" → "Data was modified by another user. Please refresh and try again."
```

### Validation Errors

```typescript
// Invalid data format
"INVALID_FORMAT" → "Data format is invalid."

// Out of range
"OUT_OF_RANGE" → "Value is out of valid range."

// Missing required field
"MISSING_FIELD" → "Required field is missing."
```

### Toast Notification Examples

```typescript
// Success
createToast('Data updated successfully', 'success');

// Info
createToast('Connecting to Firebase...', 'info');

// Warning
createToast('Using cached data - Firebase unavailable', 'alert');

// Error
createToast('Failed to save data. Please try again.', 'alert');
```

---

## Error Logging

### In-Memory Log

Errors are logged to an in-memory buffer for debugging:

```typescript
const operationLog: ErrorContext[] = [];

const logOperation = (context: ErrorContext): void => {
  if (!LOGGING_CONFIG.enableLogging) return;

  const level = context.type === 'error' ? 'error' : 'info';
  console[level](`[FIREBASE ${context.timestamp}] [${context.type.toUpperCase()}] ${context.message}`, context.context);

  operationLog.push(context);
  if (operationLog.length > LOGGING_CONFIG.maxLogEntries) {
    operationLog.shift();
  }
};
```

### Log Levels

```typescript
export const LOGGING_CONFIG = {
  enableLogging: true,
  logLevel: 'info', // 'debug', 'info', 'warn', 'error', 'none'
  logReads: true,
  logWrites: true,
  logConnectionEvents: true,
  logValidationErrors: true,
  maxLogEntries: 100,
};
```

### Log Retrieval

```typescript
// Get all logs
export const getOperationLog = (): ErrorContext[] => {
  return [...operationLog];
};

// Clear logs
export const clearOperationLog = (): void => {
  operationLog.length = 0;
};
```

### Console Output Format

```
[FIREBASE 2026-01-15T10:30:00.000Z] [READ] Data read operation
  path: devices/smart_building_001/telemetry/live
  dataSize: 1024
  latency: 150

[FIREBASE 2026-01-15T10:30:01.000Z] [ERROR] Read operation failed
  path: devices/smart_building_001/telemetry/live
  error: Permission denied
```

---

## Error Recovery

### Automatic Reconnection

The system automatically attempts to reconnect on connection loss:

```typescript
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
  
  const delay = calculateDelay(attempt - 1, reconnectConfig);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    await initializeFirebase();
  } catch (error: any) {
    logOperation({
      type: 'error',
      message: 'Reconnection failed',
      timestamp: new Date().toISOString(),
      context: { error: error.message, attempt }
    });
    
    attemptReconnect();
  }
};
```

### Cache Fallback

When Firebase is unavailable, cached data is used:

```typescript
const cached = getFromCache<TelemetryData>(path);
if (cached) {
  handleTelemetryData(cached);
  logOperation({
    type: 'read',
    message: 'Using cached data',
    timestamp: new Date().toISOString(),
    path,
    context: { isOffline: true }
  });
}
```

### Manual Reconnection

Users can manually trigger reconnection:

```typescript
export const reconnectFirebase = async (): Promise<void> => {
  disconnectFirebase();
  connectionState.reconnectAttempts = 0;
  await initializeFirebase();
};
```

---

## Examples

### Example 1: Handling Read Failure with Retry

```typescript
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
    
    // Fallback to cache
    return getFromCache<T>(path);
  }
};
```

### Example 2: Handling Validation Error

```typescript
const handleTelemetryData = (data: any): void => {
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

  // Process valid data
  setCache(path, telemetryData);
  debounce('telemetry', updateUI, telemetryData, 500);
};
```

### Example 3: Handling Connection State Changes

```typescript
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
      attemptReconnect();
    }
  });

  activeListeners.set('connection', unsubscribe);
};
```

### Example 4: Handling Write Failure

```typescript
export const writeData = async (path: string, data: any): Promise<boolean> => {
  if (!db) {
    logOperation({
      type: 'error',
      message: 'Cannot write: Firebase not initialized',
      timestamp: new Date().toISOString(),
      path
    });
    createToast('Firebase not available for write', 'alert');
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
    
    createToast('Data saved successfully', 'success');
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
    
    createToast('Failed to save data. Please try again.', 'alert');
    return false;
  }
};
```

---

## Best Practices

### 1. Always Log Errors
Log all errors with context for debugging:

```typescript
logOperation({
  type: 'error',
  message: 'Descriptive error message',
  timestamp: new Date().toISOString(),
  path,
  context: { additionalContext },
  stack: error.stack
});
```

### 2. Provide User Feedback
Always inform users about errors:

```typescript
createToast('User-friendly error message', 'alert');
```

### 3. Implement Fallbacks
Provide fallback mechanisms when errors occur:

```typescript
// Try Firebase, fall back to cache
const data = await readFromFirebase(path) || getFromCache(path);
```

### 4. Use Retry Logic
Implement retry logic for transient failures:

```typescript
await retryOperation(operation, RETRY_CONFIG, context);
```

### 5. Validate Data
Validate data before processing:

```typescript
const validation = validateTelemetry(data);
if (!validation.valid) {
  handleValidationError(validation);
}
```

### 6. Monitor Performance
Track operation latency and alert on slow operations:

```typescript
const latency = performance.now() - startTime;
if (latency > PERFORMANCE_CONFIG.slowOperationThreshold) {
  logSlowOperation(latency);
}
```

---

## Summary

The Firebase error handling system provides:

- ✅ Comprehensive error classification
- ✅ Rich error context for debugging
- ✅ Automatic retry with exponential backoff
- ✅ Graceful degradation with cache fallback
- ✅ User-friendly error messages
- ✅ Detailed error logging
- ✅ Automatic reconnection
- ✅ Manual reconnection capability

This ensures the Smart Building Command Center remains resilient and provides a good user experience even when Firebase encounters issues.
