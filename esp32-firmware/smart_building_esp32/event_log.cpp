// event_log.cpp - Implementation of LittleFS History Logger
#include "event_log.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

namespace {
constexpr const char* CSV_PATH = "/history.csv";
constexpr const char* ALERTS_PATH = "/alerts.ndjson";
constexpr size_t MAX_LOG_BYTES = 64 * 1024; // 64 KB per log file to prevent flash exhaustion
}

bool beginEventLog() {
    if (!LittleFS.begin(true)) {
        Serial.println("[STORAGE] LittleFS mount failed");
        return false;
    }

    if (!LittleFS.exists(CSV_PATH)) {
        File file = LittleFS.open(CSV_PATH, FILE_WRITE);
        if (file) {
            file.println("timestamp,province,temperature,apparent_temp,uv_index,gust_kmh,rain_mm,weather_code,river_discharge,severity");
            file.close();
        }
    }
    return true;
}

static void rotateIfNeeded(const char* path) {
    if (!LittleFS.exists(path)) return;
    File f = LittleFS.open(path, FILE_READ);
    if (!f) return;
    const size_t sz = f.size();
    f.close();

    if (sz > MAX_LOG_BYTES) {
        char oldPath[32];
        snprintf(oldPath, sizeof(oldPath), "%s.old", path);
        LittleFS.remove(oldPath);
        LittleFS.rename(path, oldPath);
        Serial.printf("[STORAGE] Rotated log file: %s\n", path);
    }
}

bool logWeatherReading(const WeatherSnapshot& s, AlertSeverity severity) {
    if (!s.valid) return false;
    rotateIfNeeded(CSV_PATH);

    File file = LittleFS.open(CSV_PATH, FILE_APPEND);
    if (!file) return false;

    file.printf("%lu,%s,%.1f,%.1f,%.1f,%.1f,%.1f,%d,%.1f,%s\n",
                static_cast<unsigned long>(s.lastFetchEpoch),
                s.provinceEn, s.temperature, s.apparentTemperature,
                s.uvIndex, s.windGusts, s.precipitation,
                s.weatherCode, s.riverDischarge, severityToString(severity));
    file.close();
    return true;
}

bool logAlertEvent(const AlertPayload& alert) {
    rotateIfNeeded(ALERTS_PATH);

    File file = LittleFS.open(ALERTS_PATH, FILE_APPEND);
    if (!file) return false;

    JsonDocument doc;
    doc["id"] = alert.alertId;
    doc["kind"] = hazardKindToString(alert.kind);
    doc["severity"] = severityToString(alert.severity);
    doc["province"] = alert.province;
    doc["message"] = alert.message;
    doc["timestamp"] = alert.timestamp;

    String line;
    serializeJson(doc, line);
    file.println(line);
    file.close();
    return true;
}

String getRecentAlertsJson() {
    if (!LittleFS.exists(ALERTS_PATH)) {
        return "[]";
    }

    File file = LittleFS.open(ALERTS_PATH, FILE_READ);
    if (!file) return "[]";

    JsonDocument arrayDoc;
    JsonArray arr = arrayDoc.to<JsonArray>();

    while (file.available()) {
        String line = file.readStringUntil('\n');
        line.trim();
        if (line.isEmpty()) continue;

        JsonDocument lineDoc;
        if (!deserializeJson(lineDoc, line)) {
            arr.add(lineDoc);
        }
    }
    file.close();

    String result;
    serializeJson(arrayDoc, result);
    return result;
}

String getRecentWeatherCsv() {
    if (!LittleFS.exists(CSV_PATH)) {
        return "No history available";
    }

    File file = LittleFS.open(CSV_PATH, FILE_READ);
    if (!file) return "";

    String content = file.readString();
    file.close();
    return content;
}
