// actuator_service.cpp - Implementation of Actuators & Relays
#include "actuator_service.h"
#include "../config.h"

ActuatorService::ActuatorService() {}

void ActuatorService::begin() {
    // Relays
    pinMode(PIN_STROBE_RELAY, OUTPUT);
    digitalWrite(PIN_STROBE_RELAY, LOW);

    pinMode(PIN_DOOR_RELAY, OUTPUT);
    digitalWrite(PIN_DOOR_RELAY, LOW);

    // Tri-color LEDs
    pinMode(PIN_LED_NORMAL, OUTPUT);
    pinMode(PIN_LED_WARNING, OUTPUT);
    pinMode(PIN_LED_CRITICAL, OUTPUT);

    digitalWrite(PIN_LED_NORMAL, HIGH);
    digitalWrite(PIN_LED_WARNING, LOW);
    digitalWrite(PIN_LED_CRITICAL, LOW);

    // Push button with internal pullup
    pinMode(PIN_BUTTON, INPUT_PULLUP);

    // Analog sensors (ADC1)
    pinMode(PIN_LDR, INPUT);
    pinMode(PIN_POT, INPUT);

    Serial.println("[ACTUATOR] Hardware GPIO and Relays initialized");
}

void ActuatorService::update(AlertSeverity severity, bool manualStrobe, bool manualDoor, bool testMode, bool silence) {
    const uint32_t now = millis();

    // Blink timer (150ms for critical, 500ms for warning)
    const uint32_t blinkInterval = (severity == AlertSeverity::CRITICAL || testMode) ? 150 : 500;
    if (now - lastBlinkMillis_ >= blinkInterval) {
        lastBlinkMillis_ = now;
        blinkState_ = !blinkState_;
    }

    // 1. Strobe Relay (GPIO 2)
    const bool strobeActive = (severity == AlertSeverity::CRITICAL || severity == AlertSeverity::WARNING ||
                               testMode || manualStrobe);
    if (strobeActive) {
        digitalWrite(PIN_STROBE_RELAY, blinkState_ ? HIGH : LOW);
    } else {
        digitalWrite(PIN_STROBE_RELAY, LOW);
    }

    // 2. Emergency Doors Relay (GPIO 4)
    const bool doorActive = (severity == AlertSeverity::CRITICAL || testMode || manualDoor);
    digitalWrite(PIN_DOOR_RELAY, doorActive ? HIGH : LOW);

    // 3. Tri-Color Status LEDs
    if (testMode || severity == AlertSeverity::CRITICAL) {
        digitalWrite(PIN_LED_NORMAL, LOW);
        digitalWrite(PIN_LED_WARNING, LOW);
        digitalWrite(PIN_LED_CRITICAL, blinkState_ ? HIGH : LOW);
    } else if (severity == AlertSeverity::WARNING) {
        digitalWrite(PIN_LED_NORMAL, LOW);
        digitalWrite(PIN_LED_WARNING, blinkState_ ? HIGH : LOW);
        digitalWrite(PIN_LED_CRITICAL, LOW);
    } else {
        digitalWrite(PIN_LED_NORMAL, HIGH);
        digitalWrite(PIN_LED_WARNING, LOW);
        digitalWrite(PIN_LED_CRITICAL, LOW);
    }

    // 4. Button Debouncing & Event Handling
    const int reading = digitalRead(PIN_BUTTON);
    if (reading != lastButtonReading_) {
        lastDebounceTime_ = now;
    }
    if ((now - lastDebounceTime_) > BUTTON_DEBOUNCE_MS) {
        if (reading != buttonState_) {
            buttonState_ = reading;
            if (buttonState_ == LOW) { // Button Pressed
                buttonPressStartTime_ = now;
                longPressHandled_ = false;
            } else { // Button Released
                const uint32_t pressDuration = now - buttonPressStartTime_;
                if (pressDuration < BUTTON_LONG_PRESS_MS && !longPressHandled_) {
                    shortPressDetected_ = true;
                }
            }
        } else if (buttonState_ == LOW && !longPressHandled_) {
            if ((now - buttonPressStartTime_) >= BUTTON_LONG_PRESS_MS) {
                longPressDetected_ = true;
                longPressHandled_ = true;
            }
        }
    }
    lastButtonReading_ = reading;
}

bool ActuatorService::checkButtonShortPress() {
    if (shortPressDetected_) {
        shortPressDetected_ = false;
        return true;
    }
    return false;
}

bool ActuatorService::checkButtonLongPress() {
    if (longPressDetected_) {
        longPressDetected_ = false;
        return true;
    }
    return false;
}

uint32_t ActuatorService::readIndoorLight() {
    return analogRead(PIN_LDR);
}

int32_t ActuatorService::readSensitivityPot() {
    return map(analogRead(PIN_POT), 0, 4095, 0, 100);
}
