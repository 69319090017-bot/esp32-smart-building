#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Reuse the project's local Wi-Fi/Firebase settings. Keep secrets.h private.
#include "secrets.h"

// ESP32 DevKit 30-pin test wiring
constexpr uint8_t PIN_DHT11_DATA = 32;
constexpr uint8_t PIN_PIR_OUT = 33;
constexpr uint8_t PIN_TEST_LED = 26;  // GPIO -> 220 ohm resistor -> LED -> GND
constexpr uint8_t PIN_MOTION_LED = 18;  // Separate motion indicator LED -> 220 ohm resistor -> GND
constexpr uint8_t PIN_TEST_BUZZER = 27;  // Piezo buzzer signal
constexpr uint8_t PIN_TEST_SERVO = 25;   // Hobby servo signal (use external 5 V supply)
constexpr uint8_t PIN_SERVO_POWER_ENABLE = 23; // Active-high EN for an external 5 V load-switch module
constexpr uint8_t BUZZER_TEST_CHANNEL = 1; // ESP32 Arduino core 2.x
constexpr uint8_t SERVO_TEST_CHANNEL = 2;  // ESP32 Arduino core 2.x
constexpr uint32_t BUZZER_TEST_FREQ_HZ = 2000;
constexpr uint32_t SERVO_TEST_FREQ_HZ = 50;
// SG92R nominal two-position door movement: about 90 degrees between 1.0 ms and 2.0 ms.
// Calibrate with linkage disconnected; never drive the servo against a hard stop.
constexpr uint32_t SERVO_CLOSED_PULSE_US = 1000;
constexpr uint32_t SERVO_OPEN_PULSE_US = 2000;
constexpr uint32_t SERVO_TEST_PERIOD_US = 20000;
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
bool dhtValid = false;
float temperatureC = 0.0f;
float humidityPercent = 0.0f;

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

void playBuzzerTone(uint32_t freqHz, uint32_t durationMs) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(PIN_TEST_BUZZER, freqHz);
  delay(durationMs);
  ledcWriteTone(PIN_TEST_BUZZER, 0);
  ledcWrite(PIN_TEST_BUZZER, 0);
#else
  ledcWriteTone(BUZZER_TEST_CHANNEL, freqHz);
  delay(durationMs);
  ledcWriteTone(BUZZER_TEST_CHANNEL, 0);
  ledcWrite(BUZZER_TEST_CHANNEL, 0);
#endif
}

void playChimeOfficial() {
  Serial.println(F("[SPEAKER] Playing Official Announcement Chime on GPIO 27..."));
  playBuzzerTone(523, 130); // C5
  delay(40);
  playBuzzerTone(659, 130); // E5
  delay(40);
  playBuzzerTone(784, 260); // G5
}

void playChimeWeather() {
  Serial.println(F("[SPEAKER] Playing Weather Alert Chime on GPIO 27..."));
  playBuzzerTone(659, 120); // E5
  delay(30);
  playBuzzerTone(880, 200); // A5
}

