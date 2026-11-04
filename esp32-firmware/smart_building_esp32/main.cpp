// main.cpp - Entry Point for ESP32 Smart Building Command Center (2026 Edition)
#include <Arduino.h>
#include <LittleFS.h>

#include "../config.h"
#include "app_state.h"
#include "device_tasks.h"
#include "event_log.h"
#include "web_api.h"
#include "wifi_manager.h"

void setup() {
    Serial.begin(115200);
    delay(200);

    Serial.println("\n=======================================================");
    Serial.println("  🏢 ESP32 SMART BUILDING COMMAND CENTER (2026)");
    Serial.println("  Disaster Early Warning & Multi-Hazard Automation Node");
    Serial.printf("  Firmware Version: %s | Device ID: %s\n", FIRMWARE_VERSION, DEVICE_ID);
    Serial.println("=======================================================\n");

    // 1. Create FreeRTOS State Mutex
    g_stateMutex = xSemaphoreCreateMutex();
    if (g_stateMutex == nullptr) {
        Serial.println("[FATAL] Could not create FreeRTOS state mutex!");
        while (true) delay(1000);
    }

    // 2. Mount LittleFS Flash Storage
    if (!LittleFS.begin(true)) {
        Serial.println("[ERROR] LittleFS mount failed!");
        setLastError("LittleFS mount failed");
    } else {
        Serial.println("[STORAGE] LittleFS mounted successfully");
    }

    // 3. Initialize Event Logger
    if (!beginEventLog()) {
        Serial.println("[ERROR] Event Log system unavailable");
    }

    // 4. Connect to Wi-Fi
    beginWiFi();

    // 5. Start Local Async Web Server & WebSockets
    beginWebApi();

    // 6. Launch FreeRTOS Dual-Core Multitasking Engine
    beginDeviceTasks();
}

void loop() {
    // FreeRTOS tasks execute independently on Core 0 and Core 1.
    // Keeping main Arduino loop alive with low-priority delay.
    vTaskDelay(pdMS_TO_TICKS(1000));
}
