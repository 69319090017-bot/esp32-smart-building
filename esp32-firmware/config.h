// config.h - Smart Building Command Center Configuration (2026 Edition)
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#if __has_include("secrets.h")
#include "secrets.h"
#elif __has_include("smart_building_esp32/secrets.h")
#include "smart_building_esp32/secrets.h"
#else
#include "secrets.example.h"
#endif

// ==============================================================================
// 1. Firmware Metadata & Device Identity
// ==============================================================================
constexpr const char* FIRMWARE_VERSION = "4.0.0-disaster2026";
constexpr const char* DEVICE_ID = SECRET_DEVICE_ID;

// ==============================================================================
// 2. Network & Cloud Credentials
// ==============================================================================
constexpr const char* WIFI_SSID = SECRET_WIFI_SSID;
constexpr const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;

// Telegram Bot Settings
constexpr const char* TELEGRAM_BOT_TOKEN = SECRET_TELEGRAM_BOT_TOKEN;
constexpr const char* TELEGRAM_CHAT_ID = SECRET_TELEGRAM_CHAT_ID;

// MQTT Settings (HiveMQ / Private Broker)
constexpr const char* MQTT_BROKER = SECRET_MQTT_BROKER;
constexpr uint16_t MQTT_PORT = SECRET_MQTT_PORT;
constexpr const char* MQTT_CLIENT_ID = "ESP32_SmartBuilding_001";
constexpr const char* MQTT_TOPIC_ALARM = "smart_building/alarm/strobe";
constexpr const char* MQTT_TOPIC_DOOR = "smart_building/doors/emergency";
constexpr const char* MQTT_TOPIC_TELEMETRY = "smart_building/telemetry/weather";
constexpr const char* MQTT_TOPIC_COMMAND_SUB = "smart_building/command/#";

// Firebase Configuration
constexpr const char* FIREBASE_URL = SECRET_FIREBASE_URL;
constexpr const char* FIREBASE_API_KEY = SECRET_FIREBASE_API_KEY;
constexpr const char* FIREBASE_AUTH_EMAIL = SECRET_FIREBASE_AUTH_EMAIL;
constexpr const char* FIREBASE_AUTH_PASSWORD = SECRET_FIREBASE_AUTH_PASSWORD;
constexpr const char* FIREBASE_ROOT_CA = SECRET_FIREBASE_ROOT_CA;

// ==============================================================================
// 3. Open-Meteo API Endpoints
// ==============================================================================
constexpr const char* OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
constexpr const char* OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood";
constexpr unsigned long WEATHER_POLL_INTERVAL_MS = 60000; // 60 seconds
constexpr unsigned long HTTP_TIMEOUT_MS = 10000;         // 10 seconds

// ==============================================================================
// 4. Multi-Hazard Alert Thresholds (WHO / WMO Standards)
// ==============================================================================
// 1. UV Index
constexpr float UV_WARNING_INDEX = 8.0f;        // Very High risk
constexpr float UV_CRITICAL_INDEX = 11.0f;      // Extreme risk

// 2. Heat Index / Apparent Temperature (°C)
constexpr float HEAT_WARNING_TEMP = 37.0f;      // Heat exhaustion risk
constexpr float HEAT_CRITICAL_TEMP = 41.0f;     // Heatstroke risk

// 3. Precipitation (mm/hour)
constexpr float RAIN_WARNING_MM = 10.0f;        // Heavy rain
constexpr float RAIN_CRITICAL_MM = 35.0f;       // Violent rain / Flash flood risk

// 4. Wind Gusts (km/h)
constexpr float GUST_WARNING_KMH = 50.0f;       // Strong wind gust
constexpr float GUST_CRITICAL_KMH = 89.0f;      // Severe gale / Storm gust

// 5. River Discharge (m³/s)
constexpr float FLOOD_DISCHARGE_ALERT_M3S = 500.0f; // River flood threshold

