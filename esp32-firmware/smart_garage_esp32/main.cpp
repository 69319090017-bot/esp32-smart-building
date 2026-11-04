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
    delay(10);
    Serial.println("\n==================================");
    Serial.printf("[SYSTEM] Smart Garage firmware %s\n", FIRMWARE_VERSION);

    g_stateMutex = xSemaphoreCreateMutex();
    if (g_stateMutex == nullptr) {
        Serial.println("[FATAL] Could not create state mutex");
        while (true) delay(1000);
    }

    if (!LittleFS.begin(true)) {
        setLastError("LittleFS mount failed");
        Serial.println("[ERROR] LittleFS mount failed");
    }
    if (!beginEventLog()) {
        setLastError("Event log unavailable");
        Serial.println("[ERROR] Event log unavailable");
    }

    beginWiFi();
    beginWebApi();
    beginDeviceTasks();
}

// FreeRTOS owns the application work. Keeping loop alive prevents an accidental
// self-delete from making future Arduino library integration harder.
void loop() {
    delay(1000);
}
