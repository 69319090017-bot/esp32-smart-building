// weather_service.cpp - Implementation of Open-Meteo REST API Client
#include "weather_service.h"

#include <ArduinoJson.h>
#include "../config.h"

WeatherService::WeatherService() {
    secureClient_.setInsecure(); // Open-Meteo uses public trusted CA certificates
    http_.setReuse(true);
}

WeatherService::~WeatherService() {
    http_.end();
    secureClient_.stop();
}

bool WeatherService::fetch(const ProvinceInfo* province, WeatherSnapshot& outSnapshot) {
    if (!province) return false;

    const uint32_t startTime = millis();
    WeatherSnapshot snapshot{};
    snprintf(snapshot.province, sizeof(snapshot.province), "%s", province->nameTh);
    snprintf(snapshot.provinceEn, sizeof(snapshot.provinceEn), "%s", province->nameEn);
    snapshot.latitude = province->lat;
    snapshot.longitude = province->lon;

    const bool forecastOk = fetchForecast(province->lat, province->lon, snapshot);
    if (!forecastOk) {
        Serial.printf("[WEATHER] Failed to fetch forecast for %s\n", province->nameEn);
        return false;
    }

    // Flood API (Optional: will not fail the whole fetch if unavailable)
    fetchFlood(province->lat, province->lon, snapshot);

    snapshot.valid = true;
    snapshot.fetchDurationMs = millis() - startTime;
    snapshot.lastFetchEpoch = static_cast<uint32_t>(millis() / 1000);

    outSnapshot = snapshot;
    Serial.printf("[WEATHER] %s: Temp=%.1f°C, Apparent=%.1f°C, UV=%.1f, Gust=%.1f km/h, Rain=%.1f mm (Took %lu ms)\n",
                  snapshot.provinceEn, snapshot.temperature, snapshot.apparentTemperature,
                  snapshot.uvIndex, snapshot.windGusts, snapshot.precipitation,
                  static_cast<unsigned long>(snapshot.fetchDurationMs));
    return true;
}

bool WeatherService::fetchForecast(float lat, float lon, WeatherSnapshot& snapshot) {
    char url[320];
    snprintf(url, sizeof(url),
             "%s?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%%2FBangkok",
             OPEN_METEO_FORECAST_URL, lat, lon);

    if (!http_.begin(secureClient_, url)) {
        return false;
    }
    http_.setTimeout(HTTP_TIMEOUT_MS);
    http_.setUserAgent("ESP32-SmartBuilding/4.0");

    const int httpCode = http_.GET();
    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("[WEATHER] HTTP GET Forecast failed: %d\n", httpCode);
        http_.end();
        return false;
    }

    WiFiClient* stream = http_.getStreamPtr();
    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, *stream);
    http_.end();

    if (err) {
        Serial.printf("[WEATHER] JSON deserialize failed: %s\n", err.c_str());
        return false;
    }

    JsonObject current = doc["current"];
    if (current.isNull()) {
        Serial.println("[WEATHER] 'current' object missing in JSON");
        return false;
    }

    if (current["time"].is<const char*>()) {
        snprintf(snapshot.observedAt, sizeof(snapshot.observedAt), "%s", current["time"].as<const char*>());
    }
    snapshot.temperature = current["temperature_2m"] | 0.0f;
    snapshot.apparentTemperature = current["apparent_temperature"] | snapshot.temperature;
    snapshot.humidity = current["relative_humidity_2m"] | 0.0f;
    snapshot.uvIndex = current["uv_index"] | 0.0f;
    snapshot.windSpeed = current["wind_speed_10m"] | 0.0f;
    snapshot.windGusts = current["wind_gusts_10m"] | snapshot.windSpeed;
    snapshot.precipitation = current["precipitation"] | 0.0f;
    snapshot.weatherCode = current["weather_code"] | 0;

    return true;
}

bool WeatherService::fetchFlood(float lat, float lon, WeatherSnapshot& snapshot) {
    char url[256];
    snprintf(url, sizeof(url),
             "%s?latitude=%.4f&longitude=%.4f&daily=river_discharge&forecast_days=1",
             OPEN_METEO_FLOOD_URL, lat, lon);

    if (!http_.begin(secureClient_, url)) {
        return false;
    }
    http_.setTimeout(HTTP_TIMEOUT_MS);
    http_.setUserAgent("ESP32-SmartBuilding/4.0");

    const int httpCode = http_.GET();
    if (httpCode != HTTP_CODE_OK) {
        http_.end();
        return false;
    }

    WiFiClient* stream = http_.getStreamPtr();
    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, *stream);
    http_.end();

    if (err) {
        return false;
    }

    JsonArray riverSeries = doc["daily"]["river_discharge"];
    if (!riverSeries.isNull() && riverSeries.size() > 0) {
        snapshot.riverDischarge = riverSeries[0] | 0.0f;
    }

    return true;
}
