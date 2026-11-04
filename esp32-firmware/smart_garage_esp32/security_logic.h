#pragma once

#include <stdint.h>
#include <string.h>

namespace SecurityLogic {

constexpr int32_t kMinimumThresholdCm = 5;
constexpr int32_t kMaximumThresholdCm = 200;

inline int32_t clampThreshold(int32_t threshold) {
    if (threshold < kMinimumThresholdCm) return kMinimumThresholdCm;
    if (threshold > kMaximumThresholdCm) return kMaximumThresholdCm;
    return threshold;
}

inline bool validLedCommand(const char* command) {
    return command != nullptr &&
        (strcmp(command, "AUTO") == 0 || strcmp(command, "ON") == 0 || strcmp(command, "OFF") == 0);
}

inline bool shouldTriggerIntrusion(float distanceCm, int32_t thresholdCm, bool armed,
                                   bool maintenanceMode, uint32_t nowMillis,
                                   uint32_t lastIntrusionMillis, uint32_t cooldownMillis) {
    if (!armed || maintenanceMode || distanceCm <= 0.0F || distanceCm >= thresholdCm) {
        return false;
    }
    return static_cast<uint32_t>(nowMillis - lastIntrusionMillis) >= cooldownMillis;
}

} // namespace SecurityLogic
