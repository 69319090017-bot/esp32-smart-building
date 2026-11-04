# 🤖 Telegram Notification Service

Real-time Telegram Bot notification bridge for Smart Building Command Center (2026 Edition).

## Capabilities
- Multi-Hazard Early Warnings (Heat Index, UV, Rain, Gusts, Flood)
- Hardware actuator status broadcasts (Siren strobe, Emergency door release)
- Zero external dependencies (built on Python standard library)

## Usage
```bash
py telegram_bot.py
```
Or from root:
```bash
py telegram-bot/telegram_bot.py
```
Configuration is automatically read from `secrets.env`.
