// app_state.cpp - Implementation of Thread-Safe Central State
#include "app_state.h"

#include <sys/time.h>

AppState g_state;
SemaphoreHandle_t g_stateMutex = nullptr;

bool lockState(TickType_t timeout) {
    if (g_stateMutex == nullptr) {
        return false;
    }
    return xSemaphoreTake(g_stateMutex, timeout) == pdTRUE;
}

void unlockState() {
    if (g_stateMutex != nullptr) {
        xSemaphoreGive(g_stateMutex);
    }
}

void setLastError(const char* message, int httpStatus) {
    if (!message) return;
    if (lockState()) {
        snprintf(g_state.lastError, sizeof(g_state.lastError), "%s", message);
        g_state.lastHttpStatus = httpStatus;
        unlockState();
    }
}

uint64_t epochMillis() {
    struct timeval tv{};
    gettimeofday(&tv, nullptr);
    if (tv.tv_sec < 1700000000) {
        // Clock not synchronized via NTP yet, return local monotonic millis
        return static_cast<uint64_t>(millis());
    }
    return (static_cast<uint64_t>(tv.tv_sec) * 1000ULL) + (tv.tv_usec / 1000ULL);
}
