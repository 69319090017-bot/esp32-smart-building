# ⛈️ 6-Hazard Disaster Simulator

Virtual hardware telemetry & disaster simulation suite for Smart Building Command Center.

## Capabilities
- 6-Hazard Disaster Evaluation (UV, Heat Index, Wind Gusts, Thunderstorm, Rain, Flood)
- Live weather synchronization via Open-Meteo API
- Automated Firebase Realtime Database telemetry injection
- Telegram alert trigger testing

## Usage
Run with synthetic scenarios:
```bash
py simulate_esp32.py
```
Or run with live Open-Meteo satellite weather across 77 provinces:
```bash
py simulate_esp32.py --live
```
