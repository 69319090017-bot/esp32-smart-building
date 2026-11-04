// alert_engine.cpp - Implementation of 6-Dimensional Multi-Hazard Alert Engine
#include "alert_engine.h"
#include "provinces.h"

AlertEngine::AlertEngine() {
    reset();
}

void AlertEngine::reset() {
    for (int i = 0; i < 7; ++i) {
        activeSeverities_[i] = AlertSeverity::NORMAL;
    }
    highestSeverity_ = AlertSeverity::NORMAL;
}

uint8_t AlertEngine::severityRank(AlertSeverity sev) {
    switch (sev) {
        case AlertSeverity::CRITICAL: return 2;
        case AlertSeverity::WARNING:  return 1;
        default:                      return 0;
    }
}

std::vector<AlertPayload> AlertEngine::evaluate(const WeatherSnapshot& s, bool& allCleared) {
    std::vector<AlertPayload> newAlerts;
    if (!s.valid) {
        allCleared = false;
        return newAlerts;
    }

    ActiveCondition currentConditions[7];
    for (int i = 0; i < 7; ++i) {
        currentConditions[i].kind = static_cast<HazardKind>(i);
        currentConditions[i].severity = AlertSeverity::NORMAL;
    }

    // 1. ดัชนี UV (UV Index)
    if (s.uvIndex >= UV_CRITICAL_INDEX) {
        currentConditions[static_cast<int>(HazardKind::UV)].severity = AlertSeverity::CRITICAL;
        snprintf(currentConditions[static_cast<int>(HazardKind::UV)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::UV)].message),
                 "เตือนภัยดัชนี UV สูงจัด (%.1f) เสี่ยงผิวไหม้รุนแรงในไม่กี่นาที จ.%s",
                 s.uvIndex, s.province);
    } else if (s.uvIndex >= UV_WARNING_INDEX) {
        currentConditions[static_cast<int>(HazardKind::UV)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::UV)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::UV)].message),
                 "เฝ้าระวังดัชนี UV สูงมาก (%.1f) ควรหลีกเลี่ยงการอยู่กลางแจ้ง จ.%s",
                 s.uvIndex, s.province);
    }

    // 2. ดัชนีความร้อน / ความรู้สึกจริง (Apparent Temperature / Heat Index)
    if (s.apparentTemperature >= HEAT_CRITICAL_TEMP) {
        currentConditions[static_cast<int>(HazardKind::HEAT)].severity = AlertSeverity::CRITICAL;
        snprintf(currentConditions[static_cast<int>(HazardKind::HEAT)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::HEAT)].message),
                 "เตือนภัยอากาศร้อนจัด รู้สึกเหมือน %.1f°C เสี่ยงโรคลมแดด (Heatstroke) จ.%s",
                 s.apparentTemperature, s.province);
    } else if (s.apparentTemperature >= HEAT_WARNING_TEMP) {
        currentConditions[static_cast<int>(HazardKind::HEAT)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::HEAT)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::HEAT)].message),
                 "เฝ้าระวังอากาศร้อน รู้สึกเหมือน %.1f°C เสี่ยงภาวะเพลียแดด จ.%s",
                 s.apparentTemperature, s.province);
    }

    // 3. พายุฝนฟ้าคะนอง (Thunderstorm via WMO Code)
    if (s.weatherCode == 96 || s.weatherCode == 99) {
        currentConditions[static_cast<int>(HazardKind::STORM)].severity = AlertSeverity::CRITICAL;
        snprintf(currentConditions[static_cast<int>(HazardKind::STORM)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::STORM)].message),
                 "เตือนภัยพายุ%s พร้อมลูกเห็บ จ.%s",
                 getWmoDescriptionThai(s.weatherCode), s.province);
    } else if (s.weatherCode == 95) {
        currentConditions[static_cast<int>(HazardKind::STORM)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::STORM)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::STORM)].message),
                 "เฝ้าระวัง%s จ.%s",
                 getWmoDescriptionThai(s.weatherCode), s.province);
    }

    // 4. ลมกระโชกแรง (Wind Gusts)
    if (s.windGusts >= GUST_CRITICAL_KMH) {
        currentConditions[static_cast<int>(HazardKind::GUST)].severity = AlertSeverity::CRITICAL;
        snprintf(currentConditions[static_cast<int>(HazardKind::GUST)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::GUST)].message),
                 "เตือนภัยลมกระโชกรุนแรง %.1f กม./ชม. จ.%s",
                 s.windGusts, s.province);
    } else if (s.windGusts >= GUST_WARNING_KMH) {
        currentConditions[static_cast<int>(HazardKind::GUST)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::GUST)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::GUST)].message),
                 "เฝ้าระวังลมกระโชกแรง %.1f กม./ชม. จ.%s",
                 s.windGusts, s.province);
    }

    // 5. ปริมาณฝน (Precipitation)
    if (s.precipitation >= RAIN_CRITICAL_MM) {
        currentConditions[static_cast<int>(HazardKind::RAIN)].severity = AlertSeverity::CRITICAL;
        snprintf(currentConditions[static_cast<int>(HazardKind::RAIN)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::RAIN)].message),
                 "เตือนภัยฝนตกหนักมาก %.1f มม./ชม. ระวังน้ำท่วมฉับพลัน จ.%s",
                 s.precipitation, s.province);
    } else if (s.precipitation >= RAIN_WARNING_MM) {
        currentConditions[static_cast<int>(HazardKind::RAIN)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::RAIN)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::RAIN)].message),
                 "เฝ้าระวังฝนตกหนัก %.1f มม./ชม. จ.%s",
                 s.precipitation, s.province);
    }

    // 6. ระดับน้ำในแม่น้ำ (River Discharge Flood)
    if (s.riverDischarge >= FLOOD_DISCHARGE_ALERT_M3S && s.riverDischarge > 0.0f) {
        currentConditions[static_cast<int>(HazardKind::FLOOD)].severity = AlertSeverity::WARNING;
        snprintf(currentConditions[static_cast<int>(HazardKind::FLOOD)].message,
                 sizeof(currentConditions[static_cast<int>(HazardKind::FLOOD)].message),
                 "เฝ้าระวังน้ำท่วม: ปริมาณน้ำในแม่น้ำ %.0f ลบ.ม./วินาที สูงกว่าเกณฑ์ (%.0f) จ.%s",
                 s.riverDischarge, FLOOD_DISCHARGE_ALERT_M3S, s.province);
    }

    // Check newly raised or elevated alerts
    AlertSeverity currentHighest = AlertSeverity::NORMAL;
    bool hasAnyActive = false;
    const uint32_t nowSec = static_cast<uint32_t>(millis() / 1000);

    for (int k = 1; k <= 6; ++k) {
        const AlertSeverity curSev = currentConditions[k].severity;
        const AlertSeverity prevSev = activeSeverities_[k];

        if (severityRank(curSev) > severityRank(currentHighest)) {
            currentHighest = curSev;
        }
        if (curSev != AlertSeverity::NORMAL) {
            hasAnyActive = true;
        }

        // Trigger new alert if state was NORMAL or severity upgraded
        if (curSev != AlertSeverity::NORMAL && severityRank(curSev) > severityRank(prevSev)) {
            AlertPayload payload;
            snprintf(payload.alertId, sizeof(payload.alertId), "%s-%s-%s-%lu",
                     s.provinceEn, hazardKindToString(static_cast<HazardKind>(k)),
                     severityToString(curSev), static_cast<unsigned long>(nowSec));
            payload.kind = static_cast<HazardKind>(k);
            payload.severity = curSev;
            snprintf(payload.province, sizeof(payload.province), "%s", s.province);
            snprintf(payload.message, sizeof(payload.message), "%s", currentConditions[k].message);
            payload.timestamp = nowSec;

            newAlerts.push_back(payload);
        }

        activeSeverities_[k] = curSev;
    }

    bool wasPreviouslyActive = (highestSeverity_ != AlertSeverity::NORMAL);
    allCleared = wasPreviouslyActive && !hasAnyActive;
    highestSeverity_ = currentHighest;

    return newAlerts;
}
