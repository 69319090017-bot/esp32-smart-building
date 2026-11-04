// device_tasks.cpp - Implementation of FreeRTOS Dual-Core Tasks
#include "device_tasks.h"

#include "../config.h"
#include "actuator_service.h"
#include "alert_engine.h"
#include "app_state.h"
#include "audio_service.h"
#include "event_log.h"
#include "firebase_service.h"
#include "mqtt_service.h"
#include "provinces.h"
#include "telegram_service.h"
#include "weather_service.h"
#include "web_api.h"
#include "wifi_manager.h"

namespace {
WeatherService weatherService;
AlertEngine alertEngine;
TelegramService telegramService;
MqttService mqttService;
AudioService audioService;
ActuatorService actuatorService;
FirebaseService firebaseService;

// Forward Task Declarations
void TaskNetworkPoll(void* pvParameters);
void TaskMqtt(void* pvParameters);
void TaskCloudSync(void* pvParameters);
void TaskActuators(void* pvParameters);

uint8_t lastKnownProvinceIndex = 255;
}

void beginDeviceTasks() {
    actuatorService.begin();
    audioService.begin();
    mqttService.begin();

    // 1. Core 1 Tasks (High-Priority Real-Time IO & Actuators)
    xTaskCreatePinnedToCore(
        TaskActuators,
        "TaskActuators",
        TASK_STACK_SIZE_ACTUATOR,
        nullptr,
        TASK_PRIO_ACTUATOR,
        nullptr,
        1 // Core 1
    );

    // 2. Core 0 Tasks (Network, HTTPS, MQTT, Cloud)
    xTaskCreatePinnedToCore(
        TaskNetworkPoll,
        "TaskNetworkPoll",
        TASK_STACK_SIZE_NETWORK,
        nullptr,
        TASK_PRIO_NETWORK,
        nullptr,
        0 // Core 0
    );

    xTaskCreatePinnedToCore(
        TaskMqtt,
        "TaskMqtt",
        TASK_STACK_SIZE_MQTT,
        nullptr,
        TASK_PRIO_MQTT,
        nullptr,
        0 // Core 0
    );

    xTaskCreatePinnedToCore(
        TaskCloudSync,
        "TaskCloudSync",
        TASK_STACK_SIZE_FIREBASE,
        nullptr,
        TASK_PRIO_FIREBASE,
        nullptr,
        0 // Core 0
    );

    Serial.println("[SYSTEM] All FreeRTOS Dual-Core tasks successfully launched");
}

// ------------------------------------------------------------------------------
// Core 0: Network Polling & 6-Hazard Alert Processing
// ------------------------------------------------------------------------------
void TaskNetworkPoll(void* pvParameters) {
    TickType_t lastWakeTime = xTaskGetTickCount();

    while (true) {
        if (isWiFiConnected()) {
            uint8_t currentProvIdx = 0;
            if (lockState()) {
                currentProvIdx = g_state.provinceIndex;
                unlockState();
            }

            const ProvinceInfo* targetProvince = getProvinceByIndex(currentProvIdx);
            WeatherSnapshot snapshot{};

            if (weatherService.fetch(targetProvince, snapshot)) {
                bool allCleared = false;
                std::vector<AlertPayload> newAlerts = alertEngine.evaluate(snapshot, allCleared);
                AlertSeverity highestSev = alertEngine.getHighestSeverity();

                if (lockState()) {
                    g_state.weather = snapshot;
                    g_state.highestSeverity = highestSev;
                    g_state.activeAlertsCount = 0;

                    // If new active alerts, fill array
                    for (size_t i = 0; i < newAlerts.size() && i < MAX_ACTIVE_ALERTS; ++i) {
                        g_state.activeAlerts[g_state.activeAlertsCount++] = newAlerts[i];
                    }

                    if (highestSev == AlertSeverity::CRITICAL) {
                        g_state.strobeState = true;
                        g_state.doorUnlocked = true;
                        g_state.sirenActive = true;
                    } else if (highestSev == AlertSeverity::WARNING) {
                        g_state.strobeState = true;
                        g_state.doorUnlocked = false;
                        g_state.sirenActive = true;
                    } else if (allCleared) {
                        g_state.strobeState = false;
                        g_state.doorUnlocked = false;
                        g_state.sirenActive = false;
                        g_state.silenceRequested = false;
                    }
                    unlockState();
                }

                // 1. Dispatch Telegram Notifications for new alerts
                for (const auto& alert : newAlerts) {
                    telegramService.sendAlert(alert);
                    firebaseService.pushAlert(alert);
                    logAlertEvent(alert);
                }

                // 2. Publish Alert State & Telemetry via MQTT
                mqttService.publishAlertState(highestSev);
                mqttService.publishTelemetry(snapshot, highestSev);

                // 3. Log to LittleFS CSV
                logWeatherReading(snapshot, highestSev);

                // 4. Broadcast via Local WebSockets
                broadcastWsUpdate();
            }
        } else {
            checkWiFiHealth();
        }

        // Wait for next polling cycle (60s) or wake up earlier if province changed
        vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(WEATHER_POLL_INTERVAL_MS));
    }
}

