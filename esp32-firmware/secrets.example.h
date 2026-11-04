// secrets.example.h - Template for Smart Building Command Center Credentials
#pragma once

// 1. Wi-Fi Credentials
#define SECRET_WIFI_SSID "YOUR_WIFI_SSID"
#define SECRET_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// 2. Telegram Bot Credentials
#define SECRET_TELEGRAM_BOT_TOKEN "YOUR_TELEGRAM_BOT_TOKEN"
#define SECRET_TELEGRAM_CHAT_ID "YOUR_TELEGRAM_CHAT_ID"

// 3. MQTT Broker Settings
#define SECRET_MQTT_BROKER "broker.hivemq.com"
#define SECRET_MQTT_PORT 1883

// 4. Firebase Cloud Realtime Database (Optional / Extensible)
#define SECRET_FIREBASE_URL "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app"
#define SECRET_FIREBASE_API_KEY "AIzaSyYourProjectWebApiKeyHere"
#define SECRET_FIREBASE_AUTH_EMAIL "esp32-building@example.com"
#define SECRET_FIREBASE_AUTH_PASSWORD "StrongDevicePassword123!"
#define SECRET_FIREBASE_ROOT_CA ""

// 5. Device Identity
#define SECRET_DEVICE_ID "smart_building_001"
