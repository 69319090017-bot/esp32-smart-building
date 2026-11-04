// audio_service.cpp - Implementation of Audio Alerts
#include "audio_service.h"
#include "../config.h"

#include <DFRobotDFPlayerMini.h>

namespace {
HardwareSerial dfSerial(2);
DFRobotDFPlayerMini dfPlayer;
}

AudioService::AudioService() {}

void AudioService::begin() {
    // 1. Initialize LEDC PWM for Piezo Buzzer / Siren
    #if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(PIN_SIREN_BUZZER, PWM_SIREN_FREQ_MIN, 8);
    ledcWrite(PIN_SIREN_BUZZER, 0);
    #else
    ledcSetup(PWM_SIREN_CHANNEL, PWM_SIREN_FREQ_MIN, 8);
    ledcAttachPin(PIN_SIREN_BUZZER, PWM_SIREN_CHANNEL);
    ledcWrite(PWM_SIREN_CHANNEL, 0);
    #endif

    // 2. Initialize DFPlayer Mini UART2 (9600 baud, 8N1)
    dfSerial.begin(9600, SERIAL_8N1, PIN_DFPLAYER_RX, PIN_DFPLAYER_TX);
    delay(100);

    if (dfPlayer.begin(dfSerial, false, false)) {
        dfPlayerAvailable_ = true;
        dfPlayer.volume(25); // Volume 0-30
        Serial.println("[AUDIO] DFPlayer Mini initialized successfully");
    } else {
        dfPlayerAvailable_ = false;
        Serial.println("[AUDIO] DFPlayer Mini not detected. Falling back to LEDC PWM Siren");
    }
}

void AudioService::playTrack(uint16_t trackNumber) {
    if (dfPlayerAvailable_) {
        dfPlayer.play(trackNumber);
        Serial.printf("[AUDIO] DFPlayer playing track #%d\n", trackNumber);
    } else {
        playSiren();
    }
}

void AudioService::playSiren() {
    isSirenPlaying_ = true;
}

void AudioService::stop() {
    isSirenPlaying_ = false;
    #if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(PIN_SIREN_BUZZER, 0);
    #else
    ledcWrite(PWM_SIREN_CHANNEL, 0);
    #endif

    if (dfPlayerAvailable_) {
        dfPlayer.stop();
    }
}

void AudioService::update(AlertSeverity severity, bool silenceRequested) {
    if (silenceRequested || severity == AlertSeverity::NORMAL) {
        if (isSirenPlaying_) {
            stop();
        }
        return;
    }

    // If critical or warning, generate siren sweep sound if DFPlayer is not actively speaking
    if (severity == AlertSeverity::CRITICAL || severity == AlertSeverity::WARNING) {
        isSirenPlaying_ = true;
        if (millis() - lastToneStepMillis_ >= 25) {
            lastToneStepMillis_ = millis();

            currentFreq_ += freqStep_;
            if (currentFreq_ >= PWM_SIREN_FREQ_MAX) {
                currentFreq_ = PWM_SIREN_FREQ_MAX;
                freqStep_ = -freqStep_;
            } else if (currentFreq_ <= PWM_SIREN_FREQ_MIN) {
                currentFreq_ = PWM_SIREN_FREQ_MIN;
                freqStep_ = -freqStep_;
            }

            #if ESP_ARDUINO_VERSION_MAJOR >= 3
            ledcWriteTone(PIN_SIREN_BUZZER, currentFreq_);
            #else
            ledcWriteTone(PWM_SIREN_CHANNEL, currentFreq_);
            #endif
        }
    }
}
