// firebase_service.cpp - Implementation of Firebase RTDB Cloud Sync
#include "firebase_service.h"

#include <ArduinoJson.h>
#include "../config.h"

namespace {
bool isSet(const char* val) {
    return val != nullptr && val[0] != '\0' && strstr(val, "your-") == nullptr &&
           strstr(val, "AIzaSyYour") == nullptr && strstr(val, "PASTE_") == nullptr;
}
}

FirebaseService::FirebaseService() {
    secureClient_.setInsecure();
    http_.setReuse(true);
}

FirebaseService::~FirebaseService() {
    http_.end();
    secureClient_.stop();
}

bool FirebaseService::isConfigured() const {
    return isSet(FIREBASE_URL) && isSet(FIREBASE_API_KEY);
}

bool FirebaseService::ensureAuthenticated() {
    if (!isConfigured()) return false;
    if (!idToken_.isEmpty() && static_cast<int32_t>(tokenExpiresAt_ - millis()) > 60000) {
        return true;
    }
    return authenticate();
}

bool FirebaseService::authenticate() {
    if (!isSet(FIREBASE_AUTH_EMAIL) || !isSet(FIREBASE_AUTH_PASSWORD)) {
        // If no user auth is specified, we attempt direct tokenless access
        return true;
    }

    char url[256];
    snprintf(url, sizeof(url), "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=%s", FIREBASE_API_KEY);

    if (!http_.begin(secureClient_, url)) return false;
    http_.setTimeout(HTTP_TIMEOUT_MS);
    http_.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["email"] = FIREBASE_AUTH_EMAIL;
    doc["password"] = FIREBASE_AUTH_PASSWORD;
    doc["returnSecureToken"] = true;

    String payload;
    serializeJson(doc, payload);

    const int status = http_.POST(payload);
    if (status != HTTP_CODE_OK) {
        http_.end();
        return false;
    }

    String resp = http_.getString();
    http_.end();

    JsonDocument resDoc;
    if (deserializeJson(resDoc, resp)) return false;

    if (resDoc["idToken"].is<const char*>()) {
        idToken_ = resDoc["idToken"].as<const char*>();
        const uint32_t exp = resDoc["expiresIn"] | 3600U;
        tokenExpiresAt_ = millis() + (exp * 1000U);
        return true;
    }
    return false;
}

int FirebaseService::request(const char* path, const char* method, const char* payload) {
    if (!isConfigured()) return -1;
    ensureAuthenticated();

    char url[384];
    if (!idToken_.isEmpty()) {
        snprintf(url, sizeof(url), "%s/%s.json?auth=%s", FIREBASE_URL, path, idToken_.c_str());
    } else {
        snprintf(url, sizeof(url), "%s/%s.json", FIREBASE_URL, path);
    }

    if (!http_.begin(secureClient_, url)) return -1;
    http_.setTimeout(HTTP_TIMEOUT_MS);
    http_.addHeader("Content-Type", "application/json");

    int status = -1;
    if (strcmp(method, "PATCH") == 0) {
        status = http_.sendRequest("PATCH", payload);
    } else if (strcmp(method, "PUT") == 0) {
        status = http_.PUT(payload);
    } else if (strcmp(method, "POST") == 0) {
        status = http_.POST(payload);
    }
    http_.end();
    return status;
}

bool FirebaseService::syncTelemetry(const WeatherSnapshot& s, AlertSeverity severity) {
    if (!isConfigured() || !s.valid) return false;

    JsonDocument doc;
    doc["province"] = s.provinceEn;
    doc["province_th"] = s.province;
    doc["temperature"] = s.temperature;
    doc["apparent_temp"] = s.apparentTemperature;
    doc["humidity"] = s.humidity;
    doc["uv_index"] = s.uvIndex;
    doc["wind_speed_kmh"] = s.windSpeed;
    doc["wind_gusts_kmh"] = s.windGusts;
    doc["precipitation_mm"] = s.precipitation;
    doc["weather_code"] = s.weatherCode;
    doc["river_discharge_m3s"] = s.riverDischarge;
    doc["severity"] = severityToString(severity);
    doc["timestamp"] = millis();

    String payload;
    serializeJson(doc, payload);

    char path[128];
    snprintf(path, sizeof(path), "devices/%s/telemetry/live", DEVICE_ID);
    return request(path, "PATCH", payload.c_str()) == HTTP_CODE_OK;
}

bool FirebaseService::syncStatus(bool wifiConnected, bool mqttConnected, const char* firmwareVersion) {
    if (!isConfigured()) return false;

    JsonDocument doc;
    doc["online"] = wifiConnected;
    doc["mqtt_connected"] = mqttConnected;
    doc["firmware_version"] = firmwareVersion;
    doc["uptime_sec"] = millis() / 1000;
    doc["last_seen"] = millis();

    String payload;
    serializeJson(doc, payload);

    char path[128];
    snprintf(path, sizeof(path), "devices/%s/status", DEVICE_ID);
    return request(path, "PATCH", payload.c_str()) == HTTP_CODE_OK;
}

bool FirebaseService::pushAlert(const AlertPayload& alert) {
    if (!isConfigured()) return false;

    JsonDocument doc;
    doc["id"] = alert.alertId;
    doc["kind"] = hazardKindToString(alert.kind);
    doc["severity"] = severityToString(alert.severity);
    doc["province"] = alert.province;
    doc["message"] = alert.message;
    doc["timestamp"] = alert.timestamp;

    String payload;
    serializeJson(doc, payload);

    char path[160];
    snprintf(path, sizeof(path), "devices/%s/alerts/%s", DEVICE_ID, alert.alertId);
    return request(path, "PUT", payload.c_str()) == HTTP_CODE_OK;
}
