#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <math.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Reuse the project's local Wi-Fi/Firebase settings. Keep secrets.h private.
#include "secrets.h"
#include "thai_voices.h"

WiFiMulti wifiMulti;

// ESP32 DevKit 30-pin test wiring
constexpr uint8_t PIN_DHT11_DATA = 32;
constexpr uint8_t PIN_PIR_OUT = 33;
constexpr uint8_t PIN_TEST_LED = 26;          // Room / Pathway light LED -> 220 ohm -> GND
constexpr uint8_t PIN_MOTION_LED = 18;        // Motion indicator LED -> 220 ohm -> GND
constexpr uint8_t PIN_TEST_BUZZER = 27;       // Piezo buzzer signal
constexpr uint8_t PIN_TEST_SERVO = 25;        // Hobby servo signal (SG92R door lock)
constexpr uint8_t PIN_SERVO_POWER_ENABLE = 23;// Active-high EN for external 5V servo supply

// DAC PCM5102 I2S Pins (Hi-Fi 3.5mm Stereo Audio Output)
constexpr uint8_t PIN_I2S_BCK = 19;           // Bit Clock
constexpr uint8_t PIN_I2S_LCK = 21;           // Left/Right Clock (Word Select / WS)
constexpr uint8_t PIN_I2S_DIN = 22;           // Serial Data (DIN)
constexpr i2s_port_t I2S_PORT = I2S_NUM_0;
constexpr int I2S_SAMPLE_RATE = 16000;        // 16kHz matches studio Thai voices and tone generation
bool i2sInitialized = false;

// Assistive Interaction Buttons (Q&A / Status Inquiry)
constexpr uint8_t PIN_BOOT_BUTTON = 0;        // Built-in BOOT button on ESP32 DevKit (Active LOW)
volatile bool stopVoicePlayback = false;      // Instant mute / stop flag

constexpr uint8_t BUZZER_TEST_CHANNEL = 1;    // ESP32 Arduino core 2.x fallback
constexpr uint8_t SERVO_TEST_CHANNEL = 2;     // ESP32 Arduino core 2.x fallback
constexpr uint32_t BUZZER_TEST_FREQ_HZ = 2000;
constexpr uint32_t SERVO_TEST_FREQ_HZ = 50;
constexpr uint32_t SERVO_TEST_PERIOD_US = 20000;

// ==========================================
// SERVO MOTOR CALIBRATION (SG90 / SG92R 180-DEGREE DOOR LOCK)
// ==========================================
// SG92R PWM: 0 deg (Left / CCW) = ~550 us, 180 deg (Right / CW) = ~2450 us
// User requirement:
// - ตอนปิด (CLOSED): 550 us (0 deg / จุดเริ่มต้นกลอนล็อก)
// - ตอนเปิด (OPEN): 2450 us (หมุนไปทางขวา 180 องศาเต็มช่วง)
// สามารถพิมพ์ 'I' ใน Serial Monitor เพื่อสลับทิศทาง (Invert) ได้ทันที
uint32_t servoClosedPulseUs = 550;   // 0 deg (Closed / Lock position)
uint32_t servoOpenPulseUs = 2450;    // 180 deg (Open / Rotated 180 deg to the right)

constexpr uint32_t PIR_WARMUP_MS = 60000;
constexpr uint32_t MOTION_LIGHT_HOLD_MS = 30000;
constexpr uint32_t DHT_INTERVAL_MS = 2000;
constexpr uint32_t FIREBASE_SYNC_INTERVAL_MS = 5000;
constexpr uint32_t COMMAND_POLL_INTERVAL_MS = 1000;
constexpr uint32_t AUTH_RETRY_INITIAL_MS = 60000;
constexpr uint32_t AUTH_RETRY_MAX_MS = 900000;

WiFiClientSecure secureClient;
String firebaseRoot;
String idToken;
uint32_t tokenExpiresAt = 0;
uint32_t nextAuthAttemptAt = 0;
uint32_t authRetryDelayMs = AUTH_RETRY_INITIAL_MS;
uint32_t bootAt = 0;
uint32_t lastDhtReadAt = 0;
uint32_t lastSyncAt = 0;
uint32_t lastCommandPollAt = 0;

uint64_t lastCommandId = 0;
uint64_t lastServoCommandId = 0;
uint64_t lastServoPowerCommandId = 0;
uint64_t lastMotionSystemCommandId = 0;
uint64_t lastAnnouncementCommandId = 0;
uint64_t lastBuzzerCommandId = 0;
uint64_t lastNightModeCommandId = 0;

bool hasDhtRead = false;
bool hasCommandBaseline = false;
bool ledIsOn = false;
bool manualLedOn = false;
bool motionLightOn = false;
uint32_t lastMotionAt = 0;
bool servoIsOpen = false;
bool servoPowered = false;
bool motionSystemEnabled = false;
bool motionAlertActive = false;
bool nightModeEnabled = false;

bool dhtValid = false;
float temperatureC = 0.0f;
float humidityPercent = 0.0f;

// Button debouncing & voice playback throttle
uint32_t lastButtonCheckAt = 0;
bool lastBootPressed = false;
bool lastQueryPressed = false;
uint32_t lastVoicePlayedAt = 0;

// Forward declarations
void playVoice(ThaiVoiceId id);
void playI2STone(uint32_t freqHz, uint32_t durationMs, int16_t amplitude = 14000);
void playBuzzerTone(uint32_t freqHz, uint32_t durationMs);
void setServoPosition(bool open, bool speakNotice = true);
void setServoPower(bool enabled);
void setNightMode(bool enable);
void handleStatusInquiry();

String devicePath(const char* suffix) {
  return String("devices/") + SECRET_DEVICE_ID + "/" + suffix;
}

bool isConfigured(const char* value) {
  return value != nullptr && value[0] != '\0' && strstr(value, "your-") == nullptr && strstr(value, "PASTE_") == nullptr;
}

void deferAuthRetry() {
  nextAuthAttemptAt = millis() + authRetryDelayMs;
  if (authRetryDelayMs < AUTH_RETRY_MAX_MS) {
    authRetryDelayMs = min(authRetryDelayMs * 2UL, AUTH_RETRY_MAX_MS);
  }
}

