#pragma once

#include <Arduino.h>

class DebouncedButton {
public:
    DebouncedButton(uint8_t pin, uint32_t delayMs)
        : pin_(pin), debounceDelay_(delayMs) {}

    void begin() const { pinMode(pin_, INPUT_PULLUP); }

    bool wasPressed() {
        const uint8_t reading = digitalRead(pin_);
        if (reading != lastReading_) {
            lastDebounceTime_ = millis();
        }

        bool pressed = false;
        if ((millis() - lastDebounceTime_) > debounceDelay_ && reading != stableState_) {
            stableState_ = reading;
            pressed = stableState_ == LOW;
        }
        lastReading_ = reading;
        return pressed;
    }

private:
    uint8_t pin_;
    uint32_t debounceDelay_;
    uint32_t lastDebounceTime_ = 0;
    uint8_t stableState_ = HIGH;
    uint8_t lastReading_ = HIGH;
};
