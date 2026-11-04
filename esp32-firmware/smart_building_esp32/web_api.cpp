// web_api.cpp - Implementation of AsyncWebServer & REST/WebSocket Endpoints
#include "web_api.h"

#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

#include "../config.h"
#include "app_state.h"
#include "event_log.h"
#include "provinces.h"

namespace {
AsyncWebServer server(WEB_SERVER_PORT);
AsyncWebSocket ws("/ws");

void sendJson(AsyncWebServerRequest* request, JsonDocument& doc, int status = 200) {
    String body;
    serializeJson(doc, body);
    AsyncWebServerResponse* resp = request->beginResponse(status, "application/json", body);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Cache-Control", "no-store");
    request->send(resp);
}

void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.printf("[WS] Client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
        // Send initial state immediately
        broadcastWsUpdate();
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.printf("[WS] Client #%u disconnected\n", client->id());
    }
}
}

void broadcastWsUpdate() {
    if (ws.count() == 0) return;

    JsonDocument doc;
    if (lockState()) {
        doc["province"] = g_state.weather.province;
        doc["province_en"] = g_state.weather.provinceEn;
        doc["temperature"] = g_state.weather.temperature;
        doc["apparent_temp"] = g_state.weather.apparentTemperature;
        doc["humidity"] = g_state.weather.humidity;
        doc["uv_index"] = g_state.weather.uvIndex;
        doc["wind_speed_kmh"] = g_state.weather.windSpeed;
        doc["wind_gusts_kmh"] = g_state.weather.windGusts;
        doc["precipitation_mm"] = g_state.weather.precipitation;
        doc["weather_code"] = g_state.weather.weatherCode;
        doc["weather_desc"] = getWmoDescriptionThai(g_state.weather.weatherCode);
        doc["river_discharge_m3s"] = g_state.weather.riverDischarge;
        doc["severity"] = severityToString(g_state.highestSeverity);
        doc["strobe"] = g_state.strobeState;
        doc["door_unlocked"] = g_state.doorUnlocked;
        doc["siren"] = g_state.sirenActive;
        doc["test_mode"] = g_state.testMode;
        doc["uptime_sec"] = millis() / 1000;
        doc["heap_free"] = ESP.getFreeHeap();
        unlockState();
    }

    String msg;
    serializeJson(doc, msg);
    ws.textAll(msg);
}

