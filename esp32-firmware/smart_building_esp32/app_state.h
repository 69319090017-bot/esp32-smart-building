// app_state.h - Thread-Safe Application State for Smart Building Command Center
#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#include "weather_types.h"
#include "provinces.h"

constexpr size_t MAX_ACTIVE_ALERTS = 8;

struct AppState {
    // Current Weather Snapshot
    WeatherSnapshot weather;

    // Active Disaster Alerts (Multi-Hazard)
    AlertPayload activeAlerts[MAX_ACTIVE_ALERTS];
    size_t activeAlertsCount = 0;
    AlertSeverity highestSeverity = AlertSeverity::NORMAL;

    // Selected Monitored Province
    uint8_t provinceIndex = 0;

    // Actuator & Relay States
    bool strobeState = false;       // Relay 1 (GPIO 2)
    bool doorUnlocked = false;      // Relay 2 (GPIO 4)
    bool sirenActive = false;       // Piezo Siren / Audio (GPIO 27 / DFPlayer)
    bool silenceRequested = false;  // User pressed silence button
    bool testMode = false;          // User triggered emergency simulation/test

    // Local Indoor Sensors (Optional comparison)
    uint32_t indoorLightLevel = 0;  // LDR (GPIO 34)
    int32_t sensitivityPot = 50;    // Potentiometer (GPIO 35)

    // Connectivity Status
    bool wifiConnected = false;
    bool mqttConnected = false;
    bool firebaseConnected = false;
    bool telegramConfigured = false;

    // Timestamps
    uint32_t lastWeatherFetchMillis = 0;
    uint32_t lastAlertEvaluateMillis = 0;
    uint32_t lastTelegramSendMillis = 0;
    uint32_t lastMqttPublishMillis = 0;
    uint32_t lastActuatorUpdateMillis = 0;

    // Error & Diagnostics
    int lastHttpStatus = 0;
    char lastError[64] = "System Initializing";
};

extern AppState g_state;
extern SemaphoreHandle_t g_stateMutex;

bool lockState(TickType_t timeout = pdMS_TO_TICKS(150));
void unlockState();
void setLastError(const char* message, int httpStatus = 0);
uint64_t epochMillis();
