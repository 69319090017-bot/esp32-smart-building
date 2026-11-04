# Firebase Realtime Database Schema Documentation
## Smart Building Command Center

This document describes the optimal data structure for the Firebase Realtime Database used by the Smart Building Command Center.

---

## Table of Contents
1. [Overview](#overview)
2. [Data Structure](#data-structure)
3. [Path Conventions](#path-conventions)
4. [Data Types](#data-types)
5. [Security Rules](#security-rules)
6. [Indexing Recommendations](#indexing-recommendations)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)

---

## Overview

The Firebase Realtime Database is organized hierarchically with each device having its own namespace under the `devices` node. This structure allows for:
- Multi-device support in a single Firebase project
- Easy scaling as new devices are added
- Clear separation of concerns between different data types
- Efficient querying and real-time updates

### Root Structure
```
smart-building-center/
├── devices/
│   ├── {device_id}/
│   │   ├── telemetry/
│   │   ├── status/
│   │   ├── relays/
│   │   ├── alerts/
│   │   └── config/
└── .info/
    └── connected/
```

---

## Data Structure

### 1. Devices Node (`devices/{device_id}/`)

Each device has a unique identifier (e.g., `smart_building_001`) that serves as the root for all device-specific data.

#### Example Device ID: `smart_building_001`

---

### 2. Telemetry Node (`devices/{device_id}/telemetry/`)

Stores weather and environmental sensor data.

#### 2.1 Live Telemetry (`telemetry/live/`)

Real-time sensor readings updated frequently (60s polling).

```json
{
  "uv_index": 8.5,
  "temperature_2m": 32.5,
  "apparent_temperature": 38.2,
  "relative_humidity_2m": 75,
  "precipitation": 0.0,
  "weather_code": 1,
  "wind_speed_10m": 12.5,
  "wind_gusts_10m": 25.0,
  "river_discharge": 150.0,
  "severity": "WARNING",
  "province": "กรุงเทพมหานคร",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "_version": 1
}
```

**Field Descriptions:**
- `uv_index`: UV Index (0-15+)
- `temperature_2m`: Air temperature at 2m height (°C)
- `apparent_temperature`: Feels-like temperature (°C)
- `relative_humidity_2m`: Humidity percentage (0-100%)
- `precipitation`: Rainfall rate (mm/h)
- `weather_code`: WMO weather code (0-99)
- `wind_speed_10m`: Wind speed at 10m (km/h)
- `wind_gusts_10m`: Wind gust speed at 10m (km/h)
- `river_discharge`: River flow rate (m³/s)
- `severity`: Threat level (`NORMAL`, `WARNING`, `CRITICAL`)
- `province`: Thai province name
- `timestamp`: ISO 8601 timestamp
- `_version`: Schema version for migration

#### 2.2 Historical Telemetry (`telemetry/historical/`)

Stores historical data with timestamp keys for analysis.

```json
{
  "2026-01-15T10:00:00.000Z": {
    "uv_index": 7.2,
    "temperature_2m": 31.0,
    "apparent_temperature": 36.5,
    "relative_humidity_2m": 70,
    "precipitation": 0.0,
    "weather_code": 1,
    "wind_speed_10m": 10.0,
    "wind_gusts_10m": 20.0,
    "river_discharge": 145.0,
    "severity": "NORMAL",
    "province": "กรุงเทพมหานคร",
    "_version": 1
  },
  "2026-01-15T09:00:00.000Z": { ... }
}
```

**Note:** Historical data should be periodically cleaned up to prevent database bloat. Consider implementing a TTL policy (e.g., keep last 30 days).

---

### 3. Status Node (`devices/{device_id}/status/`)

Device health and operational status.

```json
{
  "uptime_sec": 86400,
  "firmware_version": "1.0.0",
  "last_heartbeat": "2026-01-15T10:30:00.000Z",
  "battery_level": 85,
  "signal_strength": 92,
  "online": true,
  "_version": 1
}
```

**Field Descriptions:**
- `uptime_sec`: Device uptime in seconds
- `firmware_version`: Current firmware version string
- `last_heartbeat`: Last successful heartbeat timestamp
- `battery_level`: Battery percentage (0-100)
- `signal_strength`: Signal quality (0-100)
- `online`: Device online status
- `_version`: Schema version

---

### 4. Relays Node (`devices/{device_id}/relays/`)

Control states for hardware relays.

```json
{
  "strobe": false,
  "door": true,
  "siren": false,
  "last_updated": "2026-01-15T10:30:00.000Z",
  "_version": 1
}
```

**Field Descriptions:**
- `strobe`: Strobe light relay state (true=ON, false=OFF)
- `door`: Emergency door lock state (true=UNLOCKED, false=LOCKED)
- `siren`: Siren state (true=ON, false=OFF)
- `last_updated`: Last state change timestamp
- `_version`: Schema version

---

### 5. Alerts Node (`devices/{device_id}/alerts/`)

Alert history with unique IDs.

```json
{
  "alert_2026-01-15T10:30:00_001": {
    "id": "alert_2026-01-15T10:30:00_001",
    "severity": "CRITICAL",
    "message": "Extreme heat detected: 41.5°C",
    "province": "กรุงเทพมหานคร",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "type": "weather",
    "acknowledged": false,
    "_version": 1
  },
  "alert_2026-01-15T09:15:00_002": { ... }
}
```

**Field Descriptions:**
- `id`: Unique alert identifier
- `severity`: Alert severity (`NORMAL`, `WARNING`, `CRITICAL`)
- `message`: Human-readable alert message
- `province`: Affected province
- `timestamp`: Alert creation timestamp
- `type`: Alert category (`weather`, `device`, `system`)
- `acknowledged`: Whether alert was acknowledged
- `_version`: Schema version

**Note:** Alerts should be automatically cleaned up after a period (e.g., keep last 100 alerts or 7 days).

---

### 6. Config Node (`devices/{device_id}/config/`)

Device configuration and thresholds.

```json
{
  "province": "กรุงเทพมหานคร",
  "polling_interval": 60,
  "thresholds": {
    "uv_critical": 11.0,
    "uv_warning": 8.0,
    "heat_critical": 41.0,
    "heat_warning": 37.0,
    "wind_critical": 89.0,
    "wind_warning": 50.0,
    "rain_critical": 35.0,
    "rain_warning": 10.0,
    "river_warning": 500.0
  },
  "_version": 1
}
```

**Field Descriptions:**
- `province`: Default monitoring province
- `polling_interval`: Weather API polling interval (seconds)
- `thresholds`: Alert threshold values
- `_version`: Schema version

---

## Path Conventions

### Device Path Helper
```typescript
devicePath('telemetry/live') => 'devices/smart_building_001/telemetry/live'
```

### Standard Paths
| Path | Purpose | Update Frequency |
|------|---------|------------------|
| `devices/{id}/telemetry/live` | Real-time sensor data | Every 60s |
| `devices/{id}/telemetry/historical` | Historical data | Every 60s |
| `devices/{id}/status` | Device status | Every 60s |
| `devices/{id}/relays` | Relay control states | On state change |
| `devices/{id}/alerts` | Alert history | On alert trigger |
| `devices/{id}/config` | Device configuration | On configuration change |

---

## Data Types

### Numeric Fields
All sensor readings use JavaScript `number` type (double-precision float):
- Temperature: °C
- Humidity: %
- Wind speed: km/h
- Precipitation: mm/h
- UV Index: 0-15+
- River discharge: m³/s

### Boolean Fields
- Relay states: `true` (ON/ACTIVE), `false` (OFF/INACTIVE)
- Online status: `true` (online), `false` (offline)
- Acknowledged: `true` (acknowledged), `false` (pending)

### String Fields
- Province names: Thai (e.g., "กรุงเทพมหานคร")
- Severity levels: "NORMAL", "WARNING", "CRITICAL"
- Alert types: "weather", "device", "system"
- Timestamps: ISO 8601 format (e.g., "2026-01-15T10:30:00.000Z")

### Integer Fields
- Uptime: seconds
- Battery level: 0-100
- Signal strength: 0-100
- Schema version: positive integer

---

## Security Rules

### Firebase Security Rules Template

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // This is for Firestore - use Realtime Database rules below
  }
}

// Realtime Database Rules
{
  "rules": {
    // Devices root
    "devices": {
      "$device_id": {
        // Telemetry - read-only for authenticated users
        "telemetry": {
          ".read": "auth != null",
          ".write": "auth != null && auth.token.admin == true",
          ".validate": "newData.hasChildren(['uv_index', 'temperature_2m']) || newData.val() == null"
        },
        
        // Status - read-only for authenticated users
        "status": {
          ".read": "auth != null",
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['uptime_sec']) || newData.val() == null"
        },
        
        // Relays - writable by authenticated users
        "relays": {
          ".read": "auth != null",
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['strobe', 'door', 'siren'])"
        },
        
        // Alerts - readable by authenticated users
        "alerts": {
          ".read": "auth != null",
          ".write": "auth != null",
          "$alert_id": {
            ".validate": "newData.hasChildren(['id', 'severity', 'message', 'timestamp'])"
          }
        },
        
        // Config - writable by admins only
        "config": {
          ".read": "auth != null",
          ".write": "auth != null && auth.token.admin == true"
        }
      }
    },
    
    // Internal Firebase paths (read-only)
    ".info": {
      ".read": true,
      ".write": false
    }
  }
}
```

### Security Rules for Development (Less Restrictive)

```javascript
{
  "rules": {
    "devices": {
      "$device_id": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['telemetry', 'status'])"
      }
    },
    ".info": {
      ".read": true
    }
  }
}
```

### Permission Checks

In the client application, implement permission checks before write operations:

```typescript
const checkWritePermission = (path: string): boolean => {
  // Implement client-side permission logic
  // Note: This is supplementary to server-side security rules
  return true; // Placeholder
};
```

---

## Indexing Recommendations

Firebase Realtime Database doesn't require explicit indexing like Firestore, but proper data structure is crucial for query performance.

### Best Practices for Efficient Queries

1. **Flatten Data Structure**: Avoid deep nesting
   ```
   ✅ Good: devices/{id}/telemetry/live
   ❌ Bad: devices/{id}/data/sensors/weather/live
   ```

2. **Use Separate Nodes for Different Data Types**
   ```
   ✅ Good: Separate telemetry, status, relays nodes
   ❌ Bad: All data in a single node
   ```

3. **Limit Historical Data Size**
   - Implement TTL for historical telemetry
   - Keep only recent alerts (e.g., last 100)
   - Archive old data to Cloud Storage or BigQuery

4. **Use Push Keys for Lists**
   ```
   ✅ Good: alerts/{pushId}
   ❌ Bad: alerts/0, alerts/1, alerts/2
   ```

### Query Optimization

For the Smart Building Command Center, most queries are simple path-based reads which are already optimized:

```typescript
// ✅ Efficient: Direct path read
get(ref(db, 'devices/smart_building_001/telemetry/live'))

