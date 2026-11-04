// alert_engine.h - 6-Dimensional Multi-Hazard Alert Engine
#pragma once

#include <Arduino.h>
#include <vector>

#include "weather_types.h"
#include "../config.h"

class AlertEngine {
public:
    AlertEngine();

    // Evaluates a weather snapshot against 6 hazard thresholds
    // Returns list of new/elevated alerts that require action/dispatch
    std::vector<AlertPayload> evaluate(const WeatherSnapshot& snapshot, bool& allCleared);

    // Get current highest severity evaluated
    AlertSeverity getHighestSeverity() const { return highestSeverity_; }

    // Reset internal state
    void reset();

private:
    struct ActiveCondition {
        HazardKind kind = HazardKind::NONE;
        AlertSeverity severity = AlertSeverity::NORMAL;
        char message[192] = "";
    };

    // Tracks current active severity per hazard kind (index 1 to 6)
    AlertSeverity activeSeverities_[7] = {AlertSeverity::NORMAL};
    AlertSeverity highestSeverity_ = AlertSeverity::NORMAL;
    uint32_t lastAlertTimestamp_ = 0;

    static uint8_t severityRank(AlertSeverity sev);
};
