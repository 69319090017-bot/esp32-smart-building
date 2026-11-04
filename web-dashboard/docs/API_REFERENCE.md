# API Reference

## Table of Contents

1. [TypeScript Functions](#typescript-functions)
2. [Configuration Options](#configuration-options)
3. [WebSocket Protocol](#websocket-protocol)
4. [Firebase Data Schema](#firebase-data-schema)
5. [State Store Structure](#state-store-structure)
6. [Event Bus Events](#event-bus-events)
7. [External APIs](#external-apis)

## TypeScript Functions

### Device Controller Functions

#### `fetchOpenMeteoWeather(provinceName: string)`

Fetches weather data from Open-Meteo API for a given province.

**Parameters:**
- `provinceName` (string): Thai province name (e.g., "กรุงเทพมหานคร")

**Returns:** `Promise<{ weather: WeatherData; severity: string } | null>`

**Example:**
```typescript
const result = await fetchOpenMoteoWeather("กรุงเทพมหานคร");
if (result) {
  console.log(result.weather);
  console.log(result.severity);
}
```

**Error Handling:**
- Returns `null` on failure
- Shows toast notification with error message

---

#### `toggleStrobe()`

Toggles the strobe alarm relay state.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Updates UI pill indicator
- Shows toast notification
- Modifies global `currentStrobeState`

**Example:**
```typescript
toggleStrobe(); // Toggles strobe ON/OFF
```

---

#### `toggleEmergencyDoor()`

Toggles the emergency door lock relay state.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Updates UI pill indicator
- Shows toast notification
- Modifies global `currentDoorState`

**Example:**
```typescript
toggleEmergencyDoor(); // Toggles door lock UNLOCKED/LOCKED
```

---

#### `silenceAlarm()`

Silences the audio siren.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Updates siren status pill to "MUTED"
- Shows toast notification

**Example:**
```typescript
silenceAlarm(); // Silences siren
```

---

#### `testAudioSiren()`

Tests the audio siren with voice announcement.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Updates siren status pill to "TESTING SIREN"
- Speaks Thai test message
- Shows toast notification

**Example:**
```typescript
testAudioSiren(); // Tests siren
```

---

#### `sendTelegramAlert(message: string, severity: string, province: string)`

Sends an alert message to Telegram bot.

**Parameters:**
- `message` (string): Alert message content
- `severity` (string): "CRITICAL" or "WARNING"
- `province` (string): Thai province name

**Returns:** `Promise<void>`

**Example:**
```typescript
await sendTelegramAlert(
  "Extreme UV detected",
  "CRITICAL",
  "กรุงเทพมหานคร"
);
```

**Error Handling:**
- Shows toast notification on success/failure
- Logs error details to console

---

#### `exportHistoryCsv()`

Exports historical log data to CSV file.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Downloads CSV file with timestamp
- Shows toast notification

**Example:**
```typescript
exportHistoryCsv(); // Downloads disaster_history_YYYY-MM-DD.csv
```

---

### UI Manager Functions

#### `updateDashboardUI(weather: any, severity: string, province: string)`

Updates all dashboard UI elements with new weather data.

**Parameters:**
- `weather` (any): Weather data object from Open-Meteo
- `severity` (string): "NORMAL", "WARNING", or "CRITICAL"
- `province` (string): Thai province name

**Returns:** `void`

**Weather Data Structure:**
```typescript
{
  uv_index: number;
  apparent_temperature: number;
  temperature_2m: number;
  weather_code: number;
  wind_gusts_10m: number;
  wind_speed_10m: number;
  precipitation: number;
  river_discharge: number;
}
```

**Example:**
```typescript
updateDashboardUI(
  {
    uv_index: 9.5,
    apparent_temperature: 38.0,
    temperature_2m: 35.0,
    weather_code: 1,
    wind_gusts_10m: 45.0,
    wind_speed_10m: 20.0,
    precipitation: 5.0,
    river_discharge: 120.0
  },
  "WARNING",
  "กรุงเทพมหานคร"
);
```

---

#### `createToast(message: string, type: 'info' | 'success' | 'alert')`

Creates a toast notification.

**Parameters:**
- `message` (string): Notification message
- `type` (string): "info", "success", or "alert"

**Returns:** `void`

**Example:**
```typescript
createToast("Data updated successfully", "success");
createToast("Connection failed", "alert");
createToast("Processing...", "info");
```

---

#### `speakText(text: string)`

Speaks Thai text using browser's speech synthesis.

**Parameters:**
- `text` (string): Thai text to speak

**Returns:** `void`

**Example:**
```typescript
speakText("เตือนภัยดัชนี UV สูงจัด");
```

**Browser Support:**
- Requires `speechSynthesis` API
- Uses Thai language (th-TH)
- Rate: 1.0 (normal speed)

---

#### `switchView(targetView: string)`

Switches between dashboard views.

**Parameters:**
- `targetView` (string): View name ("home", "hazards", "controls", "simulator", "analytics", "settings")

**Returns:** `void`

**Available Views:**
- `home` - Main dashboard
- `hazards` - Hazard details
- `controls` - Manual controls
- `simulator` - Disaster simulation
- `analytics` - History log
- `settings` - System settings

**Example:**
```typescript
switchView("controls"); // Switch to controls view
```

---

#### `populateProvinces(currentProvince: string)`

Populates the province selector dropdown.

**Parameters:**
- `currentProvince` (string): Currently selected province (default: "กรุงเทพมหานคร")

**Returns:** `void`

**Example:**
```typescript
populateProvinces("นนทบุรี");
```

---

#### `getWmoDescription(code: number)`

Returns Thai/English description for WMO weather code.

**Parameters:**
- `code` (number): WMO weather code (0-99)

**Returns:** `string`

**Common Codes:**
- `0` - Clear Sky
- `1` - Mainly Clear
- `2` - Partly Cloudy
- `3` - Overcast
- `45` - Fog
- `61` - Slight Rain
- `63` - Moderate Rain
- `65` - Heavy Rain
- `95` - Thunderstorm
- `96/99` - Severe Hailstorm

**Example:**
```typescript
const desc = getWmoDescription(95);
console.log(desc); // "พายุฝนฟ้าคะนอง (Thunderstorm)"
```

---

#### `applyLanguage()`

Applies current language to all translatable elements.

**Parameters:** None

**Returns:** `void`

**Example:**
```typescript
applyLanguage(); // Applies Thai or English based on currentLang
```

---

#### `toggleLanguage()`

Toggles between Thai and English languages.

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Updates `currentLang` global variable
- Saves preference to localStorage
- Calls `applyLanguage()`

**Example:**
```typescript
toggleLanguage(); // Switches language
```

---

#### `t(key: string)`

Translation helper function.

**Parameters:**
- `key` (string): Translation key

**Returns:** `string`

**Example:**
```typescript
const text = t("home_title");
```

---

### Firebase Client Functions

#### `initializeFirebase()`

Initializes Firebase Realtime Database connection.

**Parameters:** None

**Returns:** `Promise<void>`

**Behavior:**
- Checks if Firebase is configured
- Initializes Firebase app
- Sets up real-time listeners
- Falls back to standalone mode if not configured

**Example:**
```typescript
await initializeFirebase();
```

**Listeners Set Up:**
- `devices/{device_id}/telemetry/live` - Live weather data
- `devices/{device_id}/status` - Device status

---

### WebSocket Client Class

#### `new WebSocketClient(options: WebSocketOptions)`

Creates a new WebSocket client instance.

**Parameters:**
- `options` (WebSocketOptions): Connection options

**WebSocketOptions:**
```typescript
{
  url: string;              // WebSocket server URL
  deviceId: string;         // Device identifier
  authToken?: string;        // Authentication token
  autoReconnect?: boolean;  // Auto-reconnect on disconnect (default: true)
  reconnectInterval?: number; // Reconnect delay in ms (default: 1000)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: 10)
  heartbeatInterval?: number; // Heartbeat interval in ms (default: 30000)
  connectionTimeout?: number; // Connection timeout in ms (default: 10000)
  enableSecureMode?: boolean; // Force WSS (default: true)
}
```

**Example:**
```typescript
const client = new WebSocketClient({
  url: "ws://localhost:8080",
  deviceId: "smart_building_001",
  authToken: "your_token",
  autoReconnect: true
});
```

---

#### `connect()`

Connects to WebSocket server.

**Parameters:** None

**Returns:** `void`

**Example:**
```typescript
client.connect();
```

---

#### `disconnect()`

Disconnects from WebSocket server.

**Parameters:** None

**Returns:** `void`

**Example:**
```typescript
client.disconnect();
```

---

#### `send(message: WebSocketMessage)`

Sends a message through WebSocket.

**Parameters:**
- `message` (WebSocketMessage): Message to send

**Returns:** `boolean` - `true` if sent successfully, `false` if buffered

**Example:**
```typescript
const success = client.send({
  type: MessageType.COMMAND,
  payload: {
    command: CommandType.TOGGLE_STROBE
  }
});
```

---

#### `on(messageType: MessageType, handler: MessageHandler)`

Registers a message handler for a specific message type.

**Parameters:**
- `messageType` (MessageType): Message type to listen for
- `handler` (MessageHandler): Callback function

**Returns:** `void`

**Example:**
```typescript
client.on(MessageType.TELEMETRY, (message) => {
  console.log("Received telemetry:", message.payload);
});
```

---

#### `off(messageType: MessageType, handler: MessageHandler)`

Unregisters a message handler.

**Parameters:**
- `messageType` (MessageType): Message type
- `handler` (MessageHandler): Callback function to remove

**Returns:** `void`

**Example:**
```typescript
client.off(MessageType.TELEMETRY, handler);
```

---

#### `onConnectionStatus(handler: ConnectionStatusHandler)`

Registers a connection status handler.

**Parameters:**
- `handler` (ConnectionStatusHandler): Callback function

**Returns:** `void`

**Example:**
```typescript
client.onConnectionStatus((status) => {
  console.log("Connection status:", status.state);
});
```

---

#### `getState()`

Gets current connection state.

**Parameters:** None

**Returns:** `ConnectionState`

**Example:**
```typescript
const state = client.getState();
console.log(state); // "connected", "disconnected", etc.
```

---

#### `getLatency()`

Gets current connection latency in milliseconds.

**Parameters:** None

**Returns:** `number`

**Example:**
```typescript
const latency = client.getLatency();
console.log(`Latency: ${latency}ms`);
```

---

#### `isConnected()`

Checks if client is connected.

**Parameters:** None

**Returns:** `boolean`

**Example:**
```typescript
if (client.isConnected()) {
  client.send(message);
}
```

---

## Configuration Options

### Firebase Configuration

```typescript
FIREBASE_CONFIG = {
  apiKey: string;              // Firebase API key
  authDomain: string;         // Firebase auth domain
  databaseURL: string;         // Realtime Database URL
  projectId: string;          // Firebase project ID
  appId: string;               // Firebase app ID
}
```

**Environment Variables:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_APP_ID`

---

### Connection Configuration

```typescript
FIREBASE_CONNECTION_CONFIG = {
  connectionTimeout: 10000;           // Connection timeout (ms)
  heartbeatInterval: 30000;           // Heartbeat interval (ms)
  maxReconnectAttempts: -1;          // Max reconnect attempts (-1 = infinite)
  initialReconnectDelay: 1000;        // Initial reconnect delay (ms)
  maxReconnectDelay: 30000;          // Max reconnect delay (ms)
  reconnectBackoffMultiplier: 2;     // Exponential backoff multiplier
  reconnectJitter: true;              // Add jitter to delays
  enableOfflinePersistence: true;    // Enable offline cache
  maxCacheSize: 10485760;            // Max cache size (10MB)
  cacheTTL: 300000;                  // Cache TTL (5 minutes)
}
```

---

### Debounce Configuration

```typescript
DEBOUNCE_CONFIG = {
  telemetryDebounceMs: 500;    // Weather data debounce (ms)
  statusDebounceMs: 1000;      // Status updates debounce (ms)
  relayDebounceMs: 200;        // Relay state debounce (ms)
  maxWaitMs: 2000;             // Max debounce wait (ms)
}
```

---

### Validation Configuration

```typescript
VALIDATION_CONFIG = {
  strictValidation: true;       // Enable strict validation
  validateTelemetry: true;     // Validate telemetry data
  validateStatus: true;         // Validate status data
  sanitizeInvalidData: true;    // Sanitize instead of reject
  logValidationErrors: true;   // Log validation errors
}
```

---

### Retry Configuration

```typescript
RETRY_CONFIG = {
  readMaxAttempts: 3;          // Max read retry attempts
  writeMaxAttempts: 5;         // Max write retry attempts
  initialDelay: 1000;           // Initial retry delay (ms)
  maxDelay: 10000;              // Max retry delay (ms)
  backoffMultiplier: 2;        // Exponential backoff multiplier
  jitter: true;                 // Add jitter to delays
}
```

---

### Logging Configuration

```typescript
LOGGING_CONFIG = {
  enableLogging: true;          // Enable logging
  logLevel: 'info';            // Log level: 'debug', 'info', 'warn', 'error', 'none'
  logReads: true;              // Log read operations
  logWrites: true;             // Log write operations
  logConnectionEvents: true;   // Log connection events
  logValidationErrors: true;   // Log validation errors
  maxLogEntries: 100;          // Max log entries in memory
}
```

---

### Performance Configuration

```typescript
PERFORMANCE_CONFIG = {
  enableMonitoring: true;       // Enable performance monitoring
  trackLatency: true;           // Track operation latency
  slowOperationThreshold: 1000; // Slow operation threshold (ms)
  trackDataSize: true;          // Track data transfer size
}
```

---

## WebSocket Protocol

### Message Structure

All WebSocket messages follow this base structure:

```typescript
interface BaseMessage {
  version: string;      // Protocol version (currently "1.0.0")
  type: MessageType;    // Message type
  timestamp: number;    // Unix timestamp in milliseconds
  id: string;          // Unique message ID
}
```

### Message Types

#### Telemetry Message

```typescript
{
  version: "1.0.0",
  type: "telemetry",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
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
  }
}
```

---

#### Command Message

```typescript
{
  version: "1.0.0",
  type: "command",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    command: CommandType;
    params?: Record<string, any>;
    retry_count?: number;
  }
}
```

**Command Types:**
- `toggle_strobe` - Toggle strobe relay
- `toggle_door` - Toggle door relay
- `silence_alarm` - Silence audio alarm
- `test_siren` - Test siren
- `set_config` - Set configuration
- `reboot_device` - Reboot device
- `get_status` - Get device status

---

#### Acknowledgment Message

```typescript
{
  version: "1.0.0",
  type: "ack",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    command_id: string;
    success: boolean;
    message?: string;
    result?: any;
  }
}
```

---

#### Error Message

```typescript
{
  version: "1.0.0",
  type: "error",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    code: string;
    message: string;
    details?: any;
  }
}
```

---

#### Configuration Message

```typescript
{
  version: "1.0.0",
  type: "config",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    config_key: string;
    config_value: any;
  }
}
```

---

#### Heartbeat Message

```typescript
{
  version: "1.0.0",
  type: "heartbeat",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    sequence: number;
  }
}
```

---

#### Status Message

```typescript
{
  version: "1.0.0",
  type: "status",
  timestamp: 1234567890,
  id: "device-123-timestamp-random",
  payload: {
    device_id: string;
    online: boolean;
    uptime_sec: number;
    firmware_version: string;
    last_boot_reason?: string;
  }
}
```

---

## Firebase Data Schema

### Database Structure

```
devices/
  {device_id}/
    telemetry/
      live/
        temperature: number
        apparent_temperature: number
        uv_index: number
        weather_code: number
        wind_speed_10m: number
        wind_gusts_10m: number
        precipitation: number
        river_discharge: number
        severity: string
        province: string
        timestamp: number
      historical/
        {timestamp}/
          temperature: number
          ...
    status/
      online: boolean
      uptime_sec: number
      firmware_version: string
      last_boot_reason: string
      last_update: number
    relays/
      strobe: boolean
      door: boolean
      siren: boolean
    alerts/
      {alert_id}/
        severity: string
        message: string
        province: string
        timestamp: number
        acknowledged: boolean
    config/
      province: string
      polling_interval: number
      alert_enabled: boolean
```

### Data Types

#### Live Telemetry

```typescript
interface LiveTelemetry {
  temperature: number;              // Air temperature in °C
  apparent_temperature: number;     // Apparent temperature in °C
  uv_index: number;                // UV index (0-15+)
  weather_code: number;            // WMO weather code (0-99)
  wind_speed_10m: number;          // Wind speed in km/h
  wind_gusts_10m: number;          // Wind gusts in km/h
  precipitation: number;           // Precipitation in mm/h
  river_discharge: number;         // River discharge in m³/s
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  province: string;                // Thai province name
  timestamp: number;               // Unix timestamp
}
```

#### Device Status

```typescript
interface DeviceStatus {
  online: boolean;                 // Connection status
  uptime_sec: number;             // Uptime in seconds
  firmware_version: string;        // Firmware version
  last_boot_reason: string;        // Last boot reason
  last_update: number;             // Last update timestamp
}
```

#### Relay States

```typescript
interface RelayStates {
  strobe: boolean;                 // Strobe relay state
  door: boolean;                   // Door relay state
  siren: boolean;                  // Siren state
}
```

#### Alert Log

```typescript
interface AlertLog {
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  message: string;                 // Alert message
  province: string;                // Thai province name
  timestamp: number;               // Unix timestamp
  acknowledged: boolean;           // Acknowledgment status
}
```

---

## State Store Structure

### Global State

```typescript
interface DashboardState {
  // Province selection
  currentProvince: string;
  
  // Weather data
  weatherData: WeatherData;
  
  // Hazard severity
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  
  // Relay states
  relayStates: {
    strobe: boolean;
    door: boolean;
    siren: boolean;
  };
  
  // Connection status
  connectionStatus: {
    firebase: boolean;
    websocket: boolean;
    mqtt: boolean;
  };
  
  // History logs
  historyLogs: HistoryEntry[];
  
  // System metrics
  uptime: number;
  lastUpdate: Date;
  
  // Language
  language: 'th' | 'en';
}
```

### History Entry

```typescript
interface HistoryEntry {
  time: string;           // Formatted time string
  province: string;      // Thai province name
  severity: string;      // Severity level
  desc: string;          // Description
  metrics: string;       // Metrics summary
}
```

### Weather Data

```typescript
interface WeatherData {
  uv_index: number;
  apparent_temperature: number;
  temperature_2m: number;
  weather_code: number;
  wind_gusts_10m: number;
  wind_speed_10m: number;
  precipitation: number;
  river_discharge: number;
}
```

---

## Event Bus Events

### DOM Events

The application uses standard DOM events for user interactions:

**Navigation Events:**
- `click` on nav links - Triggers `switchView()`

**Control Events:**
- `click` on `#toggleStrobeBtn` - Triggers `toggleStrobe()`
- `click` on `#toggleDoorBtn` - Triggers `toggleEmergencyDoor()`
- `click` on `#silenceAudioBtn` - Triggers `silenceAlarm()`
- `click` on `#testAudioBtn` - Triggers `testAudioSiren()`
- `click` on `#testTelegramBtn` - Triggers `sendTelegramAlert()`
- `click` on `#exportCsvBtn` - Triggers `exportHistoryCsv()`

**Selection Events:**
- `change` on `#provinceSelect` - Triggers weather fetch for new province

**Simulation Events:**
- `click` on simulator buttons - Triggers `injectScenario()`

---

### Firebase Events

**Real-time Listeners:**
- `devices/{device_id}/telemetry/live` - Live weather data updates
- `devices/{device_id}/status` - Device status updates

**Event Handler:**
```typescript
onValue(ref(db, devicePath('telemetry/live')), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    updateDashboardUI(data, data.severity || 'NORMAL', data.province || 'Bangkok');
  }
});
```

---

### WebSocket Events

**Connection Events:**
- `onopen` - Connection established
- `onclose` - Connection closed
- `onerror` - Connection error
- `onmessage` - Message received

**Message Events:**
- `telemetry` - Live sensor data
- `command` - Command acknowledgment
- `ack` - Command acknowledgment
- `error` - Error message
- `config` - Configuration update
- `heartbeat` - Heartbeat response
- `status` - Status update

**Event Handler Registration:**
```typescript
client.on(MessageType.TELEMETRY, (message) => {
  // Handle telemetry
});

client.onConnectionStatus((status) => {
  // Handle connection status changes
});
```

---

## External APIs

### Open-Meteo Weather API

**Endpoint:**
```
https://api.open-meteo.com/v1/forecast
```

**Parameters:**
- `latitude` (number): Latitude in decimal degrees
- `longitude` (number): Longitude in decimal degrees
- `current` (string): Comma-separated current weather parameters
- `wind_speed_unit` (string): Wind speed unit (kmh, ms, mph, kn)
- `timezone` (string): Timezone (auto, Asia/Bangkok, etc.)

**Current Weather Parameters:**
- `temperature_2m` - Air temperature at 2m
- `relative_humidity_2m` - Relative humidity at 2m
- `apparent_temperature` - Apparent temperature
- `precipitation` - Precipitation
- `weather_code` - WMO weather code
- `wind_speed_10m` - Wind speed at 10m
- `wind_gusts_10m` - Wind gusts at 10m
- `uv_index` - UV index

**Example Request:**
```
https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok
```

**Response:**
```json
{
  "current": {
    "temperature_2m": 35.5,
    "relative_humidity_2m": 65,
    "apparent_temperature": 38.0,
    "precipitation": 0.0,
    "weather_code": 1,
    "wind_speed_10m": 15.0,
    "wind_gusts_10m": 25.0,
    "uv_index": 9.5
  }
}
```

---

### Open-Meteo Flood API

**Endpoint:**
```
https://flood-api.open-meteo.com/v1/flood
```

**Parameters:**
- `latitude` (number): Latitude in decimal degrees
- `longitude` (number): Longitude in decimal degrees
- `daily` (string): Daily parameters
- `forecast_days` (number): Number of forecast days

**Daily Parameters:**
- `river_discharge` - River discharge in m³/s

**Example Request:**
```
https://flood-api.open-meteo.com/v1/flood?latitude=13.7563&longitude=100.5018&daily=river_discharge&forecast_days=1
```

**Response:**
```json
{
  "daily": {
    "river_discharge": [120.5]
  }
}
```

---

### Telegram Bot API

**Endpoint:**
```
https://api.telegram.org/bot{token}/sendMessage
```

**Parameters:**
- `chat_id` (string): Chat ID (user or group)
- `text` (string): Message text
- `parse_mode` (string): Parse mode (HTML, Markdown)
- `disable_notification` (boolean): Disable notification

**Example Request:**
```typescript
const url = `https://api.telegram.org/bot${token}/sendMessage`;
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  })
});
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "message_id": 123,
    "from": { ... },
    "chat": { ... },
    "date": 1234567890,
    "text": "Message content"
  }
}
```

---

### Firebase Realtime Database API

**Read:**
```typescript
import { ref, onValue } from 'firebase/database';

