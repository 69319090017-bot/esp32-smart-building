#pragma once

#include <Arduino.h>

struct EventRecord {
    char id[40];
    char type[24];
    char severity[12];
    float distanceCm;
    uint32_t lightLevel;
    uint64_t timestamp;
};

bool beginEventLog();
bool queueEvent(const EventRecord& event);
bool getPendingEvent(EventRecord& event);
bool acknowledgeEvent(const char* eventId);
String recentEventsJson();
