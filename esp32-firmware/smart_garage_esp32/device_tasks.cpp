#include "device_tasks.h"

#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <ESP.h>
#include <WiFi.h>
#include <esp_system.h>

#include "../config.h"
#include "app_state.h"
#include "debounced_button.h"
#include "event_log.h"
#include "firebase_service.h"
#include "pwm_output.h"
#include "security_logic.h"
#include "wifi_manager.h"

namespace {
DebouncedButton button(BUTTON_PIN, BUTTON_DEBOUNCE_MS);
FirebaseService firebase;
uint32_t eventSequence = 0;

void TaskSensors(void* parameters);
void TaskControl(void* parameters);
void TaskCloud(void* parameters);
void TaskOta(void* parameters);
void TaskHealth(void* parameters);

void recordIntrusion(float distanceCm, uint32_t lightLevel) {
    EventRecord event{};
    const uint64_t timestamp = epochMillis();
    snprintf(event.id, sizeof(event.id), "intrusion_%llu_%lu",
             static_cast<unsigned long long>(timestamp == 0 ? millis() : timestamp),
             static_cast<unsigned long>(eventSequence++));
    snprintf(event.type, sizeof(event.type), "intrusion_detected");
    snprintf(event.severity, sizeof(event.severity), "critical");
    event.distanceCm = distanceCm;
    event.lightLevel = lightLevel;
    event.timestamp = timestamp;
    if (!queueEvent(event)) setLastError("Could not queue event");
}

bool applyCommands(const char* payload) {
    JsonDocument doc;
    const DeserializationError error = deserializeJson(doc, payload);
    if (error || doc.isNull()) return false;

    bool restartRequested = false;
    if (!lockState()) return false;
    if (doc["manual_override"].is<bool>()) g_state.manualOverride = doc["manual_override"].as<bool>();
    if (doc["distance_threshold"].is<int32_t>()) {
        g_state.distanceThreshold = SecurityLogic::clampThreshold(doc["distance_threshold"].as<int32_t>());
    }
    if (doc["led_command"].is<const char*>()) {
        const char* command = doc["led_command"].as<const char*>();
        if (SecurityLogic::validLedCommand(command)) {
            snprintf(g_state.ledCommand, sizeof(g_state.ledCommand), "%s", command);
        }
    }
    if (doc["armed"].is<bool>()) g_state.armed = doc["armed"].as<bool>();
    if (doc["maintenance_mode"].is<bool>()) g_state.maintenanceMode = doc["maintenance_mode"].as<bool>();
    if (doc["light_timer_seconds"].is<int32_t>()) g_state.lightTimerSeconds = doc["light_timer_seconds"].as<int32_t>();
    if (doc["force_night_mode"].is<bool>()) g_state.forceNightMode = doc["force_night_mode"].as<bool>();
    if (doc["reboot_requested_at"].is<uint64_t>()) {
        const uint64_t commandId = doc["reboot_requested_at"].as<uint64_t>();
        restartRequested = commandId != 0 && commandId != g_state.lastRebootCommand;
        if (restartRequested) g_state.lastRebootCommand = commandId;
    }
    g_state.lastCommandMillis = millis();
    unlockState();
    return restartRequested;
}

bool publishTelemetry(bool includeHistory) {
    float distance = -1.0F;
    uint32_t light = 0;
    int32_t potThreshold = DEFAULT_DISTANCE_THRESH;
    bool led = false;
    bool armed = true;
    bool maintenance = false;
    int32_t lightTimer = 30;
    bool forceNightMode = false;
    if (!lockState()) return false;
    distance = g_state.distanceCm;
    light = g_state.lightLevel;
    potThreshold = g_state.localPotThreshold;
    led = g_state.ledState;
    armed = g_state.armed;
    maintenance = g_state.maintenanceMode;
    lightTimer = g_state.lightTimerSeconds;
    forceNightMode = g_state.forceNightMode;
    unlockState();

    JsonDocument telemetry;
    telemetry["distance_cm"] = distance;
    telemetry["light_level"] = light;
    telemetry["led_state"] = led;
    telemetry["pot_threshold_cm"] = potThreshold;
    telemetry["armed"] = armed;
    telemetry["maintenance_mode"] = maintenance;
    telemetry["light_timer_seconds"] = lightTimer;
    telemetry["force_night_mode"] = forceNightMode;
    telemetry["timestamp"] = epochMillis();
    telemetry["uptime_ms"] = millis();
    char payload[512];
    serializeJson(telemetry, payload, sizeof(payload));
    const int telemetryStatus = firebase.patch("telemetry/live", payload);
    if (telemetryStatus < 200 || telemetryStatus >= 300) {
        setLastError("Telemetry upload failed", telemetryStatus);
        return false;
    }

    JsonDocument status;
    status["online"] = true;
    status["last_seen"] = epochMillis();
    status["uptime_seconds"] = millis() / 1000U;
    status["firmware_version"] = FIRMWARE_VERSION;
    status["wifi_rssi"] = WiFi.RSSI();
    status["ip_address"] = WiFi.localIP().toString();
    status["free_heap"] = ESP.getFreeHeap();
    status["reset_reason"] = static_cast<int>(esp_reset_reason());
    status["schema_version"] = 3;
    serializeJson(status, payload, sizeof(payload));
    const int statusCode = firebase.patch("status", payload);
    if (statusCode < 200 || statusCode >= 300) {
        setLastError("Status upload failed", statusCode);
        return false;
    }

    if (includeHistory) {
        const uint64_t timestamp = epochMillis();
        char historyPath[64];
        snprintf(historyPath, sizeof(historyPath), "history/%llu", static_cast<unsigned long long>(timestamp / HISTORY_WRITE_INTERVAL));
        serializeJson(telemetry, payload, sizeof(payload));
        const int historyCode = firebase.put(historyPath, payload);
        if (historyCode < 200 || historyCode >= 300) {
            setLastError("History upload failed", historyCode);
            return false;
        }
    }
    return true;
}

void deliverPendingEvent() {
    EventRecord event{};
    if (!getPendingEvent(event)) return;
    JsonDocument doc;
    doc["id"] = event.id;
    doc["event_type"] = event.type;
    doc["severity"] = event.severity;
    doc["distance_cm"] = event.distanceCm;
    doc["light_level"] = event.lightLevel;
    doc["timestamp"] = event.timestamp;
    char payload[384];
    serializeJson(doc, payload, sizeof(payload));
    char path[80];
    snprintf(path, sizeof(path), "events/%s", event.id);
    const int code = firebase.put(path, payload);
    if (code >= 200 && code < 300) {
        acknowledgeEvent(event.id);
    } else {
        setLastError("Event upload queued", code);
    }
}

void TaskSensors(void* parameters) {
    (void)parameters;
    TickType_t lastWake = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(SENSOR_READ_INTERVAL);
    for (;;) {
        digitalWrite(TRIG_PIN, LOW);
        delayMicroseconds(2);
        digitalWrite(TRIG_PIN, HIGH);
        delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);
        const unsigned long duration = pulseIn(ECHO_PIN, HIGH, ULTRASONIC_TIMEOUT);
        const float distance = duration == 0 ? -1.0F : (duration * 0.0343F / 2.0F);
        const uint32_t light = analogRead(LDR_PIN);
        const uint32_t pot = analogRead(POT_PIN);

        bool triggered = false;
        if (lockState()) {
            g_state.distanceCm = distance;
            g_state.lightLevel = light;
            g_state.smoothedPot = (EMA_ALPHA * pot) + ((1.0F - EMA_ALPHA) * g_state.smoothedPot);
            g_state.localPotThreshold = map(static_cast<int>(g_state.smoothedPot), 0, 4095, 10, 200);
            const int32_t threshold = g_state.manualOverride ? g_state.distanceThreshold : g_state.localPotThreshold;
            triggered = SecurityLogic::shouldTriggerIntrusion(distance, threshold, g_state.armed,
                                                               g_state.maintenanceMode, millis(),
                                                               g_state.lastIntrusionMillis, INTRUSION_COOLDOWN_MS);
            if (triggered) {
                g_state.intrusionDetected = true;
                g_state.lastIntrusionMillis = millis();
            }
            g_state.lastSensorMillis = millis();
            unlockState();
        }
        if (triggered) recordIntrusion(distance, light);
        vTaskDelayUntil(&lastWake, frequency);
    }
}

