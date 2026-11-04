// mqtt_service.cpp - Implementation of MQTT Building Automation Protocol
#include "mqtt_service.h"

#include <ArduinoJson.h>
#include "../config.h"
#include "app_state.h"

MqttService::MqttService() : mqttClient_(wifiClient_) {}

void MqttService::begin() {
    mqttClient_.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient_.setCallback(MqttService::onMessageReceived);
    mqttClient_.setBufferSize(1024);
}

bool MqttService::isConnected() {
    return mqttClient_.connected();
}

void MqttService::reconnect() {
    if (mqttClient_.connected()) return;

    if (millis() - lastReconnectAttempt_ < 5000) return;
    lastReconnectAttempt_ = millis();

    char clientId[64];
    snprintf(clientId, sizeof(clientId), "%s_%04X", MQTT_CLIENT_ID, (uint16_t)random(0xFFFF));

    Serial.printf("[MQTT] Connecting to %s:%d as %s...\n", MQTT_BROKER, MQTT_PORT, clientId);
    if (mqttClient_.connect(clientId)) {
        Serial.println("[MQTT] Connected successfully!");
        mqttClient_.subscribe(MQTT_TOPIC_COMMAND_SUB);

        if (lockState()) {
            g_state.mqttConnected = true;
            unlockState();
        }
    } else {
        Serial.printf("[MQTT] Connection failed, rc=%d. Retrying in 5s\n", mqttClient_.state());
        if (lockState()) {
            g_state.mqttConnected = false;
            unlockState();
        }
    }
}

void MqttService::loop() {
    if (!mqttClient_.connected()) {
        reconnect();
    } else {
        mqttClient_.loop();
    }
}

void MqttService::publishAlertState(AlertSeverity severity) {
    if (!mqttClient_.connected()) return;

    if (severity == AlertSeverity::CRITICAL) {
        mqttClient_.publish(MQTT_TOPIC_ALARM, "ON", true);
        mqttClient_.publish(MQTT_TOPIC_DOOR, "UNLOCK", true);
        Serial.println("[MQTT] Broadcast CRITICAL -> Alarm ON, Doors UNLOCKED");
    } else if (severity == AlertSeverity::WARNING) {
        mqttClient_.publish(MQTT_TOPIC_ALARM, "ON", true);
        mqttClient_.publish(MQTT_TOPIC_DOOR, "LOCKED", true);
        Serial.println("[MQTT] Broadcast WARNING -> Alarm ON, Doors LOCKED");
    } else {
        mqttClient_.publish(MQTT_TOPIC_ALARM, "OFF", true);
        mqttClient_.publish(MQTT_TOPIC_DOOR, "LOCKED", true);
        Serial.println("[MQTT] Broadcast NORMAL -> Alarm OFF, Doors LOCKED");
    }
}

void MqttService::publishTelemetry(const WeatherSnapshot& s, AlertSeverity highestSeverity) {
    if (!mqttClient_.connected() || !s.valid) return;

    JsonDocument doc;
    doc["province"] = s.provinceEn;
    doc["temperature"] = s.temperature;
    doc["apparent_temp"] = s.apparentTemperature;
    doc["humidity"] = s.humidity;
    doc["uv_index"] = s.uvIndex;
    doc["wind_speed_kmh"] = s.windSpeed;
    doc["wind_gusts_kmh"] = s.windGusts;
    doc["precipitation_mm"] = s.precipitation;
    doc["weather_code"] = s.weatherCode;
    doc["river_discharge_m3s"] = s.riverDischarge;
    doc["severity"] = severityToString(highestSeverity);
    doc["device_id"] = DEVICE_ID;
    doc["uptime_sec"] = millis() / 1000;

    char buffer[512];
    serializeJson(doc, buffer, sizeof(buffer));
    mqttClient_.publish(MQTT_TOPIC_TELEMETRY, buffer);
}

void MqttService::publishCustom(const char* topic, const char* payload, bool retain) {
    if (!mqttClient_.connected() || !topic || !payload) return;
    mqttClient_.publish(topic, payload, retain);
}

void MqttService::onMessageReceived(char* topic, byte* payload, unsigned int length) {
    char message[128];
    const unsigned int copyLen = (length < sizeof(message) - 1) ? length : (sizeof(message) - 1);
    memcpy(message, payload, copyLen);
    message[copyLen] = '\0';

    Serial.printf("[MQTT RECV] %s -> %s\n", topic, message);

    if (strstr(topic, "command/strobe") != nullptr) {
        if (lockState()) {
            g_state.strobeState = (strcasecmp(message, "ON") == 0 || strcasecmp(message, "1") == 0);
            unlockState();
        }
    } else if (strstr(topic, "command/door") != nullptr) {
        if (lockState()) {
            g_state.doorUnlocked = (strcasecmp(message, "UNLOCK") == 0 || strcasecmp(message, "1") == 0);
            unlockState();
        }
    } else if (strstr(topic, "command/test") != nullptr) {
        if (lockState()) {
            g_state.testMode = true;
            unlockState();
        }
    } else if (strstr(topic, "command/silence") != nullptr) {
        if (lockState()) {
            g_state.silenceRequested = true;
            unlockState();
        }
    } else if (strstr(topic, "command/province") != nullptr) {
        const ProvinceInfo* p = findProvinceByName(message);
        if (lockState()) {
            for (size_t i = 0; i < TOTAL_PROVINCES; ++i) {
                if (&PROVINCES[i] == p) {
                    g_state.provinceIndex = static_cast<uint8_t>(i);
                    break;
                }
            }
            unlockState();
        }
    }
}
