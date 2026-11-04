// weather_service.h - Open-Meteo Weather & Flood API HTTPS Client
#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "weather_types.h"
#include "provinces.h"

class WeatherService {
public:
    WeatherService();
    ~WeatherService();

    // Fetches live weather & flood data for the specified province
    bool fetch(const ProvinceInfo* province, WeatherSnapshot& outSnapshot);

private:
    WiFiClientSecure secureClient_;
    HTTPClient http_;

    bool fetchForecast(float lat, float lon, WeatherSnapshot& snapshot);
    bool fetchFlood(float lat, float lon, WeatherSnapshot& snapshot);
};
