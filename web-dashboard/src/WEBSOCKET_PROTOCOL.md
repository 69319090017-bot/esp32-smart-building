# WebSocket Communication Protocol

## Overview

This document describes the WebSocket-based bi-directional communication protocol between the web dashboard and ESP32 devices. The protocol provides low-latency real-time communication with automatic fallback to Firebase polling.

## Protocol Version

Current Version: `1.0.0`

## Message Format

All messages follow a JSON-based format with the following base structure:

```json
{
  "version": "1.0.0",
  "type": "message_type",
  "timestamp": 1234567890,
  "id": "unique_message_id",
  "payload": { ... }
}
```

### Base Fields

- `version` (string): Protocol version for backward compatibility
- `type` (string): Message type (see Message Types below)
- `timestamp` (number): Unix timestamp in milliseconds
- `id` (string): Unique message identifier
- `payload` (object): Message-specific data

## Message Types

### 1. TELEMETRY

Sent from ESP32 to web dashboard with live sensor data.

```json
{
  "version": "1.0.0",
  "type": "telemetry",
  "timestamp": 1234567890,
  "id": "device_001-1234567890-abc123",
  "payload": {
    "device_id": "smart_building_001",
    "temperature": 28.5,
    "humidity": 65.0,
    "uv_index": 5.2,
    "wind_speed": 12.0,
    "wind_gusts": 18.0,
    "precipitation": 0.0,
    "weather_code": 1,
    "river_discharge": 85.0,
    "relay_states": {
      "strobe": false,
      "door": false,
      "siren": false
    },
    "battery_level": 85,
    "signal_strength": -65,
    "uptime_sec": 3600
  }
}
```

### 2. COMMAND

Sent from web dashboard to ESP32 to control device functions.

```json
{
  "version": "1.0.0",
  "type": "command",
  "timestamp": 1234567890,
  "id": "cmd-1234567890-xyz789",
  "payload": {
    "command": "toggle_strobe",
    "params": {},
    "retry_count": 0
  }
}
```

#### Available Commands

- `toggle_strobe`: Toggle strobe relay on/off
- `toggle_door`: Toggle emergency door lock/unlock
- `silence_alarm`: Silence the alarm siren
- `test_siren`: Test the siren audio
- `set_config`: Set device configuration
- `reboot_device`: Reboot the ESP32 device
- `get_status`: Request device status

### 3. ACK (Acknowledgment)

Sent from ESP32 to acknowledge receipt and execution of commands.

```json
{
  "version": "1.0.0",
  "type": "ack",
  "timestamp": 1234567890,
  "id": "ack-1234567890-def456",
  "payload": {
    "command_id": "cmd-1234567890-xyz789",
    "success": true,
    "message": "Command executed successfully",
    "result": {
      "strobe_state": true
    }
  }
}
```

### 4. ERROR

Sent when an error occurs during message processing.

```json
{
  "version": "1.0.0",
  "type": "error",
  "timestamp": 1234567890,
  "id": "err-1234567890-ghi789",
  "payload": {
    "code": "INVALID_COMMAND",
    "message": "Unknown command type",
    "details": {
      "received_command": "unknown_command"
    }
  }
}
```

### 5. CONFIG

Sent to update device configuration.

```json
{
  "version": "1.0.0",
  "type": "config",
  "timestamp": 1234567890,
  "id": "cfg-1234567890-jkl012",
  "payload": {
    "config_key": "heartbeat_interval",
    "config_value": 30000
  }
}
```

### 6. HEARTBEAT

Sent periodically to detect dead connections.

```json
{
  "version": "1.0.0",
  "type": "heartbeat",
  "timestamp": 1234567890,
  "id": "hbt-1234567890-mno345",
  "payload": {
    "sequence": 42
  }
}
```

### 7. STATUS

Sent from ESP32 to report device status.

```json
{
  "version": "1.0.0",
  "type": "status",
  "timestamp": 1234567890,
  "id": "sta-1234567890-pqr678",
  "payload": {
    "device_id": "smart_building_001",
    "online": true,
    "uptime_sec": 3600,
    "firmware_version": "1.2.3",
    "last_boot_reason": "power_on"
  }
}
```

## Connection Management

### WebSocket URL Format

```
ws://host:port/ws?token=AUTH_TOKEN&device_id=DEVICE_ID
```

For secure connections:

```
wss://host:port/ws?token=AUTH_TOKEN&device_id=DEVICE_ID
```

### Connection States

- `DISCONNECTED`: No active connection
- `CONNECTING`: Attempting to establish connection
- `CONNECTED`: Connection established and active
- `RECONNECTING`: Reconnecting after disconnection
- `ERROR`: Connection error occurred

### Auto-Reconnection

The client implements exponential backoff for reconnection:

- Initial delay: 2 seconds
- Backoff multiplier: 2x
- Maximum delay: 30 seconds
- Maximum attempts: 15 (configurable)

### Heartbeat Mechanism

- Default interval: 30 seconds
- Used to detect dead connections
- Measures round-trip latency

## Security

### Authentication

Token-based authentication via URL parameter:

```
?token=YOUR_AUTH_TOKEN
```

### Rate Limiting

- Default: 10 messages per second per message type
- Prevents message flooding
- Configurable per deployment

### Message Validation

