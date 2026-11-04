#include "wifi_manager.h"

#include <WiFi.h>
#include <time.h>

#include "../config.h"
#include "app_state.h"

namespace {
uint32_t lastConnectAttempt = 0;

void onWiFiEvent(WiFiEvent_t event) {
    if (!lockState(pdMS_TO_TICKS(20))) return;
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            g_state.wifiConnected = true;
            g_state.wifiRetryDelayMs = WIFI_RECONNECT_INITIAL_MS;
            snprintf(g_state.lastError, sizeof(g_state.lastError), "Connected to WiFi");
            Serial.printf("[WIFI] Connected: %s\n", WiFi.localIP().toString().c_str());
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            g_state.wifiConnected = false;
            g_state.firebaseConnected = false;
            snprintf(g_state.lastError, sizeof(g_state.lastError), "WiFi disconnected");
            Serial.println("[WIFI] Disconnected");
            break;
        default:
            break;
    }
    unlockState();
}
} // namespace

void beginWiFi() {
    Serial.printf("[WIFI] Connecting to SSID: '%s'...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false);
    WiFi.onEvent(onWiFiEvent);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    // UTC is used for database timestamps. Dashboard converts it to local time.
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    lastConnectAttempt = millis();
}

void maintainWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;
    uint32_t retryDelay = WIFI_RECONNECT_INITIAL_MS;
    if (lockState()) {
        retryDelay = g_state.wifiRetryDelayMs;
        unlockState();
    }
    if (static_cast<uint32_t>(millis() - lastConnectAttempt) < retryDelay) return;

    lastConnectAttempt = millis();
    Serial.printf("[WIFI] Reconnecting in backoff window (%lu ms)\n", static_cast<unsigned long>(retryDelay));
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    if (lockState()) {
        const uint32_t doubledDelay = g_state.wifiRetryDelayMs * 2U;
        g_state.wifiRetryDelayMs = doubledDelay > static_cast<uint32_t>(WIFI_RECONNECT_MAX_MS)
            ? static_cast<uint32_t>(WIFI_RECONNECT_MAX_MS)
            : doubledDelay;
        unlockState();
    }
}
