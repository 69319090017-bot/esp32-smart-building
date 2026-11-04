// event_log.h - LittleFS Circular Storage for Weather & Alert History
#pragma once

#include <Arduino.h>
#include "weather_types.h"

bool beginEventLog();
bool logWeatherReading(const WeatherSnapshot& snapshot, AlertSeverity severity);
bool logAlertEvent(const AlertPayload& alert);
String getRecentAlertsJson();
String getRecentWeatherCsv();
