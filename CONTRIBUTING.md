# Contributing to Smart Garage System

Thank you for your interest in contributing to the **Smart Garage System**! We welcome improvements, new sensor modules, bug fixes, and documentation enhancements.

---

## 🚀 How to Contribute

### 1. Fork & Clone
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ESP-32-Projects-Fire-base.git
   cd ESP-32-Projects-Fire-base
   ```

### 2. Set Up Environment
1. Copy `secrets.example.env` to `secrets.env` and populate it with test credentials:
   ```bash
   cp secrets.example.env secrets.env
   ```
2. Run configuration sync:
   ```bash
   python setup_secrets.py
   ```
3. Install web dependencies:
   ```bash
   cd web-dashboard && npm install && cd ..
   ```

### 3. Create a Feature Branch
```bash
git checkout -b feature/my-cool-sensor
```

### 4. Code Standards & Guidelines
- **ESP32 Firmware (C++17):**
  - Follow FreeRTOS non-blocking task design. Never block with `delay()` in `TaskSensors` or `TaskControl`.
  - Always acquire `lockState()` / `unlockState()` before accessing shared `g_state`.
  - Ensure pin choices adhere to the ADC1 limitation (GPIO 32-39 for analog sensors while WiFi is active).
- **Web Dashboard (TypeScript):**
  - Maintain strict type safety.
  - Follow the modular architecture (`src/ui_manager.ts`, `src/device_controller.ts`, `src/firebase_client.ts`).
  - Dark mode styles must match the existing Tailwind / CSS variable theme.
- **Discord Bot (Python 3.12+):**
  - Use `asyncio` and `discord.py` 2.4+ standards with Rich Embeds.
  - Mask all sensitive tokens and emails in logs.

### 5. Verify & Test
- Test firmware compilation:
  ```bash
  cd esp32-firmware && pio run && cd ..
  ```
- Test dashboard build:
  ```bash
  cd web-dashboard && npm run build && cd ..
  ```

### 6. Submit a Pull Request
1. Push your branch to GitHub:
   ```bash
   git push origin feature/my-cool-sensor
   ```
2. Open a Pull Request against `main`.
3. Provide a clear description of the changes, test results, and any new hardware requirements.

---

## 📜 Code of Conduct
Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all community interactions.
