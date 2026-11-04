@echo off
title Smart Building - ESP32 6-Hazard Disaster Simulator
cd /d "%~dp0"

echo ========================================================
echo   ESP32 6-Hazard Disaster Simulator (2026 Edition)
echo ========================================================
echo.

set "PY_CMD=python"
where py >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=py"
) else (
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not installed or not in PATH!
        pause
        exit /b 1
    )
)

if not exist "simulator\simulate_esp32.py" (
    echo [ERROR] simulator\simulate_esp32.py not found!
    pause
    exit /b 1
)

echo [INFO] Starting simulated ESP32 device...
echo [INFO] Press Ctrl+C in this window to stop simulator.
echo.

"%PY_CMD%" simulator\simulate_esp32.py

pause
