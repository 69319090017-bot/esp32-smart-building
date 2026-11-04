#include "app_state.h"

#include <time.h>
#include <string.h>

AppState g_state;
SemaphoreHandle_t g_stateMutex = nullptr;

bool lockState(TickType_t timeout) {
    return g_stateMutex != nullptr && xSemaphoreTake(g_stateMutex, timeout) == pdTRUE;
}

void unlockState() {
    if (g_stateMutex != nullptr) {
        xSemaphoreGive(g_stateMutex);
    }
}

void setLastError(const char* message, int httpStatus) {
    if (!lockState()) {
        return;
    }
    snprintf(g_state.lastError, sizeof(g_state.lastError), "%s", message == nullptr ? "Unknown error" : message);
    g_state.lastHttpStatus = httpStatus;
    unlockState();
}

uint64_t epochMillis() {
    const time_t now = time(nullptr);
    // Epoch values below 2023 mean NTP is not available yet. Returning 0 lets
    // consumers distinguish an unknown time from a real Unix timestamp.
    if (now < 1672531200) {
        return 0;
    }
    return static_cast<uint64_t>(now) * 1000ULL + (millis() % 1000U);
}
