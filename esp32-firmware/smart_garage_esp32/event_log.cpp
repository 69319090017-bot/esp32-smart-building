#include "event_log.h"

#include <ArduinoJson.h>
#include <LittleFS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace {
constexpr const char* kEventLogPath = "/events.ndjson";
constexpr const char* kPendingPath = "/pending-events.ndjson";
constexpr const char* kPendingTempPath = "/pending-events.tmp";
SemaphoreHandle_t eventLogMutex = nullptr;

bool lockLog() {
    return eventLogMutex != nullptr && xSemaphoreTake(eventLogMutex, pdMS_TO_TICKS(250)) == pdTRUE;
}

void unlockLog() {
    if (eventLogMutex != nullptr) xSemaphoreGive(eventLogMutex);
}

void writeRecord(File& file, const EventRecord& event) {
    JsonDocument doc;
    doc["id"] = event.id;
    doc["event_type"] = event.type;
    doc["severity"] = event.severity;
    doc["distance_cm"] = event.distanceCm;
    doc["light_level"] = event.lightLevel;
    doc["timestamp"] = event.timestamp;
    serializeJson(doc, file);
    file.print('\n');
}

bool parseRecord(const String& line, EventRecord& event) {
    JsonDocument doc;
    if (deserializeJson(doc, line)) return false;
    snprintf(event.id, sizeof(event.id), "%s", doc["id"] | "");
    snprintf(event.type, sizeof(event.type), "%s", doc["event_type"] | "unknown");
    snprintf(event.severity, sizeof(event.severity), "%s", doc["severity"] | "info");
    event.distanceCm = doc["distance_cm"] | -1.0F;
    event.lightLevel = doc["light_level"] | 0U;
    event.timestamp = doc["timestamp"] | 0ULL;
    return event.id[0] != '\0';
}
} // namespace

bool beginEventLog() {
    eventLogMutex = xSemaphoreCreateMutex();
    return eventLogMutex != nullptr;
}

bool queueEvent(const EventRecord& event) {
    if (!lockLog()) return false;
    File history = LittleFS.open(kEventLogPath, FILE_APPEND);
    File pending = LittleFS.open(kPendingPath, FILE_APPEND);
    const bool ok = history && pending;
    if (ok) {
        writeRecord(history, event);
        writeRecord(pending, event);
    }
    if (history) history.close();
    if (pending) pending.close();
    unlockLog();
    return ok;
}

bool getPendingEvent(EventRecord& event) {
    if (!lockLog()) return false;
    File pending = LittleFS.open(kPendingPath, FILE_READ);
    const String line = pending ? pending.readStringUntil('\n') : String();
    if (pending) pending.close();
    unlockLog();
    return parseRecord(line, event);
}

bool acknowledgeEvent(const char* eventId) {
    if (eventId == nullptr || !lockLog()) return false;
    File input = LittleFS.open(kPendingPath, FILE_READ);
    File output = LittleFS.open(kPendingTempPath, FILE_WRITE);
    bool removed = false;
    if (!input || !output) {
        if (input) input.close();
        if (output) output.close();
        unlockLog();
        return false;
    }
    while (input.available()) {
        const String line = input.readStringUntil('\n');
        EventRecord item{};
        if (!removed && parseRecord(line, item) && strcmp(item.id, eventId) == 0) {
            removed = true;
            continue;
        }
        if (!line.isEmpty()) output.println(line);
    }
    input.close();
    output.close();
    if (removed) {
        LittleFS.remove(kPendingPath);
        LittleFS.rename(kPendingTempPath, kPendingPath);
    } else {
        LittleFS.remove(kPendingTempPath);
    }
    unlockLog();
    return removed;
}

String recentEventsJson() {
    if (!lockLog()) return "[]";
    File history = LittleFS.open(kEventLogPath, FILE_READ);
    String lines[20];
    size_t count = 0;
    while (history && history.available()) {
        const String line = history.readStringUntil('\n');
        if (!line.isEmpty()) lines[count++ % 20] = line;
    }
    if (history) history.close();
    String result = "[";
    const size_t start = count > 20 ? count - 20 : 0;
    for (size_t i = start; i < count; ++i) {
        if (i > start) result += ',';
        result += lines[i % 20];
    }
    result += ']';
    unlockLog();
    return result;
}