bool authenticateIfNeeded() {
  if (idToken.length() > 0 && static_cast<int32_t>(tokenExpiresAt - millis()) > 60000) {
    return true;
  }
  if (static_cast<int32_t>(millis() - nextAuthAttemptAt) < 0) {
    return false;
  }
  if (!isConfigured(SECRET_FIREBASE_API_KEY) || !isConfigured(SECRET_FIREBASE_AUTH_EMAIL) || !isConfigured(SECRET_FIREBASE_AUTH_PASSWORD)) {
    Serial.println(F("Firebase auth config is missing in esp32-firmware/secrets.h"));
    deferAuthRetry();
    return false;
  }

  HTTPClient http;
  const String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + SECRET_FIREBASE_API_KEY;
  if (!http.begin(secureClient, url)) {
    deferAuthRetry();
    return false;
  }
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");

  JsonDocument request;
  request["email"] = SECRET_FIREBASE_AUTH_EMAIL;
  request["password"] = SECRET_FIREBASE_AUTH_PASSWORD;
  request["returnSecureToken"] = true;
  String body;
  serializeJson(request, body);

  const int status = http.POST(body);
  const String response = http.getString();
  http.end();
  if (status != HTTP_CODE_OK) {
    Serial.printf("Firebase sign-in failed: HTTP %d\n", status);
    JsonDocument errorResponse;
    if (!deserializeJson(errorResponse, response)) {
      const char* authError = errorResponse["error"]["message"] | "UNKNOWN_AUTH_ERROR";
      Serial.printf("Firebase auth reason: %s\n", authError);
    }
    deferAuthRetry();
    return false;
  }

  JsonDocument result;
  if (deserializeJson(result, response) || !result["idToken"].is<const char*>()) {
    Serial.println(F("Could not read Firebase auth token"));
    deferAuthRetry();
    return false;
  }
  idToken = result["idToken"].as<String>();
  const uint32_t expiresIn = result["expiresIn"] | 3600U;
  tokenExpiresAt = millis() + expiresIn * 1000U;
  authRetryDelayMs = AUTH_RETRY_INITIAL_MS;
  nextAuthAttemptAt = 0;
  Serial.println(F("Firebase authenticated"));
  return true;
}

int firebaseRequest(const String& path, const char* method, const String* payload, String* response) {
  if (!authenticateIfNeeded()) {
    Serial.println(F("RTDB request skipped: Firebase authentication unavailable"));
    return -1000;
  }

  String url = firebaseRoot + "/" + path + ".json?auth=" + idToken;
  WiFiClientSecure rtdbClient;
  rtdbClient.setInsecure();
  HTTPClient http;
  http.setReuse(false);
  if (!http.begin(rtdbClient, url)) {
    Serial.printf("RTDB HTTP begin failed for host %s, path %s\n", firebaseRoot.c_str(), path.c_str());
    return -1001;
  }
  http.setTimeout(10000);
  if (payload != nullptr) http.addHeader("Content-Type", "application/json");

  int status = -1;
  if (strcmp(method, "GET") == 0) {
    status = http.GET();
  } else if (strcmp(method, "PATCH") == 0 && payload != nullptr) {
    status = http.sendRequest("PATCH", *payload);
  } else if (strcmp(method, "PUT") == 0 && payload != nullptr) {
    status = http.PUT(*payload);
  }
  if (response != nullptr) *response = http.getString();
  if (status < 0) {
    Serial.printf("RTDB transport error for %s: %s (%d)\n", path.c_str(),
                  http.errorToString(status).c_str(), status);
  }
  http.end();
  return status;
}

bool waitForDhtLevel(uint8_t level, uint32_t timeoutUs) {
  const uint32_t startedAt = micros();
  while (digitalRead(PIN_DHT11_DATA) != level) {
    if (micros() - startedAt >= timeoutUs) return false;
  }
  return true;
}

bool readDht11(float& temperature, float& humidity) {
  uint8_t data[5] = { 0, 0, 0, 0, 0 };
  pinMode(PIN_DHT11_DATA, OUTPUT_OPEN_DRAIN);
  digitalWrite(PIN_DHT11_DATA, LOW);
  delay(20);
  pinMode(PIN_DHT11_DATA, INPUT_PULLUP);
  delayMicroseconds(30);

  if (!waitForDhtLevel(LOW, 100) || !waitForDhtLevel(HIGH, 100) || !waitForDhtLevel(LOW, 100)) return false;
  for (uint8_t i = 0; i < 40; ++i) {
    if (!waitForDhtLevel(HIGH, 100)) return false;
    const uint32_t highStartedAt = micros();
    if (!waitForDhtLevel(LOW, 120)) return false;
    data[i / 8] <<= 1;
    if (micros() - highStartedAt > 40) data[i / 8] |= 1;
  }
  if (static_cast<uint8_t>(data[0] + data[1] + data[2] + data[3]) != data[4]) return false;
  humidity = data[0] + data[1] * 0.1f;
  temperature = data[2] + data[3] * 0.1f;
  return true;
}

void updateDht() {
  const uint32_t now = millis();
  if (hasDhtRead && now - lastDhtReadAt < DHT_INTERVAL_MS) return;
  hasDhtRead = true;
  lastDhtReadAt = now;
  dhtValid = readDht11(temperatureC, humidityPercent);
  if (dhtValid) {
    Serial.printf("DHT11: %.1f C, %.1f %% RH\n", temperatureC, humidityPercent);
  } else {
    Serial.println(F("DHT11: read failed; check DATA wiring and pull-up"));
  }
}

void setLed(bool enabled) {
  manualLedOn = enabled;
  ledIsOn = manualLedOn || motionLightOn;
  digitalWrite(PIN_TEST_LED, ledIsOn ? HIGH : LOW);
  Serial.println(enabled ? F("Manual LED ON") : F("Manual LED OFF"));
}

void setMotionLed(bool enabled) {
  motionAlertActive = enabled;
  digitalWrite(PIN_MOTION_LED, enabled ? HIGH : LOW);
}