onValue(ref(db, 'path/to/data'), (snapshot) => {
  const data = snapshot.val();
});
```

**Write:**
```typescript
import { ref, set } from 'firebase/database';

await set(ref(db, 'path/to/data'), value);
```

**Update:**
```typescript
import { ref, update } from 'firebase/database';

await update(ref(db, 'path/to/data'), { key: value });
```

---

## Type Definitions

### MessageType Enum

```typescript
enum MessageType {
  TELEMETRY = "telemetry",
  COMMAND = "command",
  ACK = "ack",
  ERROR = "error",
  CONFIG = "config",
  HEARTBEAT = "heartbeat",
  STATUS = "status"
}
```

### CommandType Enum

```typescript
enum CommandType {
  TOGGLE_STROBE = "toggle_strobe",
  TOGGLE_DOOR = "toggle_door",
  SILENCE_ALARM = "silence_alarm",
  TEST_SIREN = "test_siren",
  SET_CONFIG = "set_config",
  REBOOT_DEVICE = "reboot_device",
  GET_STATUS = "get_status"
}
```

### ConnectionState Enum

```typescript
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error"
}
```

---

## Error Codes

### WebSocket Errors

- `WS_CONNECTION_FAILED` - Connection failed
- `WS_TIMEOUT` - Connection timeout
- `WS_RATE_LIMIT` - Rate limit exceeded
- `WS_INVALID_MESSAGE` - Invalid message format
- `WS_VERSION_MISMATCH` - Protocol version mismatch

### Firebase Errors

- `FB_NOT_CONFIGURED` - Firebase not configured
- `FB_CONNECTION_FAILED` - Connection failed
- `FB_PERMISSION_DENIED` - Permission denied
- `FB_INVALID_DATA` - Invalid data format

### API Errors

- `API_RATE_LIMIT` - API rate limit exceeded
- `API_TIMEOUT` - API request timeout
- `API_INVALID_RESPONSE` - Invalid API response
- `API_NETWORK_ERROR` - Network error

---

## Best Practices

### API Usage

1. **Always handle errors**
```typescript
try {
  await fetchOpenMeteoWeather(province);
} catch (error) {
  console.error("Fetch failed:", error);
  createToast("Failed to fetch weather data", "alert");
}
```

2. **Debounce high-frequency updates**
```typescript
// Use the built-in debounce config
// Telemetry updates are debounced at 500ms
```

3. **Check connection before sending**
```typescript
if (client.isConnected()) {
  client.send(message);
} else {
  // Message will be buffered
}
```

4. **Use TypeScript types**
```typescript
const data: WeatherData = {
  uv_index: 9.5,
  apparent_temperature: 38.0,
  // ...
};
```

5. **Log important events**
```typescript
console.log("[TELEMETRY] Updated weather data for", province);
```

---

## Version History

### Protocol Version 1.0.0

- Initial release
- 7 message types
- Base message structure
- Connection management
- Heartbeat mechanism