// Default Monitored Province (0 = Bangkok)
constexpr uint8_t DEFAULT_PROVINCE_INDEX = 0;

// ==============================================================================
// 5. Hardware Pinout Specification (ESP32 DevKit)
// ==============================================================================
// Actuators & Relays
constexpr int PIN_STROBE_RELAY = 2;   // Strobe alarm relay (synced with onboard LED)
constexpr int PIN_DOOR_RELAY = 4;     // Emergency door unlock relay
constexpr int PIN_SIREN_BUZZER = 27;  // Piezo Buzzer / Siren PWM output

// Tri-Color Status Indicator LEDs
constexpr int PIN_LED_NORMAL = 12;    // Green LED (Normal condition)
constexpr int PIN_LED_WARNING = 13;   // Yellow LED (Warning active)
constexpr int PIN_LED_CRITICAL = 14;  // Red LED (Critical disaster active)

// Inputs
constexpr int PIN_BUTTON = 15;        // Push button: Silence alarm / Test mode (Active LOW)
constexpr int PIN_PIEZO_BUZZER = 27;  // Passive/Active Buzzer on GPIO 27
constexpr uint8_t BUZZER_PWM_CHANNEL = 3;

// DFPlayer Mini UART2 Pins
constexpr int PIN_DFPLAYER_RX = 16;   // ESP32 RX2 <- DFPlayer TX
constexpr int PIN_DFPLAYER_TX = 17;   // ESP32 TX2 -> DFPlayer RX (with 1k resistor)

// Local Environmental Sensors (ADC1: Safe with Wi-Fi)
constexpr int PIN_LDR = 34;           // Indoor Ambient Light Sensor (ADC1 CH6)
constexpr int PIN_POT = 35;           // Local Sensitivity Tuning Dial (ADC1 CH7)

// PWM Siren Configuration (ESP32 Core v3.x LEDC)
constexpr int PWM_SIREN_CHANNEL = 0;
constexpr int PWM_SIREN_FREQ_MIN = 800;   // Hz
constexpr int PWM_SIREN_FREQ_MAX = 2400;  // Hz

// Button Timing
constexpr unsigned long BUTTON_DEBOUNCE_MS = 25;
constexpr unsigned long BUTTON_LONG_PRESS_MS = 2000;

// Web Server Port
constexpr uint16_t WEB_SERVER_PORT = 80;

// ==============================================================================
// 6. FreeRTOS Task Matrix Configuration
// ==============================================================================
// Core 0 (Network & Cloud)
constexpr uint32_t TASK_STACK_SIZE_NETWORK   = 8192;
constexpr uint32_t TASK_STACK_SIZE_TELEGRAM  = 6144;
constexpr uint32_t TASK_STACK_SIZE_MQTT      = 4096;
constexpr uint32_t TASK_STACK_SIZE_FIREBASE  = 8192;
constexpr uint32_t TASK_STACK_SIZE_WEBSERVER = 4096;

constexpr UBaseType_t TASK_PRIO_NETWORK   = 2;
constexpr UBaseType_t TASK_PRIO_TELEGRAM  = 1;
constexpr UBaseType_t TASK_PRIO_MQTT      = 2;
constexpr UBaseType_t TASK_PRIO_FIREBASE  = 1;
constexpr UBaseType_t TASK_PRIO_WEBSERVER = 2;

// Core 1 (Hardware, Safety & Hazard Engine)
constexpr uint32_t TASK_STACK_SIZE_HAZARD   = 4096;
constexpr uint32_t TASK_STACK_SIZE_ACTUATOR = 3072;
constexpr uint32_t TASK_STACK_SIZE_INPUT    = 2048;

constexpr UBaseType_t TASK_PRIO_HAZARD   = 4; // Highest Priority
constexpr UBaseType_t TASK_PRIO_ACTUATOR = 3;
constexpr UBaseType_t TASK_PRIO_INPUT    = 3;

#endif // CONFIG_H
