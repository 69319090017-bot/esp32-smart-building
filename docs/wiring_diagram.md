# 🔌 Hardware Wiring & Pinout Specification

This document details the exact hardware components, pin assignments, electrical schematics, and critical engineering guidelines for the ESP32 Smart Garage system.

---

## 1. Pin Assignment Table

| Component | Pin Function | ESP32 GPIO | Operating Voltage | Notes & Engineering Rationale |
| :--- | :--- | :---: | :---: | :--- |
| **Ultrasonic Sensor (HC-SR04)** | VCC | `5V` (or `VIN`) | 5.0 V | Needs 5V for full acoustic transceiving power |
| | GND | `GND` | 0 V | Common Ground |
| | TRIG | `GPIO 5` | 3.3 V Output | Digital trigger pulse (10µs) |
| | ECHO | `GPIO 18` | 3.3 V Input | Pulse width measures distance (5m timeout) |
| **Light Sensor (LDR)** | Leg 1 | `3.3V` | 3.3 V | **Must use ADC1 pin** (Safe with WiFi active) |
| | Leg 2 (Signal) | `GPIO 34` | 0 - 3.3 V | Connect 10kΩ pull-down resistor from pin to GND |
| **Potentiometer Dial** | Left Leg (VCC) | `3.3V` | 3.3 V | **Do NOT connect to 5V** (ESP32 ADC limit is 3.3V) |
| | Center Leg (Wiper) | `GPIO 35` | 0 - 3.3 V | **ADC1 pin** for threshold adjustment (10-200 cm) |
| | Right Leg (GND) | `GND` | 0 V | Common Ground |
| **Push Button** | Leg 1 (Signal) | `GPIO 15` | 3.3 V | Internal pull-up (`INPUT_PULLUP`), active LOW |
| | Leg 2 | `GND` | 0 V | Common Ground |
| **Indicator LED** | Anode (+) | `GPIO 2` | 3.3 V | Synchronized with built-in blue LED on ESP32 |
| | Cathode (-) | `GND` | 0 V | Connect via 220Ω - 330Ω current-limiting resistor |

---

## 2. Critical Engineering Rules

> [!CAUTION]
> **ADC1 vs ADC2 Pin Selection with WiFi:**
> The ESP32 analog-to-digital converter ADC2 (GPIO 0, 2, 4, 12-15, 25-27) is shared with the Wi-Fi subsystem. When Wi-Fi is active, ADC2 cannot be read reliably.
> **Rule:** All analog sensors (LDR on `GPIO 34`, Potentiometer on `GPIO 35`) **MUST** use **ADC1 pins (GPIO 32 - 39)**.

> [!WARNING]
> **Breadboard Common Ground:**
> Standard full-size breadboards frequently split their power/ground rails between the upper and lower sections. 
> Ensure a jumper wire connects the top blue rail (GND) to the bottom blue rail (GND) to ensure a single unified ground plane across all sensors.

---

## 3. Schematic Diagrams

### 3.1 LDR Voltage Divider Circuit
```text
3.3V ───[ LDR ]───┬───[ 10kΩ Resistor ]─── GND
                  │
             GPIO 34 (ADC1)
```

### 3.2 LED Current Limiting Circuit
```text
GPIO 2 ───[ Long Leg (+) | LED | Short Leg (-) ]───[ 220Ω Resistor ]─── GND
```

### 3.3 Push Button with Internal Pull-up
```text
GPIO 15 ───[ Push Button Switch ]─── GND
(Internal PULLUP enabled in firmware: pinMode(15, INPUT_PULLUP))
```
