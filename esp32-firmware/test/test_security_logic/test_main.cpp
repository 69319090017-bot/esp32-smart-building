#include <unity.h>

#include "../../smart_garage_esp32/security_logic.h"

void test_threshold_is_clamped() {
    TEST_ASSERT_EQUAL_INT(5, SecurityLogic::clampThreshold(-1));
    TEST_ASSERT_EQUAL_INT(200, SecurityLogic::clampThreshold(999));
    TEST_ASSERT_EQUAL_INT(50, SecurityLogic::clampThreshold(50));
}

void test_led_commands_are_restricted() {
    TEST_ASSERT_TRUE(SecurityLogic::validLedCommand("AUTO"));
    TEST_ASSERT_TRUE(SecurityLogic::validLedCommand("ON"));
    TEST_ASSERT_FALSE(SecurityLogic::validLedCommand("on"));
    TEST_ASSERT_FALSE(SecurityLogic::validLedCommand("DELETE"));
}

void test_intrusion_requires_armed_state_and_cooldown() {
    TEST_ASSERT_FALSE(SecurityLogic::shouldTriggerIntrusion(20.0F, 50, false, false, 50000, 0, 30000));
    TEST_ASSERT_FALSE(SecurityLogic::shouldTriggerIntrusion(20.0F, 50, true, true, 50000, 0, 30000));
    TEST_ASSERT_FALSE(SecurityLogic::shouldTriggerIntrusion(60.0F, 50, true, false, 50000, 0, 30000));
    TEST_ASSERT_FALSE(SecurityLogic::shouldTriggerIntrusion(20.0F, 50, true, false, 20000, 0, 30000));
    TEST_ASSERT_TRUE(SecurityLogic::shouldTriggerIntrusion(20.0F, 50, true, false, 30000, 0, 30000));
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_threshold_is_clamped);
    RUN_TEST(test_led_commands_are_restricted);
    RUN_TEST(test_intrusion_requires_armed_state_and_cooldown);
    return UNITY_END();
}