void initI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 6,
    .dma_buf_len = 128,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = PIN_I2S_BCK,
    .ws_io_num = PIN_I2S_LCK,
    .data_out_num = PIN_I2S_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err == ESP_OK) {
    i2s_set_pin(I2S_PORT, &pin_config);
    i2sInitialized = true;
    Serial.println(F("[I2S] PCM5102 DAC initialized (BCK=19, LCK=21, DIN=22, 16kHz Hi-Fi Audio)"));
  } else {
    Serial.printf("[I2S] Driver install failed: %d\n", err);
  }
}

// ADPCM Thai Voice Playback Engine
void playVoice(ThaiVoiceId id) {
  if (id < 0 || id >= VOICE_COUNT) return;
  const ThaiVoiceEntry& entry = THAI_VOICES[id];
  Serial.printf("[SPEAKER] Thai Voice #%d: '%s' (%u samples)\n", id, entry.label, entry.numSamples);

  if (!i2sInitialized) {
    Serial.println(F("[I2S] Cannot play voice: I2S not initialized."));
    return;
  }

  int valprev = 0;
  int index = 0;
  uint32_t sampleCount = 0;
  const uint32_t totalSamples = entry.numSamples;
  const uint8_t* pData = entry.data;

  constexpr size_t DMA_CHUNK = 128;
  int16_t dmaBuf[DMA_CHUNK * 2]; // 16-bit Stereo (Left, Right)
  size_t dmaIdx = 0;

  auto decodeNibble = [&](uint8_t nibble) {
    int step = ADPCM_STEP_TABLE[index];
    uint8_t delta = nibble;
    uint8_t sign = delta & 8;
    delta &= 7;
    int vpdiff = step >> 3;
    if (delta & 4) vpdiff += step;
    if (delta & 2) vpdiff += (step >> 1);
    if (delta & 1) vpdiff += (step >> 2);

    if (sign) valprev -= vpdiff;
    else valprev += vpdiff;

    if (valprev > 32767) valprev = 32767;
    else if (valprev < -32768) valprev = -32768;

    index += ADPCM_INDEX_TABLE[nibble & 0x0F];
    if (index < 0) index = 0;
    else if (index > 88) index = 88;

    int16_t outSample = static_cast<int16_t>(valprev);
    dmaBuf[dmaIdx * 2] = outSample;     // Left Channel
    dmaBuf[dmaIdx * 2 + 1] = outSample; // Right Channel
    dmaIdx++;

    if (dmaIdx >= DMA_CHUNK) {
      size_t bytesWritten = 0;
      i2s_write(I2S_PORT, dmaBuf, sizeof(dmaBuf), &bytesWritten, portMAX_DELAY);
      dmaIdx = 0;
      yield();
    }
  };

  stopVoicePlayback = false;
  uint32_t byteIdx = 0;
  while (sampleCount < totalSamples) {
    if (stopVoicePlayback) {
      Serial.println(F("[SPEAKER] Voice stopped by user!"));
      stopVoicePlayback = false;
      i2s_zero_dma_buffer(I2S_PORT);
      break;
    }
    uint8_t b = pData[byteIdx++];
    decodeNibble((b >> 4) & 0x0F); // High nibble first
    sampleCount++;
    if (sampleCount < totalSamples) {
      decodeNibble(b & 0x0F);      // Low nibble second
      sampleCount++;
    }
  }

  if (dmaIdx > 0) {
    size_t bytesWritten = 0;
    i2s_write(I2S_PORT, dmaBuf, dmaIdx * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
  }

  // Smooth silence ramp
  int16_t silenceBuf[32 * 2] = {0};
  size_t bytesWritten = 0;
  i2s_write(I2S_PORT, silenceBuf, sizeof(silenceBuf), &bytesWritten, portMAX_DELAY);

  lastVoicePlayedAt = millis();
}

void playI2STone(uint32_t freqHz, uint32_t durationMs, int16_t amplitude) {
  if (!i2sInitialized || freqHz == 0) {
    delay(durationMs);
    return;
  }
  const uint32_t totalSamples = (static_cast<uint32_t>(I2S_SAMPLE_RATE) * durationMs) / 1000UL;
  int16_t buffer[64 * 2]; // 64 stereo samples (L, R)
  float phase = 0.0f;
  const float phaseInc = (2.0f * 3.14159265f * static_cast<float>(freqHz)) / static_cast<float>(I2S_SAMPLE_RATE);
  uint32_t samplesWritten = 0;

  while (samplesWritten < totalSamples) {
    const uint32_t chunk = min(static_cast<uint32_t>(64), totalSamples - samplesWritten);
    for (uint32_t i = 0; i < chunk; ++i) {
      int16_t val = static_cast<int16_t>(sinf(phase) * amplitude);
      phase += phaseInc;
      if (phase >= 2.0f * 3.14159265f) phase -= 2.0f * 3.14159265f;
      buffer[i * 2] = val;     // Left channel
      buffer[i * 2 + 1] = val; // Right channel
    }
    size_t bytesWritten = 0;
    i2s_write(I2S_PORT, buffer, chunk * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
    samplesWritten += chunk;
  }
}

void playBuzzerTone(uint32_t freqHz, uint32_t durationMs) {
  // 1. Output to Buzzer (GPIO 27)
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(PIN_TEST_BUZZER, freqHz);
#else
  ledcWriteTone(BUZZER_TEST_CHANNEL, freqHz);
#endif

  // 2. Output to DAC PCM5102 (I2S 3.5mm Audio Jack on GPIO 19, 21, 22)
  playI2STone(freqHz, durationMs);

  // 3. Stop Buzzer
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(PIN_TEST_BUZZER, 0);
  ledcWrite(PIN_TEST_BUZZER, 0);
#else
  ledcWriteTone(BUZZER_TEST_CHANNEL, 0);
  ledcWrite(BUZZER_TEST_CHANNEL, 0);
#endif
}

void playChimeOfficial() {
  Serial.println(F("[SPEAKER] Playing Official Chime on PCM5102 + Buzzer..."));
  playBuzzerTone(523, 130); // C5
  delay(40);
  playBuzzerTone(659, 130); // E5
  delay(40);
  playBuzzerTone(784, 260); // G5
}

void playChimeWeather() {
  Serial.println(F("[SPEAKER] Playing Weather Alert Chime on PCM5102 + Buzzer..."));
  playBuzzerTone(659, 120); // E5
  delay(30);
  playBuzzerTone(880, 200); // A5
}

void playSirenAlarm() {
  Serial.println(F("[SPEAKER] Playing Emergency Siren on PCM5102 + Buzzer..."));
  for (int j = 0; j < 2; j++) {
    for (int f = 1200; f <= 2600; f += 140) {
      playBuzzerTone(f, 15);
    }
    for (int f = 2600; f >= 1200; f -= 140) {
      playBuzzerTone(f, 15);
    }
  }
}

void testBuzzer() {
  Serial.println(F("[SPEAKER] Double beep test on PCM5102 (GPIO 19,21,22) + Buzzer (GPIO 27)"));
  playBuzzerTone(BUZZER_TEST_FREQ_HZ, 150);
  delay(60);
  playBuzzerTone(BUZZER_TEST_FREQ_HZ, 200);
}

void setServoPulseUs(uint32_t pulseUs) {
  const uint32_t duty = (pulseUs * 65535UL) / SERVO_TEST_PERIOD_US;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_TEST_SERVO, duty);
#else
  ledcWrite(SERVO_TEST_CHANNEL, duty);
#endif
}

void setServoPosition(bool open, bool speakNotice) {
  if (!servoPowered) {
    setServoPower(true);
  }
  servoIsOpen = open;
  const uint32_t targetPulse = open ? servoOpenPulseUs : servoClosedPulseUs;
  setServoPulseUs(targetPulse);
  Serial.print(open ? F("Servo OPEN (") : F("Servo CLOSED ("));
  Serial.print(targetPulse);
  Serial.println(F(" us)"));

  if (speakNotice && i2sInitialized) {
    if (open) {
      if (dhtValid && temperatureC >= 35.0f) {
        playVoice(VOICE_HEAT_WARN);  // "ข้างนอกร้อนจัด อย่าลืมดื่มน้ำนะคะ"
      } else {
        playVoice(VOICE_DOOR_OPEN);  // "ประตูเปิดแล้วค่ะ"
      }
    } else {
      playVoice(VOICE_DOOR_LOCKED);  // "ประตูปิดล็อกเรียบร้อยแล้วค่ะ"
    }
  }
}

void setServoPower(bool enabled) {
  if (servoPowered == enabled) return;
  if (enabled) {
    digitalWrite(PIN_SERVO_POWER_ENABLE, HIGH);
    servoPowered = true;
  } else {
    setServoPulseUs(0);
    digitalWrite(PIN_SERVO_POWER_ENABLE, LOW);
    servoPowered = false;
  }
  Serial.println(servoPowered ? F("Servo external power ON") : F("Servo external power OFF"));
}

void setNightMode(bool enable) {
  if (nightModeEnabled == enable) return;
  nightModeEnabled = enable;
  Serial.println(nightModeEnabled ? F("[MODE] Night Mode ACTIVATED") : F("[MODE] Day Mode ACTIVATED"));
  if (nightModeEnabled) {
    setServoPosition(false, false); // Auto lock door
    playVoice(VOICE_NIGHT_MODE);    // "เข้าสู่โหมดกลางคืน ล็อกประตูแล้วค่ะ"
  } else {
    playVoice(VOICE_DAY_MODE);      // "อรุณสวัสดิ์ค่ะ เริ่มต้นวันใหม่อย่างปลอดภัยนะคะ"
  }
}

void handleStatusInquiry() {
  Serial.println(F("[ASSISTIVE] Playing status inquiry for user..."));
  playI2STone(784, 90, 9000);   // G5
  delay(40);
  playI2STone(1046, 140, 9000);  // C6
  delay(120);

  if (dhtValid && temperatureC >= 38.0f) {
    playVoice(VOICE_FIRE_TEMP);  // "ระวัง อุณหภูมิในห้องสูงผิดปกติค่ะ"
  } else if (dhtValid && temperatureC >= 35.0f) {
    playVoice(VOICE_HEAT_WARN);  // "ข้างนอกร้อนจัด อย่าลืมดื่มน้ำนะคะ"
  } else if (nightModeEnabled) {
    playVoice(VOICE_NIGHT_MODE); // "เข้าสู่โหมดกลางคืน ล็อกประตูแล้วค่ะ"
  } else {
    // Routine normal status: 10-minute cooldown so it speaks only once in a long while (นานๆ ทีพูด)
    static uint32_t lastStatusVoiceAt = 0;
    const uint32_t now = millis();
    if (lastStatusVoiceAt == 0 || (now - lastStatusVoiceAt >= 600000UL)) { // 10 minutes
      lastStatusVoiceAt = now;
      playVoice(VOICE_STATUS_OK);  // "ระบบปกติ สภาพอากาศปลอดภัยดีค่ะ"
    } else {
      Serial.println(F("[ASSISTIVE] Status inquiry within 10-min cooldown -> Chime only (quiet mode)"));
    }
  }
}

uint32_t bootPressStartedAt = 0;
bool bootActionTriggered = false;

void checkButtons() {
  const uint32_t now = millis();
  if (now - lastButtonCheckAt < 40) return; // 40ms check interval
  lastButtonCheckAt = now;

  const bool isDown = (digitalRead(PIN_BOOT_BUTTON) == LOW);

  if (isDown) {
    if (bootPressStartedAt == 0) {
      bootPressStartedAt = now;
      bootActionTriggered = false;
    } else if (!bootActionTriggered && (now - bootPressStartedAt >= 400)) {
      // Must be held continuously for 400ms by real human hand (100% immune to noise)
      bootActionTriggered = true;
      if (now - lastVoicePlayedAt > 4500) {
        Serial.println(F("[BUTTON] BOOT button held 400ms -> Status Inquiry"));
        handleStatusInquiry();
      } else {
        stopVoicePlayback = true;
        i2s_zero_dma_buffer(I2S_PORT);
        Serial.println(F("[BUTTON] BOOT button pressed during speech -> STOPPED"));
      }
    }
  } else {
    bootPressStartedAt = 0;
    bootActionTriggered = false;
  }
}

void testServo() {
  Serial.print(F("Servo test: CLOSED ("));
  Serial.print(servoClosedPulseUs);
  Serial.print(F("us), OPEN ("));
  Serial.print(servoOpenPulseUs);
  Serial.println(F("us - 180 deg right), then CLOSED."));
  setServoPosition(false, false);
  delay(1000);
  setServoPosition(true, false);
  delay(1200);
  setServoPosition(false, false);
  delay(1000);
  Serial.println(F("Servo test finished; servo remains CLOSED."));
}

void printTestHelp() {
  Serial.println(F("Commands: 1=LED ON, 0=LED OFF, T=LED blink, B=buzzer beep, P=read PIR, S=servo test 180, O=open door, C=close door, I=invert servo, V=voice test, N=toggle night mode, Q=status inquiry, X=stop speech, ?=help"));
  Serial.println(F("Tip: You can press the physical BOOT button on the ESP32 board to hear status or to STOP speech instantly!"));
}

void processSerialCommands() {
  while (Serial.available() > 0) {
    const char command = static_cast<char>(Serial.read());
    if (command == '1') {
      setLed(true);
    } else if (command == '0') {
      setLed(false);
    } else if (command == 'X' || command == 'x' || command == ' ') {
      stopVoicePlayback = true;
      i2s_zero_dma_buffer(I2S_PORT);
      Serial.println(F("[SPEAKER] Stop speech command executed"));
    } else if (command == 'T' || command == 't') {
      for (uint8_t i = 0; i < 3; ++i) {
        setLed(true);
        delay(300);
        setLed(false);
        delay(300);
      }
    } else if (command == 'B' || command == 'b') {
      testBuzzer();
    } else if (command == 'S' || command == 's') {
      testServo();
    } else if (command == 'O' || command == 'o') {
      Serial.println(F("[SERIAL] Command: Open door (180 deg right)"));
      setServoPosition(true);
    } else if (command == 'C' || command == 'c') {
      Serial.println(F("[SERIAL] Command: Close door"));
      setServoPosition(false);
    } else if (command == 'I' || command == 'i') {
      const uint32_t tmp = servoClosedPulseUs;
      servoClosedPulseUs = servoOpenPulseUs;
      servoOpenPulseUs = tmp;
      Serial.print(F("[SERVO] Inverted! CLOSED="));
      Serial.print(servoClosedPulseUs);
      Serial.print(F("us, OPEN="));
      Serial.print(servoOpenPulseUs);
      Serial.println(F("us"));
      setServoPosition(servoIsOpen, false);
    } else if (command == 'P' || command == 'p') {
      if (millis() - bootAt < PIR_WARMUP_MS) {
        Serial.println(F("PIR warming up; wait about 60 seconds after power-on."));
      } else {
        Serial.println(digitalRead(PIN_PIR_OUT) == HIGH
                           ? F("PIR: motion detected")
                           : F("PIR: no motion"));
      }
    } else if (command == 'V' || command == 'v') {
      Serial.println(F("Testing Thai voice playback..."));
      playVoice(VOICE_STATUS_OK);
    } else if (command == 'N' || command == 'n') {
      setNightMode(!nightModeEnabled);
    } else if (command == 'Q' || command == 'q') {
      handleStatusInquiry();
    } else if (command == '?') {
      printTestHelp();
    }
  }
}

bool syncLedState(uint64_t requestId) {
  JsonDocument doc;
  doc["state"] = ledIsOn ? "ON" : "OFF";
  doc["request_id"] = requestId;
  doc["updated_at"][".sv"] = "timestamp";
  String payload;
  serializeJson(doc, payload);
  const int status = firebaseRequest(devicePath("commands/led_state"), "PUT", &payload, nullptr);
  if (status != HTTP_CODE_OK) Serial.printf("LED state sync failed: HTTP %d\n", status);
  return status == HTTP_CODE_OK;
}

bool syncServoState(uint64_t requestId) {
  JsonDocument doc;
  doc["state"] = servoIsOpen ? "OPEN" : "CLOSED";
  doc["request_id"] = requestId;
  doc["updated_at"][".sv"] = "timestamp";
  String payload;
  serializeJson(doc, payload);
  const int status = firebaseRequest(devicePath("commands/servo_state"), "PUT", &payload, nullptr);
  if (status != HTTP_CODE_OK) Serial.printf("Servo state sync failed: HTTP %d\n", status);
  return status == HTTP_CODE_OK;
}

bool syncServoPowerState(uint64_t requestId) {
  JsonDocument doc;
  doc["enabled"] = servoPowered;
  doc["request_id"] = requestId;
  doc["updated_at"][".sv"] = "timestamp";
  String payload;
  serializeJson(doc, payload);
  const int status = firebaseRequest(devicePath("commands/servo_power_state"), "PUT", &payload, nullptr);
  if (status != HTTP_CODE_OK) Serial.printf("Servo power state sync failed: HTTP %d\n", status);
  return status == HTTP_CODE_OK;
}

bool syncMotionSystemState(uint64_t requestId) {
  JsonDocument doc;
  doc["enabled"] = motionSystemEnabled;
  doc["request_id"] = requestId;
  doc["updated_at"][".sv"] = "timestamp";
  String payload;
  serializeJson(doc, payload);
  const int status = firebaseRequest(devicePath("commands/motion_system_state"), "PUT", &payload, nullptr);
  if (status != HTTP_CODE_OK) Serial.printf("Motion system state sync failed: HTTP %d\n", status);
  return status == HTTP_CODE_OK;
}

bool syncNightModeState(uint64_t requestId) {
  JsonDocument doc;
  doc["enabled"] = nightModeEnabled;
  doc["request_id"] = requestId;
  doc["updated_at"][".sv"] = "timestamp";
  String payload;
  serializeJson(doc, payload);
  const int status = firebaseRequest(devicePath("commands/night_mode_state"), "PUT", &payload, nullptr);
  if (status != HTTP_CODE_OK) Serial.printf("Night mode state sync failed: HTTP %d\n", status);
  return status == HTTP_CODE_OK;
}

void pollLedCommand() {
  String response;
  const int status = firebaseRequest(devicePath("commands"), "GET", nullptr, &response);
  if (status != HTTP_CODE_OK) {
    Serial.printf("Firebase command read failed: HTTP %d\n", status);
    return;
  }

  JsonDocument doc;
  if (deserializeJson(doc, response)) return;
  const String command = doc["led_command"] | "";
  const uint64_t requestId = doc["led_command_id"] | static_cast<uint64_t>(0);
  const String servoCommand = doc["servo_command"] | "";
  const uint64_t servoRequestId = doc["servo_command_id"] | static_cast<uint64_t>(0);
  const bool servoPowerCommand = doc["servo_power_enabled"] | false;
  const uint64_t servoPowerRequestId = doc["servo_power_command_id"] | static_cast<uint64_t>(0);
  const bool motionCommand = doc["motion_system_enabled"] | false;
  const uint64_t motionRequestId = doc["motion_system_command_id"] | static_cast<uint64_t>(0);
  const String announcementCommand = doc["announcement_command"] | "";
  const uint64_t announcementRequestId = doc["announcement_command_id"] | static_cast<uint64_t>(0);
  const String buzzerCommand = doc["buzzer_command"] | "";
  const uint64_t buzzerRequestId = doc["buzzer_command_id"] | static_cast<uint64_t>(0);
  const String cueType = doc["cue_type"] | "";
  const bool nightModeCmd = doc["night_mode_enabled"] | false;
  const uint64_t nightModeRequestId = doc["night_mode_command_id"] | static_cast<uint64_t>(0);

  if (!hasCommandBaseline) {
    // Ignore commands left in the database before this firmware started.
    hasCommandBaseline = true;
    lastCommandId = requestId;
    lastServoCommandId = servoRequestId;
    lastServoPowerCommandId = servoPowerRequestId;
    lastMotionSystemCommandId = motionRequestId;
    lastAnnouncementCommandId = announcementRequestId;
    lastBuzzerCommandId = buzzerRequestId;
    lastNightModeCommandId = nightModeRequestId;
    syncLedState(lastCommandId);
    syncServoState(lastServoCommandId);
    syncServoPowerState(lastServoPowerCommandId);
    syncMotionSystemState(lastMotionSystemCommandId);
    syncNightModeState(lastNightModeCommandId);
    Serial.println(F("Firebase command listener ready; old commands ignored"));
    return;
  }
  if (requestId > lastCommandId && (command == "ON" || command == "OFF")) {
    lastCommandId = requestId;
    const bool wasOn = ledIsOn;
    setLed(command == "ON");
    syncLedState(requestId);
    if (command == "ON" && !wasOn) {
      Serial.println(F("[VOICE] Light turned ON -> Playing VOICE_NIGHT_WALK"));
      playVoice(VOICE_NIGHT_WALK);
    }
  }
  if (servoRequestId > lastServoCommandId) {
    lastServoCommandId = servoRequestId;
    if (servoCommand == "OPEN" || servoCommand == "UNLOCK") {
      setServoPosition(true); // Plays VOICE_DOOR_OPEN cleanly once inside setServoPosition
    } else if (servoCommand == "CLOSED" || servoCommand == "LOCK") {
      setServoPosition(false); // Plays VOICE_DOOR_LOCKED cleanly once inside setServoPosition
    }
    syncServoState(servoRequestId);
  }
  if (servoPowerRequestId > lastServoPowerCommandId) {
    lastServoPowerCommandId = servoPowerRequestId;
    setServoPower(servoPowerCommand);
    syncServoPowerState(servoPowerRequestId);
  }
  if (motionRequestId > lastMotionSystemCommandId) {
    lastMotionSystemCommandId = motionRequestId;
    motionSystemEnabled = motionCommand;
    if (!motionSystemEnabled) setMotionLed(false);
    syncMotionSystemState(motionRequestId);
    Serial.println(motionSystemEnabled ? F("Motion alert system ON") : F("Motion alert system OFF"));
  }
  if (nightModeRequestId > lastNightModeCommandId) {
    lastNightModeCommandId = nightModeRequestId;
    setNightMode(nightModeCmd);
    syncNightModeState(nightModeRequestId);
  }
  if (announcementRequestId > lastAnnouncementCommandId || buzzerRequestId > lastBuzzerCommandId) {
    if (announcementRequestId > lastAnnouncementCommandId) lastAnnouncementCommandId = announcementRequestId;
    if (buzzerRequestId > lastBuzzerCommandId) lastBuzzerCommandId = buzzerRequestId;

    String cue = cueType;
    cue.toUpperCase();
    String trigger = cue.length() > 0 ? cue : (buzzerCommand.length() > 0 ? buzzerCommand : announcementCommand);
    trigger.toUpperCase();
    Serial.printf("[SPEAKER] Sound command from Web: cue='%s', trigger='%s'\n", cue.c_str(), trigger.c_str());

    if (trigger.indexOf("BOOT") >= 0 || trigger.indexOf("START") >= 0) {
      playVoice(VOICE_BOOT);
    } else if (trigger.indexOf("WIFI") >= 0) {
      playVoice(VOICE_WIFI_OK);
    } else if (trigger.indexOf("DOOR_OPEN") >= 0) {
      playVoice(VOICE_DOOR_OPEN);
    } else if (trigger.indexOf("DOOR_LOCKED") >= 0 || trigger.indexOf("LOCK") >= 0) {
      playVoice(VOICE_DOOR_LOCKED);
    } else if (trigger.indexOf("NIGHT_WALK") >= 0 || trigger.indexOf("PATHWAY") >= 0) {
      playVoice(VOICE_NIGHT_WALK);
    } else if (trigger.indexOf("INTRUSION") >= 0 || trigger.indexOf("THIEF") >= 0) {
      playVoice(VOICE_INTRUSION);
    } else if (trigger.indexOf("HEAT") >= 0) {
      playVoice(VOICE_HEAT_WARN);
    } else if (trigger.indexOf("RAIN") >= 0) {
      playVoice(VOICE_RAIN_WARN);
    } else if (trigger.indexOf("SAFE_OUT") >= 0 || trigger.indexOf("OUTSIDE") >= 0) {
      playVoice(VOICE_SAFE_OUT);
    } else if (trigger.indexOf("STORM") >= 0 || trigger.indexOf("WIND") >= 0) {
      playVoice(VOICE_STORM_WARN);
    } else if (trigger.indexOf("FIRE") >= 0 || trigger.indexOf("TEMP") >= 0) {
      playVoice(VOICE_FIRE_TEMP);
    } else if (trigger.indexOf("FLOOD") >= 0 || trigger.indexOf("WATER") >= 0) {
      playVoice(VOICE_FLOOD_WARN);
    } else if (trigger.indexOf("NIGHT_MODE") >= 0) {
      setNightMode(true);
    } else if (trigger.indexOf("DAY_MODE") >= 0) {
      setNightMode(false);
    } else if (trigger == "STATUS" || trigger == "STATUS_OK" || trigger == "QUERY" || trigger == "STATUS_INQUIRY") {
      handleStatusInquiry();
    } else if (trigger.indexOf("OFFICIAL") >= 0 || trigger.indexOf("DDPM") >= 0) {
      playChimeOfficial();
      // Only play specific hazard voice if keyword is present; never play routine status here
      if (trigger.indexOf("STORM") >= 0 || trigger.indexOf("พายุ") >= 0 || trigger.indexOf("ลม") >= 0) {
        playVoice(VOICE_STORM_WARN);
      } else if (trigger.indexOf("FLOOD") >= 0 || trigger.indexOf("น้ำ") >= 0) {
        playVoice(VOICE_FLOOD_WARN);
      } else if (trigger.indexOf("RAIN") >= 0 || trigger.indexOf("ฝน") >= 0) {
        playVoice(VOICE_RAIN_WARN);
      } else if (trigger.indexOf("HEAT") >= 0 || trigger.indexOf("ร้อน") >= 0) {
        playVoice(VOICE_HEAT_WARN);
      }
    } else if (trigger.indexOf("SIREN") >= 0 || trigger.indexOf("ALARM") >= 0 || trigger.indexOf("CRITICAL") >= 0) {
      playSirenAlarm();
      playVoice(VOICE_INTRUSION);
    } else if (trigger.indexOf("WEATHER") >= 0) {
      playChimeWeather();
      if (trigger.indexOf("HEAT") >= 0 || trigger.indexOf("ร้อน") >= 0) {
        playVoice(VOICE_HEAT_WARN);
      } else {
        playVoice(VOICE_RAIN_WARN);
      }
    } else if (trigger.indexOf("TEST") >= 0) {
      playChimeOfficial();
    } else if (trigger.length() > 0) {
      testBuzzer();
    }

    JsonDocument stateDoc;
    stateDoc["request_id"] = max(announcementRequestId, buzzerRequestId);
    stateDoc["state"] = "PLAYING";
    stateDoc["result"] = "OK";
    stateDoc["played_at"][".sv"] = "timestamp";
    String payload;
    serializeJson(stateDoc, payload);
    firebaseRequest(devicePath("commands/announcement_state"), "PUT", &payload, nullptr);
  }
}

void updateMotionAlert() {
  const bool pirReady = millis() - bootAt >= PIR_WARMUP_MS;
  const bool motionDetected = pirReady && digitalRead(PIN_PIR_OUT) == HIGH;

  if (motionDetected) {
    lastMotionAt = millis();
    motionLightOn = true;

    // 1. Night Mode Pathway Lighting + Caring Guidance for Elderly
    if (nightModeEnabled) {
      if (millis() - lastVoicePlayedAt > 15000) {
        Serial.println(F("[NIGHT MODE] Motion detected in dark -> Gentle pathway illumination & audio guide"));
        playVoice(VOICE_NIGHT_WALK); // "ไฟเปิดแล้วค่ะ ระวังสะดุดนะคะ"
      }
    }
    // 2. Armed Intrusion Detection
    else if (motionSystemEnabled && !motionAlertActive) {
      Serial.println(F("[SECURITY] Motion detected while armed -> Intrusion alarm!"));
      setMotionLed(true);
      playSirenAlarm();
      playVoice(VOICE_INTRUSION);  // "แจ้งเตือน ตรวจพบความเคลื่อนไหวผิดปกติค่ะ"
    }
  } else if (!motionSystemEnabled && !nightModeEnabled) {
    motionLightOn = false;
  } else if (motionLightOn && millis() - lastMotionAt >= MOTION_LIGHT_HOLD_MS) {
    motionLightOn = false;
  }

  const bool ledOutput = manualLedOn || motionLightOn;
  if (ledOutput != ledIsOn) {
    ledIsOn = ledOutput;
    digitalWrite(PIN_TEST_LED, ledIsOn ? HIGH : LOW);
    Serial.println(ledIsOn ? F("GPIO26 room LED ON") : F("GPIO26 room LED OFF"));
  }

  if (motionSystemEnabled && pirReady) {
    if (motionDetected != motionAlertActive) {
      setMotionLed(motionDetected);
      Serial.println(motionDetected ? F("PIR motion alert ACTIVE") : F("PIR motion alert CLEARED"));
    }
  } else {
    setMotionLed(false);
  }
}

void syncTelemetry() {
  const bool pirReady = millis() - bootAt >= PIR_WARMUP_MS;
  const bool motionDetected = pirReady && digitalRead(PIN_PIR_OUT) == HIGH;

  JsonDocument doc;
  JsonObject dht = doc["dht11"].to<JsonObject>();
  dht["valid"] = dhtValid;
  if (dhtValid) {
    dht["temperature_c"] = temperatureC;
    dht["humidity_percent"] = humidityPercent;
  }
  JsonObject pir = doc["pir"].to<JsonObject>();
  pir["ready"] = pirReady;
  pir["valid"] = pirReady;
  if (pirReady) pir["motion_detected"] = motionDetected;

  JsonObject modes = doc["modes"].to<JsonObject>();
  modes["night_mode"] = nightModeEnabled;
  modes["motion_system"] = motionSystemEnabled;

  doc["updated_at"][".sv"] = "timestamp";

  String payload;
  serializeJson(doc, payload);
  const int telemetryStatus = firebaseRequest(devicePath("telemetry/indoor/live"), "PATCH", &payload, nullptr);
  Serial.printf("Indoor telemetry sync: HTTP %d\n", telemetryStatus);

  JsonDocument statusDoc;
  statusDoc["online"] = true;
  statusDoc["firmware_version"] = "arduino_voice_2.0";
  statusDoc["last_seen"] = millis();
  serializeJson(statusDoc, payload);
  const int deviceStatus = firebaseRequest(devicePath("status"), "PATCH", &payload, nullptr);
  if (deviceStatus != HTTP_CODE_OK) Serial.printf("Device status sync failed: HTTP %d\n", deviceStatus);
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector to prevent reboot when DAC draws current
  Serial.begin(115200);
  delay(300);

  // Assistive Buttons (Built-in BOOT Button GPIO 0)
  pinMode(PIN_BOOT_BUTTON, INPUT_PULLUP);

  pinMode(PIN_TEST_LED, OUTPUT);
  setLed(false);
  pinMode(PIN_MOTION_LED, OUTPUT);
  setMotionLed(false);

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_TEST_BUZZER, BUZZER_TEST_FREQ_HZ, 8);
  ledcWrite(PIN_TEST_BUZZER, 0);
  ledcAttach(PIN_TEST_SERVO, SERVO_TEST_FREQ_HZ, 16);
  setServoPulseUs(0);
#else
  ledcSetup(BUZZER_TEST_CHANNEL, BUZZER_TEST_FREQ_HZ, 8);
  ledcAttachPin(PIN_TEST_BUZZER, BUZZER_TEST_CHANNEL);
  ledcWrite(BUZZER_TEST_CHANNEL, 0);
  ledcSetup(SERVO_TEST_CHANNEL, SERVO_TEST_FREQ_HZ, 16);
  ledcAttachPin(PIN_TEST_SERVO, SERVO_TEST_CHANNEL);
  setServoPulseUs(0);
#endif

  pinMode(PIN_SERVO_POWER_ENABLE, OUTPUT);
  digitalWrite(PIN_SERVO_POWER_ENABLE, HIGH);
  servoPowered = true;

  // Initialize DAC PCM5102 I2S Hi-Fi Audio (16kHz stereo)
  initI2S();

  pinMode(PIN_PIR_OUT, INPUT);
  pinMode(PIN_DHT11_DATA, INPUT_PULLUP);
  bootAt = millis();

  // Play startup voice prompt through DAC PCM5102 (cold boot only)
  esp_reset_reason_t rstReason = esp_reset_reason();
  if (rstReason == ESP_RST_POWERON) {
    playVoice(VOICE_BOOT); // "ระบบดูแลความปลอดภัย เริ่มทำงานค่ะ"
  } else {
    // Gentle soft boot chime if resetting due to brownout/watchdog/software
    playI2STone(523, 80, 8000);
    delay(40);
    playI2STone(1046, 120, 8000);
    Serial.printf("[BOOT] Reset reason %d -> Gentle chime\n", (int)rstReason);
  }

  firebaseRoot = SECRET_FIREBASE_URL;
  while (firebaseRoot.endsWith("/")) firebaseRoot.remove(firebaseRoot.length() - 1);
  secureClient.setInsecure();

  Serial.println();
  Serial.println(F("=========================================================="));
  Serial.println(F("  Safe Home & Disaster Monitor - Assistive Care Firmware  "));
  Serial.println(F("=========================================================="));
  Serial.println(F("Sensors : DHT11=GPIO32, PIR=GPIO33"));
  Serial.println(F("Actuators: Room LED=GPIO26, Motion LED=GPIO18, Servo=GPIO25"));
  Serial.println(F("Audio   : DAC PCM5102 I2S (BCK=19, LCK=21, DIN=22) + Buzzer=GPIO27"));
  Serial.println(F("Buttons : Built-in BOOT=GPIO0, External Query=GPIO15"));
  printTestHelp();

  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(SECRET_WIFI_SSID, SECRET_WIFI_PASSWORD);
#ifdef SECRET_WIFI_BACKUP_SSID
  wifiMulti.addAP(SECRET_WIFI_BACKUP_SSID, SECRET_WIFI_BACKUP_PASSWORD);
#endif

  Serial.println(F("Connecting to Wi-Fi (Multi-AP Auto Failover)..."));
  uint32_t wifiStartAt = millis();
  while (wifiMulti.run() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
    if (millis() - wifiStartAt > 20000) {
      Serial.println(F("\nStill scanning for Wi-Fi APs..."));
      wifiStartAt = millis();
    }
  }
  Serial.printf("\nWi-Fi connected to '%s'! IP: %s\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());

  // Voice confirmation of connection on cold boot
  if (rstReason == ESP_RST_POWERON) {
    playVoice(VOICE_WIFI_OK); // "เชื่อมต่ออินเทอร์เน็ตและระบบคลาวด์แล้วค่ะ"
  } else {
    playI2STone(784, 80, 8000);
    delay(30);
    playI2STone(1046, 120, 8000);
  }

  if (!authenticateIfNeeded()) {
    Serial.println(F("Firebase sign-in failed. Check Firebase Auth Email/Password settings and secrets.h."));
  }
}

void loop() {
  processSerialCommands();
  checkButtons();

  if (wifiMulti.run() != WL_CONNECTED) {
    delay(100);
    return;
  }

  updateDht();
  updateMotionAlert();
  const uint32_t now = millis();
  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPollAt = now;
    pollLedCommand();
  }
  if (now - lastSyncAt >= FIREBASE_SYNC_INTERVAL_MS) {
    lastSyncAt = now;
    syncTelemetry();
  }
  delay(10);
}