// ------------------------------------------------------------------------------
// Core 0: MQTT Loop & Telemetry Stream
// ------------------------------------------------------------------------------
void TaskMqtt(void* pvParameters) {
    while (true) {
        if (isWiFiConnected()) {
            mqttService.loop();
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

// ------------------------------------------------------------------------------
// Core 0: Firebase RTDB Cloud Sync (every 5 seconds)
// ------------------------------------------------------------------------------
void TaskCloudSync(void* pvParameters) {
    while (true) {
        if (isWiFiConnected() && firebaseService.isConfigured()) {
            WeatherSnapshot s;
            AlertSeverity sev = AlertSeverity::NORMAL;
            bool wifiOk = false;
            bool mqttOk = false;

            if (lockState()) {
                s = g_state.weather;
                sev = g_state.highestSeverity;
                wifiOk = g_state.wifiConnected;
                mqttOk = g_state.mqttConnected;
                unlockState();
            }

            firebaseService.syncTelemetry(s, sev);
            firebaseService.syncStatus(wifiOk, mqttOk, FIRMWARE_VERSION);
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

// ------------------------------------------------------------------------------
// Core 1: Real-Time Hardware Actuators, Relays, Button, & Audio
// ------------------------------------------------------------------------------
void TaskActuators(void* pvParameters) {
    while (true) {
        AlertSeverity sev = AlertSeverity::NORMAL;
        bool strobe = false;
        bool door = false;
        bool test = false;
        bool silence = false;

        if (lockState()) {
            sev = g_state.highestSeverity;
            strobe = g_state.strobeState;
            door = g_state.doorUnlocked;
            test = g_state.testMode;
            silence = g_state.silenceRequested;
            unlockState();
        }

        // 1. Update Relays & LEDs
        actuatorService.update(sev, strobe, door, test, silence);

        // 2. Update Siren / Audio Alert
        audioService.update(sev, silence);

        // 3. Handle Button Inputs
        if (actuatorService.checkButtonShortPress()) {
            Serial.println("[BUTTON] Short Press -> Alarm Silenced");
            if (lockState()) {
                g_state.silenceRequested = true;
                unlockState();
            }
            audioService.stop();
        }

        if (actuatorService.checkButtonLongPress()) {
            Serial.println("[BUTTON] Long Press -> Emergency Test Mode Toggled");
            if (lockState()) {
                g_state.testMode = !g_state.testMode;
                unlockState();
            }
        }

        // 4. Sample Local Sensors (ADC1)
        uint32_t light = actuatorService.readIndoorLight();
        int32_t pot = actuatorService.readSensitivityPot();
        if (lockState()) {
            g_state.indoorLightLevel = light;
            g_state.sensitivityPot = pot;
            unlockState();
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
