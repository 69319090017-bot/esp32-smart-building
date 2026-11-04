#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

struct AppState {
    float distanceCm = -1.0F;
    uint32_t lightLevel = 0;
    float smoothedPot = 0.0F;
    int32_t localPotThreshold = 50;

    int32_t currentDuty = 0;
    int32_t targetDuty = 0;
    bool ledState = false;

    bool manualOverride = false;
    int32_t distanceThreshold = 50;
    char ledCommand[16] = "AUTO";
    bool armed = true;
    bool maintenanceMode = false;
    int32_t lightTimerSeconds = 30;
    bool forceNightMode = false;

    bool intrusionDetected = false;
    bool wifiConnected = false;
    bool firebaseConnected = false;
    uint32_t lastIntrusionMillis = 0;
    uint32_t lastMotionMillis = 0;
    uint32_t lastCommandMillis = 0;
    uint32_t lastSensorMillis = 0;
    uint32_t lastControlMillis = 0;
    uint64_t lastRebootCommand = 0;
    uint32_t wifiRetryDelayMs = 2000;
    int lastHttpStatus = 0;
    char lastError[64] = "Starting";
};

extern AppState g_state;
extern SemaphoreHandle_t g_stateMutex;

bool lockState(TickType_t timeout = pdMS_TO_TICKS(100));
void unlockState();
void setLastError(const char* message, int httpStatus = 0);
uint64_t epochMillis();