void beginWebApi() {
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    // Serve Local Dashboard HTML from LittleFS
    server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (LittleFS.exists("/index.html")) {
            request->send(LittleFS, "/index.html", "text/html; charset=utf-8");
        } else {
            request->send(200, "text/html; charset=utf-8",
                          "<!DOCTYPE html><html><head><meta charset='utf-8'><title>ESP32 Command Center</title></head>"
                          "<body style='background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;padding:50px;'>"
                          "<h1>🏢 ESP32 Smart Building Command Center 2026</h1>"
                          "<p>API is active. Please upload <code>data/index.html</code> to LittleFS.</p>"
                          "<p><a href='/api/weather' style='color:#06b6d4;'>View Weather API</a> | <a href='/api/status' style='color:#10b981;'>View Status API</a></p>"
                          "</body></html>");
        }
    });

    server.serveStatic("/", LittleFS, "/").setCacheControl("max-age=3600");

    // 1. Weather Snapshot API
    server.on("/api/weather", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!lockState()) {
            request->send(503, "application/json", "{\"error\":\"state locked\"}");
            return;
        }
        doc["province"] = g_state.weather.province;
        doc["province_en"] = g_state.weather.provinceEn;
        doc["lat"] = g_state.weather.latitude;
        doc["lon"] = g_state.weather.longitude;
        doc["temperature"] = g_state.weather.temperature;
        doc["apparent_temp"] = g_state.weather.apparentTemperature;
        doc["humidity"] = g_state.weather.humidity;
        doc["uv_index"] = g_state.weather.uvIndex;
        doc["wind_speed_kmh"] = g_state.weather.windSpeed;
        doc["wind_gusts_kmh"] = g_state.weather.windGusts;
        doc["precipitation_mm"] = g_state.weather.precipitation;
        doc["weather_code"] = g_state.weather.weatherCode;
        doc["weather_desc"] = getWmoDescriptionThai(g_state.weather.weatherCode);
        doc["river_discharge_m3s"] = g_state.weather.riverDischarge;
        doc["severity"] = severityToString(g_state.highestSeverity);
        doc["fetch_duration_ms"] = g_state.weather.fetchDurationMs;
        doc["valid"] = g_state.weather.valid;
        doc["timestamp"] = epochMillis();
        unlockState();
        sendJson(request, doc);
    });

    // 2. Active Disaster Alerts API
    server.on("/api/alerts", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!lockState()) {
            request->send(503, "application/json", "{\"error\":\"state locked\"}");
            return;
        }
        doc["highest_severity"] = severityToString(g_state.highestSeverity);
        JsonArray activeArr = doc["active"].to<JsonArray>();
        for (size_t i = 0; i < g_state.activeAlertsCount; ++i) {
            JsonObject a = activeArr.add<JsonObject>();
            a["id"] = g_state.activeAlerts[i].alertId;
            a["kind"] = hazardKindToString(g_state.activeAlerts[i].kind);
            a["severity"] = severityToString(g_state.activeAlerts[i].severity);
            a["message"] = g_state.activeAlerts[i].message;
            a["timestamp"] = g_state.activeAlerts[i].timestamp;
        }
        unlockState();
        sendJson(request, doc);
    });

    // 3. 77 Provinces Database API
    server.on("/api/provinces", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        JsonArray arr = doc.to<JsonArray>();
        for (size_t i = 0; i < TOTAL_PROVINCES; ++i) {
            JsonObject p = arr.add<JsonObject>();
            p["index"] = i;
            p["name_th"] = PROVINCES[i].nameTh;
            p["name_en"] = PROVINCES[i].nameEn;
            p["lat"] = PROVINCES[i].lat;
            p["lon"] = PROVINCES[i].lon;
        }
        sendJson(request, doc);
    });

    // 4. System Status API
    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!lockState()) {
            request->send(503, "application/json", "{\"error\":\"state locked\"}");
            return;
        }
        doc["device_id"] = DEVICE_ID;
        doc["firmware_version"] = FIRMWARE_VERSION;
        doc["wifi_connected"] = g_state.wifiConnected;
        doc["mqtt_connected"] = g_state.mqttConnected;
        doc["firebase_connected"] = g_state.firebaseConnected;
        doc["strobe_active"] = g_state.strobeState;
        doc["door_unlocked"] = g_state.doorUnlocked;
        doc["siren_active"] = g_state.sirenActive;
        doc["test_mode"] = g_state.testMode;
        doc["indoor_light"] = g_state.indoorLightLevel;
        doc["uptime_sec"] = millis() / 1000;
        doc["free_heap"] = ESP.getFreeHeap();
        doc["last_error"] = g_state.lastError;
        unlockState();
        sendJson(request, doc);
    });

    // 5. Change Monitored Province
    server.on("/api/set_province", HTTP_POST, [](AsyncWebServerRequest* request) {
        bool changed = false;
        if (request->hasParam("name", true)) {
            String name = request->getParam("name", true)->value();
            const ProvinceInfo* p = findProvinceByName(name.c_str());
            if (lockState()) {
                for (size_t i = 0; i < TOTAL_PROVINCES; ++i) {
                    if (&PROVINCES[i] == p) {
                        g_state.provinceIndex = static_cast<uint8_t>(i);
                        changed = true;
                        break;
                    }
                }
                unlockState();
            }
        } else if (request->hasParam("index", true)) {
            int idx = request->getParam("index", true)->value().toInt();
            if (idx >= 0 && idx < static_cast<int>(TOTAL_PROVINCES)) {
                if (lockState()) {
                    g_state.provinceIndex = static_cast<uint8_t>(idx);
                    changed = true;
                    unlockState();
                }
            }
        }

        if (changed) {
            request->send(200, "application/json", "{\"status\":\"ok\",\"message\":\"Province updated\"}");
        } else {
            request->send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid province\"}");
        }
    });

    // 6. Test Alarm Mode Toggle
    server.on("/api/test_alarm", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (lockState()) {
            g_state.testMode = !g_state.testMode;
            unlockState();
        }
        request->send(200, "application/json", "{\"status\":\"ok\",\"test_mode\":true}");
    });

    // 7. Silence Alarm
    server.on("/api/silence", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (lockState()) {
            g_state.silenceRequested = true;
            g_state.testMode = false;
            unlockState();
        }
        request->send(200, "application/json", "{\"status\":\"ok\",\"silence\":true}");
    });

    // 8. Download History CSV
    server.on("/api/history.csv", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (LittleFS.exists("/history.csv")) {
            request->send(LittleFS, "/history.csv", "text/csv");
        } else {
            request->send(404, "text/plain", "History not found");
        }
    });

    server.onNotFound([](AsyncWebServerRequest* request) {
        request->send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
    });

    server.begin();
    Serial.println("[WEB] Async Web Server & WebSockets started on port 80");
}