void TaskControl(void* parameters) {
    (void)parameters;
    TickType_t lastWake = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(15);
    for (;;) {
        if (button.wasPressed() && lockState()) {
            g_state.manualOverride = !g_state.manualOverride;
            if (g_state.manualOverride) {
                g_state.ledState = !g_state.ledState;
                g_state.targetDuty = g_state.ledState ? 255 : 0;
                snprintf(g_state.ledCommand, sizeof(g_state.ledCommand), "%s", g_state.ledState ? "ON" : "OFF");
            } else {
                snprintf(g_state.ledCommand, sizeof(g_state.ledCommand), "AUTO");
            }
            unlockState();
        }

        if (lockState()) {
            if (strcmp(g_state.ledCommand, "AUTO") == 0 && !g_state.manualOverride) {
                const bool isDark = g_state.forceNightMode || (g_state.lightLevel < DARK_THRESHOLD);
                const bool hasMotion = g_state.distanceCm > 0 && g_state.distanceCm < g_state.localPotThreshold;
                if (hasMotion) {
                    g_state.lastMotionMillis = millis();
                }
                const bool motionRecent = (millis() - g_state.lastMotionMillis) < (g_state.lightTimerSeconds * 1000U);
                
                const bool shouldLight = isDark && motionRecent;
                g_state.targetDuty = shouldLight ? 255 : 0;
            } else if (strcmp(g_state.ledCommand, "ON") == 0) {
                g_state.targetDuty = 255;
            } else if (strcmp(g_state.ledCommand, "OFF") == 0) {
                g_state.targetDuty = 0;
            }
            if (g_state.currentDuty < g_state.targetDuty) g_state.currentDuty = min(g_state.currentDuty + 5, g_state.targetDuty);
            if (g_state.currentDuty > g_state.targetDuty) g_state.currentDuty = max(g_state.currentDuty - 5, g_state.targetDuty);
            writePwmOutput(static_cast<uint32_t>(g_state.currentDuty));
            g_state.ledState = g_state.currentDuty > 0;
            g_state.lastControlMillis = millis();
            unlockState();
        }
        vTaskDelayUntil(&lastWake, frequency);
    }
}