- Version checking
- Schema validation
- Type checking

## Fallback Mechanism

When WebSocket is unavailable, the system automatically falls back to Firebase polling:

1. WebSocket connection timeout: 15 seconds
2. After 3 failed connection attempts, switch to Firebase
3. Firebase polling interval: 30 seconds
4. Automatic recovery when WebSocket becomes available
5. User notification of mode change

## Usage Examples

### Sending a Command

```typescript
import { getCommunicationManager } from './communication_manager';
import { DeviceCommands } from './device_commands';

const commManager = getCommunicationManager();
const deviceCommands = new DeviceCommands(commandQueue);

// Toggle strobe
const result = await deviceCommands.toggleStrobe();
if (result.success) {
  console.log('Command executed successfully');
} else {
  console.error('Command failed:', result.error);
}
```

### Receiving Telemetry

```typescript
import { getCommunicationManager } from './communication_manager';

const commManager = getCommunicationManager();

commManager.onTelemetry((data) => {
  console.log('Temperature:', data.temperature);
  console.log('Humidity:', data.humidity);
  console.log('UV Index:', data.uv_index);
});
```

### Monitoring Connection Status

```typescript
import { getCommunicationManager } from './communication_manager';

const commManager = getCommunicationManager();

commManager.onModeChange((mode) => {
  console.log('Communication mode:', mode);
  // Update UI to show current mode
});
```

## Error Codes

| Code | Description |
|------|-------------|
| INVALID_COMMAND | Unknown or unsupported command |
| INVALID_PARAMS | Invalid command parameters |
| AUTH_FAILED | Authentication failed |
| RATE_LIMITED | Rate limit exceeded |
| DEVICE_BUSY | Device is busy processing another command |
| HARDWARE_ERROR | Hardware malfunction |
| TIMEOUT | Command execution timeout |

## Configuration

Environment variables (optional):

```bash
VITE_WEBSOCKET_URL=ws://localhost:8080/ws
VITE_WEBSOCKET_AUTH_TOKEN=your_token_here
VITE_WEBSOCKET_SECURE=true
```

Or set via window object:

```javascript
window.SMART_BUILDING_WS_URL = "ws://your-server.com/ws";
window.SMART_BUILDING_WS_TOKEN = "your_token";
```

## ESP32 Implementation Guide

To implement this protocol on ESP32:

1. Set up a WebSocket server (e.g., using ESPAsyncWebServer)
2. Parse incoming JSON messages
3. Validate message version and structure
4. Process commands and send ACK responses
5. Send telemetry updates periodically (e.g., every 1-5 seconds)
6. Respond to heartbeat messages
7. Handle reconnection gracefully

### ESP32 Pseudo-Code Example

```cpp
void onWebSocketMessage(WebSocketClient &client, String message) {
  // Parse JSON
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, message);
  
  String type = doc["type"];
  String msgId = doc["id"];
  
  if (type == "command") {
    String command = doc["payload"]["command"];
    
    // Execute command
    bool success = executeCommand(command);
    
    // Send ACK
    DynamicJsonDocument ack(256);
    ack["version"] = "1.0.0";
    ack["type"] = "ack";
    ack["timestamp"] = millis();
    ack["id"] = generateId();
    ack["payload"]["command_id"] = msgId;
    ack["payload"]["success"] = success;
    
    String ackStr;
    serializeJson(ack, ackStr);
    client.text(ackStr);
  }
  else if (type == "heartbeat") {
    // Respond with heartbeat
    DynamicJsonDocument hbt(128);
    hbt["version"] = "1.0.0";
    hbt["type"] = "heartbeat";
    hbt["timestamp"] = millis();
    hbt["id"] = generateId();
    hbt["payload"]["sequence"] = doc["payload"]["sequence"];
    
    String hbtStr;
    serializeJson(hbt, hbtStr);
    client.text(hbtStr);
  }
}

void sendTelemetry(WebSocketClient &client) {
  DynamicJsonDocument doc(512);
  doc["version"] = "1.0.0";
  doc["type"] = "telemetry";
  doc["timestamp"] = millis();
  doc["id"] = generateId();
  doc["payload"]["device_id"] = DEVICE_ID;
  doc["payload"]["temperature"] = readTemperature();
  doc["payload"]["humidity"] = readHumidity();
  // ... other sensor data
  
  String telemetryStr;
  serializeJson(doc, telemetryStr);
  client.text(telemetryStr);
}
```

## Performance Considerations

- WebSocket provides sub-second latency for telemetry
- Message buffering prevents data loss during disconnections
- Rate limiting prevents server overload
- Heartbeat mechanism detects dead connections quickly
- Exponential backoff prevents connection storm

## Troubleshooting

### Connection Issues

1. Check WebSocket URL is correct
2. Verify authentication token
3. Check network connectivity
4. Review browser console for errors
5. Verify server is running and accessible

### Command Timeout

1. Check ESP32 is processing commands
2. Verify ACK messages are being sent
3. Check network latency
4. Review command queue statistics

### Fallback Mode Active

1. WebSocket server may be down
2. Network may be blocking WebSocket
3. Check firewall settings
4. Verify server logs

## Version History

### v1.0.0 (Current)
- Initial protocol release
- Bi-directional communication
- Command acknowledgment
- Heartbeat mechanism
- Fallback support
