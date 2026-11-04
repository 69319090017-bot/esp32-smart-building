// wifi_manager.cpp - Implementation of Wi-Fi Connection Manager
#include "wifi_manager.h"

#include <WiFi.h>
#include "../config.h"
#include "app_state.h"

namespace {
uint32_t reconnectDelayMs = 2000;
uint32_t lastCheckMillis = 0;
}

void beginWiFi() {
    if (WIFI_SSID == nullptr || strlen(WIFI_SSID) == 0 || strstr(WIFI_SSID, "YOUR_") != nullptr) {
        Serial.println("[WIFI] Warning: Wi-Fi credentials not configured in secrets.h");
        return;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);

    uint32_t startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 10000) {
        delay(250);
        Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WIFI] Connected! IP Address: %s | RSSI: %d dBm\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
        if (lockState()) {
            g_state.wifiConnected = true;
            unlockState();
        }
    } else {
        Serial.println("[WIFI] Initial connection timed out. Background task will retry.");
    }
}

void checkWiFiHealth() {
    if (millis() - lastCheckMillis < 10000) return;
    lastCheckMillis = millis();

    if (WiFi.status() == WL_CONNECTED) {
        reconnectDelayMs = 2000;
        if (lockState()) {
            g_state.wifiConnected = true;
            unlockState();
        }
    } else {
        Serial.println("[WIFI] Connection lost! Attempting auto-reconnect...");
        if (lockState()) {
            g_state.wifiConnected = false;
            unlockState();
        }
        WiFi.disconnect();
        WiFi.reconnect();
    }
}

bool isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}
