#pragma once

#include <Arduino.h>

#include "../config.h"

// Arduino-ESP32 2.x requires a channel; 3.x attaches PWM directly to a pin.
// Keeping this compatibility shim makes the project build in both Arduino IDE
// Core 3.x and the stable PlatformIO Arduino framework.
inline void beginPwmOutput() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(LED_PIN, PWM_FREQ, PWM_RESOLUTION);
#else
    ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(LED_PIN, PWM_CHANNEL);
#endif
}

inline void writePwmOutput(uint32_t duty) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(LED_PIN, duty);
#else
    ledcWrite(PWM_CHANNEL, duty);
#endif
}
