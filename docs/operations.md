# Operations guide

## OTA update

OTA is disabled until `SECRET_OTA_PASSWORD_HASH` is set. Generate a password hash using the ArduinoOTA-compatible procedure, place only the hash in `secrets.h`, rebuild and flash once through USB. Then use PlatformIO's OTA upload target or a compatible OTA tool on the local network. Keep the previous USB build available for recovery.

## Recovery

1. If cloud access fails, the local lighting logic and read-only `/api/sensors`, `/api/status`, `/api/events` endpoints continue on the LAN.
2. Verify Wi-Fi credentials and root certificate. The status endpoint exposes no secrets.
3. Events remain in LittleFS until Firebase accepts them. Reconnect the device and confirm `pending-events.ndjson` drains through the dashboard/Discord event history.
4. If the device cannot boot, flash a known-good firmware through USB. Do not factory-reset by deleting files unless the credentials are intentionally being replaced.

## Release checklist

- Run firmware native tests and build.
- Run dashboard build; verify that the ESP32 `data/index.html` was synced.
- Run Discord unit tests.
- Confirm Firebase Rules are not public.
- Confirm the dashboard can sign in, send an `AUTO` command, change threshold, Arm/Disarm and export events.
- Confirm OTA is password-protected or remains disabled.
