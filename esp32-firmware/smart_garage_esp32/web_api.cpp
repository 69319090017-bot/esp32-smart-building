#include "web_api.h"

#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

#include "../config.h"
#include "app_state.h"
#include "event_log.h"

namespace {
AsyncWebServer server(WEB_SERVER_PORT);

void sendJson(AsyncWebServerRequest* request, JsonDocument& document) {
    String body;
    serializeJson(document, body);
    AsyncWebServerResponse* response = request->beginResponse(200, "application/json", body);
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
}
} // namespace

void beginWebApi() {
    server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
        request->send(LittleFS, "/index.html", "text/html");
    });
    server.serveStatic("/", LittleFS, "/").setCacheControl("max-age=3600");

    server.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!lockState()) {
            request->send(503, "application/json", "{\"error\":\"state busy\"}");
            return;
        }
        doc["distance_cm"] = g_state.distanceCm;
        doc["light_level"] = g_state.lightLevel;
        doc["led_state"] = g_state.ledState;
        doc["pot_threshold_cm"] = g_state.localPotThreshold;
        doc["timestamp"] = epochMillis();
        unlockState();
        sendJson(request, doc);
    });

    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!lockState()) {
            request->send(503, "application/json", "{\"error\":\"state busy\"}");
            return;
        }
        doc["device_id"] = DEVICE_ID;
        doc["firmware_version"] = FIRMWARE_VERSION;
        doc["wifi_connected"] = g_state.wifiConnected;
        doc["firebase_connected"] = g_state.firebaseConnected;
        doc["armed"] = g_state.armed;
        doc["maintenance_mode"] = g_state.maintenanceMode;
        doc["last_http_status"] = g_state.lastHttpStatus;
        doc["last_error"] = g_state.lastError;
        unlockState();
        sendJson(request, doc);
    });

    // The local API intentionally exposes no unauthenticated mutation endpoint.
    // Remote commands flow through Firebase Auth + Database Rules instead.
    server.on("/api/events", HTTP_GET, [](AsyncWebServerRequest* request) {
        AsyncWebServerResponse* response = request->beginResponse(200, "application/json", recentEventsJson());
        response->addHeader("Cache-Control", "no-store");
        request->send(response);
    });

    server.onNotFound([](AsyncWebServerRequest* request) {
        request->send(404, "application/json", "{\"error\":\"not found\"}");
    });
    server.begin();
    Serial.println("[WEB] Local read-only API started");
}
