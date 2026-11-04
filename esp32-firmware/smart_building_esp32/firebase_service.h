// firebase_service.h - Google Firebase Realtime Database Cloud Sync
#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "weather_types.h"

class FirebaseService {
public:
    FirebaseService();
    ~FirebaseService();

    bool isConfigured() const;
    bool syncTelemetry(const WeatherSnapshot& snapshot, AlertSeverity severity);
    bool syncStatus(bool wifiConnected, bool mqttConnected, const char* firmwareVersion);
    bool pushAlert(const AlertPayload& alert);

private:
    WiFiClientSecure secureClient_;
    HTTPClient http_;
    String idToken_;
    uint32_t tokenExpiresAt_ = 0;

    bool ensureAuthenticated();
    bool authenticate();
    int request(const char* path, const char* method, const char* payload);
};
