// audio_service.h - Digital Audio Alerts (DFPlayer Mini UART & LEDC PWM Siren)
#pragma once

#include <Arduino.h>
#include "weather_types.h"

class AudioService {
public:
    AudioService();

    void begin();
    void update(AlertSeverity severity, bool silenceRequested);
    void playTrack(uint16_t trackNumber);
    void playSiren();
    void stop();

private:
    bool dfPlayerAvailable_ = false;
    bool isSirenPlaying_ = false;
    uint32_t lastToneStepMillis_ = 0;
    int currentFreq_ = 1000;
    int freqStep_ = 50;
};
