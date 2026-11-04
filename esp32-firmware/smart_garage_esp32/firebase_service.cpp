#include "firebase_service.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "../config.h"

namespace {
bool credentialConfigured(const char* value) {
    return value != nullptr && value[0] != '\0' && strstr(value, "your-") == nullptr &&
           strstr(value, "PASTE_") == nullptr;
}
} // namespace

FirebaseService::FirebaseService() {
    if (credentialConfigured(FIREBASE_ROOT_CA)) {
        secureClient_.setCACert(FIREBASE_ROOT_CA);
    } else {
        secureClient_.setInsecure();
    }
    http_.setReuse(true);
}

FirebaseService::~FirebaseService() {
    http_.end();
    secureClient_.stop();
}

void FirebaseService::invalidateToken() {
    idToken_ = "";
    tokenExpiresAt_ = 0;
}

bool FirebaseService::ensureAuthenticated() {
    // Refresh one minute before expiry. Unsigned subtraction is intentional:
    // on millis() rollover the existing token is renewed safely.
    if (!idToken_.isEmpty() && static_cast<int32_t>(tokenExpiresAt_ - millis()) > 60000) {
        return true;
    }
    return authenticate();
}

bool FirebaseService::authenticate() {
    if (!credentialConfigured(FIREBASE_API_KEY) || !credentialConfigured(FIREBASE_AUTH_EMAIL) ||
        !credentialConfigured(FIREBASE_AUTH_PASSWORD)) {
        Serial.println("[FIREBASE] Missing Firebase Auth configuration");
        return false;
    }

    WiFiClientSecure client;
    if (credentialConfigured(FIREBASE_ROOT_CA)) {
        client.setCACert(FIREBASE_ROOT_CA);
    } else {
        client.setInsecure();
    }
    HTTPClient http;
    char url[196];
    snprintf(url, sizeof(url),
             "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=%s",
             FIREBASE_API_KEY);
    if (!http.begin(client, url)) return false;

    JsonDocument requestDoc;
    requestDoc["email"] = FIREBASE_AUTH_EMAIL;
    requestDoc["password"] = FIREBASE_AUTH_PASSWORD;
    requestDoc["returnSecureToken"] = true;
    String payload;
    serializeJson(requestDoc, payload);

    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(payload);
    if (status != HTTP_CODE_OK) {
        Serial.printf("[FIREBASE] Auth failed: %d\n", status);
        http.end();
        return false;
    }

    String responseBody = http.getString();
    JsonDocument responseDoc;
    const DeserializationError error = deserializeJson(responseDoc, responseBody);
    http.end();
    if (error || !responseDoc["idToken"].is<const char*>()) {
        Serial.println("[FIREBASE] Invalid authentication response");
        return false;
    }

    idToken_ = responseDoc["idToken"].as<const char*>();
    const uint32_t expiresInSeconds = responseDoc["expiresIn"] | 3600U;
    tokenExpiresAt_ = millis() + (expiresInSeconds * 1000U);
    Serial.println("[FIREBASE] Device authentication succeeded");
    return true;
}

int FirebaseService::get(const char* devicePath, char* response, size_t responseSize) {
    return request(devicePath, "GET", nullptr, response, responseSize);
}

int FirebaseService::patch(const char* devicePath, const char* payload) {
    return request(devicePath, "PATCH", payload, nullptr, 0);
}

int FirebaseService::put(const char* devicePath, const char* payload) {
    return request(devicePath, "PUT", payload, nullptr, 0);
}

int FirebaseService::request(const char* devicePath, const char* method, const char* payload,
                             char* response, size_t responseSize) {
    if (!ensureAuthenticated()) return -1;

    String baseUrl = FIREBASE_URL;
    if (baseUrl.endsWith("/")) baseUrl.remove(baseUrl.length() - 1);
    char url[2048];
    snprintf(url, sizeof(url), "%s/devices/%s/%s.json?auth=%s", baseUrl.c_str(), DEVICE_ID, devicePath, idToken_.c_str());
    if (!http_.begin(secureClient_, url)) return -2;

    http_.setTimeout(HTTP_TIMEOUT_MS);
    int status = -3;
    if (strcmp(method, "GET") == 0) {
        status = http_.GET();
    } else {
        http_.addHeader("Content-Type", "application/json");
        if (strcmp(method, "PATCH") == 0) status = http_.PATCH(payload == nullptr ? "{}" : payload);
        if (strcmp(method, "PUT") == 0) status = http_.PUT(payload == nullptr ? "{}" : payload);
    }

    if (status == HTTP_CODE_UNAUTHORIZED || status == HTTP_CODE_FORBIDDEN) {
        Serial.printf("[FIREBASE] Request to %s failed with %d. Rules blocking or token invalid!\n", devicePath, status);
        invalidateToken();
    }
    
    if (status >= 200 && status < 300 && response != nullptr && responseSize > 0) {
        int len = http_.getSize();
        if (len > 0 && (size_t)len < responseSize) {
            http_.getStream().readBytes(response, len);
            response[len] = '\0';
        } else {
            size_t bytesRead = http_.getStream().readBytes(response, responseSize - 1);
            response[bytesRead] = '\0';
        }
    }
    // Intentionally NOT calling http_.end() to keep the TCP/TLS connection alive
    return status;
}
