// wifi_manager.h - Wi-Fi Connection & Auto-Recovery Manager
#pragma once

#include <Arduino.h>

void beginWiFi();
void checkWiFiHealth();
bool isWiFiConnected();
