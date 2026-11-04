// mqtt_service.h - MQTT Protocol Client for Building Automation
#pragma once

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClient.h>

#include "weather_types.h"

class MqttService {
public:
    MqttService();

    void begin();
    void loop();

    bool isConnected();
    void publishAlertState(AlertSeverity severity);
    void publishTelemetry(const WeatherSnapshot& snapshot, AlertSeverity highestSeverity);
    void publishCustom(const char* topic, const char* payload, bool retain = false);

private:
    WiFiClient wifiClient_;
    PubSubClient mqttClient_;
    uint32_t lastReconnectAttempt_ = 0;

    void reconnect();
    static void onMessageReceived(char* topic, byte* payload, unsigned int length);
};