// ✅ Efficient: Real-time listener on specific path
onValue(ref(db, 'devices/smart_building_001/status'), callback)

// ❌ Avoid: Complex queries across multiple nodes
// Use separate listeners instead
```

---

## Migration Guide

### Schema Versioning

Each data node includes a `_version` field to track schema changes:

```typescript
export const SCHEMA_CONFIG = {
  currentVersion: 1,
  minSupportedVersion: 1,
  enableAutoMigration: true
};
```

### Migration Strategies

#### Adding New Fields (Backward Compatible)
No migration needed. New fields are optional.

```typescript
// Schema v1 → v2: Add new field
if (data._version === 1) {
  data.new_field = defaultValue;
  data._version = 2;
}
```

#### Removing Fields (Breaking Change)
Implement migration script:

```typescript
const migrateV1ToV2 = (data: any): any => {
  if (data._version === 1) {
    const { deprecated_field, ...rest } = data;
    return { ...rest, _version: 2 };
  }
  return data;
};
```

#### Renaming Fields (Breaking Change)
```typescript
const migrateV1ToV2 = (data: any): any => {
  if (data._version === 1) {
    const { old_name, ...rest } = data;
    return { ...rest, new_name: old_name, _version: 2 };
  }
  return data;
};
```

### Client-Side Migration Handler

```typescript
const migrateData = (data: any, path: string): any => {
  if (!data || !data._version) return data;
  
  const currentVersion = SCHEMA_CONFIG.currentVersion;
  const dataVersion = data._version;
  
  if (dataVersion > currentVersion) {
    console.warn(`Data version ${dataVersion} is ahead of client version ${currentVersion}`);
    return null; // Reject data from future schema
  }
  
  if (dataVersion < currentVersion) {
    // Apply migrations
    return applyMigrations(data, dataVersion, currentVersion);
  }
  
  return data;
};
```

---

## Best Practices

### 1. Data Validation
- Always validate incoming data on the client
- Sanitize invalid data rather than rejecting outright
- Log validation errors for debugging

### 2. Error Handling
- Implement retry logic with exponential backoff
- Cache last known state for offline resilience
- Provide user-friendly error messages

### 3. Performance
- Use debouncing for high-frequency updates
- Implement local caching to reduce Firebase reads
- Monitor operation latency and slow queries

### 4. Security
- Never store API keys in client code
- Use Firebase Authentication for access control
- Implement server-side security rules
- Validate write permissions on the client

### 5. Monitoring
- Log all Firebase operations
- Track connection state changes
- Monitor cache hit rates
- Alert on slow operations

### 6. Data Lifecycle
- Implement TTL for historical data
- Clean up old alerts periodically
- Archive data that's no longer needed
- Use Cloud Functions for automated cleanup

### 7. Testing
- Test with realistic data volumes
- Simulate network failures
- Test reconnection logic
- Validate data migration paths

---

## Appendix: Complete Schema Example

```json
{
  "devices": {
    "smart_building_001": {
      "telemetry": {
        "live": {
          "uv_index": 8.5,
          "temperature_2m": 32.5,
          "apparent_temperature": 38.2,
          "relative_humidity_2m": 75,
          "precipitation": 0.0,
          "weather_code": 1,
          "wind_speed_10m": 12.5,
          "wind_gusts_10m": 25.0,
          "river_discharge": 150.0,
          "severity": "WARNING",
          "province": "กรุงเทพมหานคร",
          "timestamp": "2026-01-15T10:30:00.000Z",
          "_version": 1
        },
        "historical": {
          "2026-01-15T10:00:00.000Z": { ... },
          "2026-01-15T09:00:00.000Z": { ... }
        }
      },
      "status": {
        "uptime_sec": 86400,
        "firmware_version": "1.0.0",
        "last_heartbeat": "2026-01-15T10:30:00.000Z",
        "battery_level": 85,
        "signal_strength": 92,
        "online": true,
        "_version": 1
      },
      "relays": {
        "strobe": false,
        "door": true,
        "siren": false,
        "last_updated": "2026-01-15T10:30:00.000Z",
        "_version": 1
      },
      "alerts": {
        "alert_2026-01-15T10:30:00_001": {
          "id": "alert_2026-01-15T10:30:00_001",
          "severity": "CRITICAL",
          "message": "Extreme heat detected: 41.5°C",
          "province": "กรุงเทพมหานคร",
          "timestamp": "2026-01-15T10:30:00.000Z",
          "type": "weather",
          "acknowledged": false,
          "_version": 1
        }
      },
      "config": {
        "province": "กรุงเทพมหานคร",
        "polling_interval": 60,
        "thresholds": {
          "uv_critical": 11.0,
          "uv_warning": 8.0,
          "heat_critical": 41.0,
          "heat_warning": 37.0,
          "wind_critical": 89.0,
          "wind_warning": 50.0,
          "rain_critical": 35.0,
          "rain_warning": 10.0,
          "river_warning": 500.0
        },
        "_version": 1
      }
    }
  }
}
```

---

## Contact & Support

For questions or issues related to the Firebase schema:
- Review the TypeScript type definitions in `firebase_types.ts`
- Check the implementation in `firebase_client.ts`
- Consult Firebase Realtime Database documentation: https://firebase.google.com/docs/database