void playSirenAlarm() {
  Serial.println(F("[SPEAKER] Playing Emergency Siren on GPIO 27..."));
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
  Serial.println(F("[SPEAKER] Double beep test on GPIO 27"));
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

void setServoPosition(bool open) {
  if (!servoPowered) {
    setServoPower(true);
  }
  servoIsOpen = open;
  setServoPulseUs(open ? SERVO_OPEN_PULSE_US : SERVO_CLOSED_PULSE_US);
  Serial.println(open ? F("Servo OPEN") : F("Servo CLOSED"));
}

void setServoPower(bool enabled) {
  if (servoPowered == enabled) return;
  if (enabled) {
    digitalWrite(PIN_SERVO_POWER_ENABLE, HIGH);
    servoPowered = true;
    // Power switching alone does not move the door; OPEN/CLOSED is a separate command.
  } else {
    setServoPulseUs(0);
    digitalWrite(PIN_SERVO_POWER_ENABLE, LOW);
    servoPowered = false;
  }
  Serial.println(servoPowered ? F("Servo external power ON") : F("Servo external power OFF"));
}

void testServo() {
  Serial.println(F("Servo test: CLOSED, OPEN (~90 deg), then CLOSED."));
  setServoPosition(false);
  delay(700);
  setServoPosition(true);
  delay(700);
  setServoPosition(false);
  delay(700);
  Serial.println(F("Servo test finished; servo remains CLOSED."));
}

void printTestHelp() {
  Serial.println(F("Commands: 1=LED ON, 0=LED OFF, T=LED blink, B=buzzer beep, P=read PIR, S=servo test, ?=help"));
  Serial.println(F("DHT11 is read automatically; PIR needs about 60 seconds to warm up."));
}

void processSerialCommands() {
  while (Serial.available() > 0) {
    const char command = static_cast<char>(Serial.read());
    if (command == '1') {
      setLed(true);
    } else if (command == '0') {
      setLed(false);
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
    } else if (command == 'P' || command == 'p') {
      if (millis() - bootAt < PIR_WARMUP_MS) {
        Serial.println(F("PIR warming up; wait about 60 seconds after power-on."));
      } else {
        Serial.println(digitalRead(PIN_PIR_OUT) == HIGH
                           ? F("PIR: motion detected")
                           : F("PIR: no motion"));
      }
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

  if (!hasCommandBaseline) {
    // Ignore commands left in the database before this firmware started.
    hasCommandBaseline = true;
    lastCommandId = requestId;
    lastServoCommandId = servoRequestId;
    lastServoPowerCommandId = servoPowerRequestId;
    lastMotionSystemCommandId = motionRequestId;
    lastAnnouncementCommandId = announcementRequestId;
    lastBuzzerCommandId = buzzerRequestId;
    syncLedState(lastCommandId);
    syncServoState(lastServoCommandId);
    syncServoPowerState(lastServoPowerCommandId);
    syncMotionSystemState(lastMotionSystemCommandId);
    Serial.println(F("Firebase command listener ready; old commands ignored"));
    return;
  }
  if (requestId > lastCommandId && (command == "ON" || command == "OFF")) {
    lastCommandId = requestId;
    setLed(command == "ON");
    syncLedState(requestId);
  }
  if (servoRequestId > lastServoCommandId) {
    lastServoCommandId = servoRequestId;
    if (servoCommand == "OPEN") {
      setServoPosition(true);
    } else if (servoCommand == "CLOSED") {
      setServoPosition(false);
    } else if (servoCommand == "LOCK") {
      Serial.println(F("Servo LOCK"));
    } else if (servoCommand == "UNLOCK") {
      Serial.println(F("Servo UNLOCK"));
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
  if (announcementRequestId > lastAnnouncementCommandId || buzzerRequestId > lastBuzzerCommandId) {
    if (announcementRequestId > lastAnnouncementCommandId) lastAnnouncementCommandId = announcementRequestId;
    if (buzzerRequestId > lastBuzzerCommandId) lastBuzzerCommandId = buzzerRequestId;

    String trigger = buzzerCommand.length() > 0 ? buzzerCommand : announcementCommand;
    trigger.toUpperCase();
    Serial.printf("[SPEAKER] Sound command from Web: '%s' (announcementId=%llu, buzzerId=%llu)\n", trigger.c_str(), announcementRequestId, buzzerRequestId);

    if (trigger.indexOf("OFFICIAL") >= 0 || trigger.indexOf("DDPM") >= 0) {
      playChimeOfficial();
    } else if (trigger.indexOf("SIREN") >= 0 || trigger.indexOf("ALARM") >= 0 || trigger.indexOf("CRITICAL") >= 0) {
      playSirenAlarm();
    } else if (trigger.indexOf("WEATHER") >= 0) {
      playChimeWeather();
    } else {
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
  const bool shouldAlert = motionSystemEnabled && pirReady && digitalRead(PIN_PIR_OUT) == HIGH;
  if (shouldAlert) {
    lastMotionAt = millis();
    motionLightOn = true;
  } else if (!motionSystemEnabled || (motionLightOn && millis() - lastMotionAt >= MOTION_LIGHT_HOLD_MS)) {
    motionLightOn = false;
  }
  const bool ledOutput = manualLedOn || motionLightOn;
  if (ledOutput != ledIsOn) {
    ledIsOn = ledOutput;
    digitalWrite(PIN_TEST_LED, ledIsOn ? HIGH : LOW);
    Serial.println(ledIsOn ? F("GPIO26 room LED ON") : F("GPIO26 room LED OFF"));
  }
  if (shouldAlert != motionAlertActive) {
    setMotionLed(shouldAlert);
    if (shouldAlert) testBuzzer();
    Serial.println(shouldAlert ? F("PIR motion detected") : F("PIR motion cleared"));
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
  doc["updated_at"][".sv"] = "timestamp";

  String payload;
  serializeJson(doc, payload);
  const int telemetryStatus = firebaseRequest(devicePath("telemetry/indoor/live"), "PATCH", &payload, nullptr);
  Serial.printf("Indoor telemetry sync: HTTP %d\n", telemetryStatus);

  JsonDocument statusDoc;
  statusDoc["online"] = true;
  statusDoc["firmware_version"] = "arduino_test_1.0";
  statusDoc["last_seen"] = millis();
  serializeJson(statusDoc, payload);
  const int deviceStatus = firebaseRequest(devicePath("status"), "PATCH", &payload, nullptr);
  if (deviceStatus != HTTP_CODE_OK) Serial.printf("Device status sync failed: HTTP %d\n", deviceStatus);
}

void setup() {
  Serial.begin(115200);
  delay(300);
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
  pinMode(PIN_PIR_OUT, INPUT);
  pinMode(PIN_DHT11_DATA, INPUT_PULLUP);
  bootAt = millis();

  firebaseRoot = SECRET_FIREBASE_URL;
  while (firebaseRoot.endsWith("/")) firebaseRoot.remove(firebaseRoot.length() - 1);
  secureClient.setInsecure();  // For this classroom test only; use a root CA for production.

  Serial.println();
  Serial.println(F("ESP32 30-pin Firebase hardware test"));
  Serial.println(F("Pins: DHT11 DATA=GPIO32, PIR OUT=GPIO33, room LED=GPIO26, motion indicator=GPIO18 (both LEDs via 220 ohm)"));
  Serial.println(F("Buzzer test: GPIO27; send B for a short 2 kHz beep."));
  Serial.println(F("Servo signal: GPIO25 (D25); external 5 V switch EN=GPIO23; use a 5 V load switch, not an ESP32 GPIO for servo power."));
  printTestHelp();

  WiFi.mode(WIFI_STA);
  WiFi.begin(SECRET_WIFI_SSID, SECRET_WIFI_PASSWORD);
  Serial.print(F("Connecting to Wi-Fi"));
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.printf("\nWi-Fi connected. IP: %s\n", WiFi.localIP().toString().c_str());

  if (!authenticateIfNeeded()) {
    Serial.println(F("Firebase sign-in failed. Check Firebase Auth Email/Password settings and secrets.h."));
  }
}

void loop() {
  processSerialCommands();
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
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
