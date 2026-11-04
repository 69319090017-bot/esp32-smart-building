// telegram_service.cpp - Implementation of Telegram Bot HTTPS Notification Dispatcher
#include "telegram_service.h"

#include <ArduinoJson.h>
#include "../config.h"

TelegramService::TelegramService() {
    secureClient_.setInsecure();
    http_.setReuse(false);
}

TelegramService::~TelegramService() {
    http_.end();
    secureClient_.stop();
}

bool TelegramService::isConfigured() const {
    return (TELEGRAM_BOT_TOKEN != nullptr && strlen(TELEGRAM_BOT_TOKEN) > 5 &&
            TELEGRAM_CHAT_ID != nullptr && strlen(TELEGRAM_CHAT_ID) > 2 &&
            strstr(TELEGRAM_BOT_TOKEN, "YOUR_") == nullptr);
}

bool TelegramService::sendMessage(const char* text) {
    if (!isConfigured()) {
        return false;
    }
    if (!text || strlen(text) == 0) {
        return false;
    }

    // Rate-limiting guard: maximum 1 message every 1500 ms
    if (millis() - lastSentMillis_ < 1500) {
        delay(1500 - (millis() - lastSentMillis_));
    }

    char url[256];
    snprintf(url, sizeof(url), "https://api.telegram.org/bot%s/sendMessage", TELEGRAM_BOT_TOKEN);

    if (!http_.begin(secureClient_, url)) {
        return false;
    }

    http_.setTimeout(8000);
    http_.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["chat_id"] = TELEGRAM_CHAT_ID;
    doc["text"] = text;
    doc["parse_mode"] = "HTML";

    String payload;
    serializeJson(doc, payload);

    const int status = http_.POST(payload);
    http_.end();

    lastSentMillis_ = millis();

    if (status == HTTP_CODE_OK) {
        Serial.println("[TELEGRAM] Message dispatched successfully");
        return true;
    } else {
        Serial.printf("[TELEGRAM] POST failed with code: %d\n", status);
        return false;
    }
}

bool TelegramService::sendAlert(const AlertPayload& alert) {
    if (!isConfigured()) {
        return false;
    }

    const char* icon = (alert.severity == AlertSeverity::CRITICAL) ? "🚨" : "⚠️";
    const char* action = (alert.severity == AlertSeverity::CRITICAL)
                         ? "เปิดไฟไซเรนฉุกเฉิน | ปลดล็อกประตูอัตโนมัติ"
                         : "เปิดสัญญาณไฟเตือนเฝ้าระวัง";

    char formatted[512];
    snprintf(formatted, sizeof(formatted),
             "%s <b>[%s]</b> %s\n"
             "⚙️ <b>การตอบสนองระบบ:</b> %s\n"
             "🌐 <b>อุปกรณ์:</b> %s (%s)\n"
             "⏱️ <b>เวลา:</b> %lu วินาที (Uptime)",
             icon, severityToString(alert.severity), alert.message,
             action, DEVICE_ID, FIRMWARE_VERSION,
             static_cast<unsigned long>(millis() / 1000));

    return sendMessage(formatted);
}
