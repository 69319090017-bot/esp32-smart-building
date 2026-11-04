@echo off
title Smart Garage - ESP32 Hardware Simulator
cd /d "%~dp0"

echo ========================================================
echo       ESP32 Virtual Hardware Simulator
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

if not exist "simulate_esp32.py" (
    echo [ERROR] simulate_esp32.py not found!
    pause
    exit /b 1
)

echo [INFO] Starting simulated ESP32 device...
echo [INFO] Press Ctrl+C in this window to stop simulator.
echo.

python simulate_esp32.py

pause
