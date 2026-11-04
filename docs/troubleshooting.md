# 🛠️ Troubleshooting & FAQ

This document covers common issues encountered during development, hardware wiring, and cloud integration, along with verified solutions.

---

## 1. ESP32 & Hardware Issues

### Q: `could not open port 'COM3': PermissionError(13, 'Access is denied.')`
* **Cause:** Another program (such as the PlatformIO Serial Monitor, Arduino IDE, or PuTTY) is currently occupying the serial COM port.
* **Solution:** Close the Serial Monitor terminal in VS Code before clicking **Upload**.

### Q: Analog readings (LDR or Potentiometer) read `0` or `4095` and never change.
* **Cause 1:** Sensor is connected to an **ADC2 pin** (e.g. GPIO 2, 4, 12-15, 25-27), which is disabled when Wi-Fi is transmitting.
  * **Fix:** Connect only to **ADC1 pins (GPIO 32 - 39)**.
* **Cause 2:** The breadboard power rail is split. The top blue GND rail is not connected to the bottom blue GND rail.
  * **Fix:** Connect a jumper wire between the top and bottom ground rails.
* **Cause 3:** LDR is missing its 10kΩ pull-down resistor in the voltage divider.

### Q: LED does not turn on even when the dashboard shows `ON`.
* **Cause:** Reversed polarity on the LED (Long leg is Anode +, Short leg is Cathode -) or missing current-limiting resistor to GND.

---

## 2. WiFi & Network Issues

### Q: ESP32 outputs `[WIFI] Disconnected` in a loop.
* **Cause 1 (5GHz Network):** ESP32 only supports **2.4 GHz Wi-Fi**. If broadcasting a mobile hotspot from iPhone or Android, ensure **"Maximize Compatibility"** is enabled.
* **Cause 2 (Captive Portal):** School, university, or public Wi-Fi networks that require entering credentials on a web browser login page cannot be connected to directly via WPA2-PSK. Use a standard home Wi-Fi or mobile hotspot.

---

## 3. Firebase & Cloud Issues

### Q: Serial monitor loops: `[FIREBASE] Device authentication succeeded` followed by HTTP 401 / 403 errors.
* **Cause 1:** The Realtime Database URL in `secrets.h` contained a trailing slash (`/`), resulting in a malformed double-slash URL (`//devices/...`).
  * **Fix:** Our updated `firebase_service.cpp` automatically strips any trailing slashes.
* **Cause 2:** Firebase REST API requires passing the token via `?auth=<idToken>` query parameter rather than the `Authorization: Bearer` header.
* **Cause 3:** Database rules are set to `false`. Ensure Rules in Firebase Console are set to:
  ```json
  {
    "rules": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
  ```

---

## 4. Web Dashboard Issues

### Q: Web dashboard shows a white screen with "Please rotate your device".
* **Cause:** The project was missing the `src/style.css` stylesheet, or the browser was zoomed to 150%+ triggering a mobile landscape lock.
* **Fix:** We have disabled the desktop portrait lock and verified that all TypeScript/CSS assets build cleanly with `npm run build`.
