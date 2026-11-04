#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

class FirebaseService {
public:
    FirebaseService();
    ~FirebaseService();

    int get(const char* devicePath, char* response, size_t responseSize);
    int patch(const char* devicePath, const char* payload);
    int put(const char* devicePath, const char* payload);
    void invalidateToken();

private:
    bool ensureAuthenticated();
    bool authenticate();
    int request(const char* devicePath, const char* method, const char* payload,
                char* response, size_t responseSize);

    String idToken_;
    uint32_t tokenExpiresAt_ = 0;

    WiFiClientSecure secureClient_;
    HTTPClient http_;
};
