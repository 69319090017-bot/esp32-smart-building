// actuator_service.h - Hardware Relay Control, Status LEDs, and Button Debounce
#pragma once

#include <Arduino.h>
#include "weather_types.h"

class ActuatorService {
public:
    ActuatorService();

    void begin();
    void update(AlertSeverity severity, bool manualStrobe, bool manualDoor, bool testMode, bool silence);

    // Button event checks
    bool checkButtonShortPress();
    bool checkButtonLongPress();

    // Sensor readings
    uint32_t readIndoorLight();
    int32_t readSensitivityPot();

private:
    uint32_t lastBlinkMillis_ = 0;
    bool blinkState_ = false;

    // Button debounce state
    int lastButtonReading_ = HIGH;
    int buttonState_ = HIGH;
    uint32_t lastDebounceTime_ = 0;
    uint32_t buttonPressStartTime_ = 0;
    bool shortPressDetected_ = false;
    bool longPressDetected_ = false;
    bool longPressHandled_ = false;
};