void TaskCloud(void* parameters) {
    (void)parameters;
    TickType_t lastWake = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(FIREBASE_WRITE_INTERVAL);
    uint32_t lastHistoryWrite = 0;
    char commandResponse[512];
    for (;;) {
        maintainWiFi();
        if (WiFi.status() == WL_CONNECTED) {
            const int commandCode = firebase.get("commands", commandResponse, sizeof(commandResponse));
            bool restart = false;
            if (commandCode == 200) {
                restart = applyCommands(commandResponse);
            }
            const bool includeHistory = static_cast<uint32_t>(millis() - lastHistoryWrite) >= HISTORY_WRITE_INTERVAL;
            const bool published = publishTelemetry(includeHistory);
            if (includeHistory && published) lastHistoryWrite = millis();
            deliverPendingEvent();
            if (lockState()) {
                g_state.firebaseConnected = published;
                if (published) {
                    g_state.lastHttpStatus = 200;
                    snprintf(g_state.lastError, sizeof(g_state.lastError), "Connected");
                }
                unlockState();
            }
            if (restart) {
                firebase.patch("commands", "{\"reboot_requested_at\":0}");
                delay(250);
                ESP.restart();
            }
        }
        vTaskDelayUntil(&lastWake, frequency);
    }
}

void TaskOta(void* parameters) {
    (void)parameters;
    for (;;) {
        if (WiFi.status() == WL_CONNECTED) ArduinoOTA.handle();
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void TaskHealth(void* parameters) {
    (void)parameters;
    constexpr uint32_t kTaskStallLimitMs = 10000;
    for (;;) {
        bool stalled = false;
        if (lockState()) {
            const uint32_t now = millis();
            stalled = static_cast<uint32_t>(now - g_state.lastSensorMillis) > kTaskStallLimitMs ||
                      static_cast<uint32_t>(now - g_state.lastControlMillis) > kTaskStallLimitMs;
            unlockState();
        }
        if (stalled) {
            Serial.println("[WATCHDOG] Sensor or control task stalled; restarting");
            delay(100);
            ESP.restart();
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
} // namespace

void beginDeviceTasks() {
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LDR_PIN, INPUT);
    pinMode(POT_PIN, INPUT);
    beginPwmOutput();
    writePwmOutput(0);
    button.begin();
    if (lockState()) {
        g_state.lastSensorMillis = millis();
        g_state.lastControlMillis = millis();
        unlockState();
    }

    if (OTA_PASSWORD_HASH[0] != '\0') {
        ArduinoOTA.setHostname(DEVICE_ID);
        ArduinoOTA.setPasswordHash(OTA_PASSWORD_HASH);
        ArduinoOTA.begin();
        Serial.println("[OTA] Secure OTA enabled");
    } else {
        Serial.println("[OTA] Disabled: set SECRET_OTA_PASSWORD_HASH to enable it");
    }

    xTaskCreatePinnedToCore(TaskSensors, "Sensors", TASK_STACK_SIZE_SENSORS, nullptr, TASK_PRIO_SENSORS, nullptr, 1);
    xTaskCreatePinnedToCore(TaskControl, "Control", TASK_STACK_SIZE_CONTROL, nullptr, TASK_PRIO_CONTROL, nullptr, 1);
    xTaskCreatePinnedToCore(TaskCloud, "Cloud", TASK_STACK_SIZE_FIREBASE, nullptr, TASK_PRIO_FIREBASE, nullptr, 0);
    xTaskCreatePinnedToCore(TaskHealth, "Health", TASK_STACK_SIZE_CONTROL, nullptr, TASK_PRIO_CONTROL, nullptr, 1);
    if (OTA_PASSWORD_HASH[0] != '\0') {
        xTaskCreatePinnedToCore(TaskOta, "OTA", TASK_STACK_SIZE_CONTROL, nullptr, TASK_PRIO_FIREBASE, nullptr, 0);
    }
}
