// telegram_service.h - Telegram Bot HTTPS Notification Dispatcher
#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "weather_types.h"

class TelegramService {
public:
    TelegramService();
    ~TelegramService();

    bool isConfigured() const;

    // Sends an immediate alert to Telegram
    bool sendAlert(const AlertPayload& alert);

    // Sends a custom notification message
    bool sendMessage(const char* text);

private:
    WiFiClientSecure secureClient_;
    HTTPClient http_;
    uint32_t lastSentMillis_ = 0;
};
