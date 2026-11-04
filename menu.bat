@echo off
title Smart Building Command Center - Control Center (2026)
cd /d "%~dp0"

:: Detect PlatformIO
set "PIO_CMD=pio"
where pio >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\.platformio\penv\Scripts\platformio.exe" (
        set "PIO_CMD=%USERPROFILE%\.platformio\penv\Scripts\platformio.exe"
    )
)

:: Detect Python
set "PY_CMD=python"
where py >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=py"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PY_CMD=python"
    )
)

:main_menu
cls
echo =======================================================================
echo     SMART BUILDING COMMAND CENTER - CONTROL CENTER (2026 EDITION)
echo =======================================================================
echo.
echo   [ WEB DASHBOARD ]
echo     [1] Start Web Dashboard (Dev Mode on localhost:3000)
echo     [2] Build Web Dashboard (Production dist)
echo     [3] Deploy to Firebase Hosting
echo.
echo   [ ESP32 HARDWARE FIRMWARE ]
echo     [4] Build ESP32 Firmware (Compile test)
echo     [5] Upload Firmware to ESP32 Board
echo     [6] Upload Web Dashboard to ESP32 Flash (LittleFS uploadfs)
echo     [7] Open ESP32 Serial Monitor (115200 baud)
echo.
echo   [ BOT AND DISASTER SIMULATION ]
echo     [8] Run 6-Hazard Disaster Simulator (Open-Meteo ^& Test Suite)
echo     [9] Run Telegram Bot Notification Service
echo.
echo   [ CONFIG AND MAINTENANCE ]
echo    [10] Apply Secrets / Update Config (setup_secrets.py)
echo    [11] Clean Cache and Temp Files
echo.
echo     [0] Exit
echo =======================================================================
set "opt="
set /p opt="Please select an option [0-11]: "

if "%opt%"=="1" goto opt_dev
if "%opt%"=="2" goto opt_build
if "%opt%"=="3" goto opt_deploy
if "%opt%"=="4" goto opt_esp_build
if "%opt%"=="5" goto opt_esp_upload
if "%opt%"=="6" goto opt_esp_uploadfs
if "%opt%"=="7" goto opt_esp_monitor
if "%opt%"=="8" goto opt_sim
if "%opt%"=="9" goto opt_bot
if "%opt%"=="10" goto opt_secrets
if "%opt%"=="11" goto opt_clean
if "%opt%"=="0" goto opt_exit

echo.
echo [ERROR] Invalid choice. Press any key to try again...
pause >nul
goto main_menu

:: -------------------------------------------------------------
:opt_dev
cls
echo ========================================================
echo       Starting Web Dashboard (Development Mode)
echo ========================================================
echo.
if not exist "web-dashboard\package.json" (
    echo [ERROR] web-dashboard folder not found!
    pause
    goto main_menu
)
cd web-dashboard
if not exist "node_modules\" (
    echo [INFO] Installing web dependencies...
    call cmd.exe /c "npm install"
)
call cmd.exe /c "npm run dev"
cd ..
pause
goto main_menu

:: -------------------------------------------------------------
:opt_build
cls
echo ========================================================
echo       Building Web Dashboard (Production Build)
echo ========================================================
echo.
cd web-dashboard
call cmd.exe /c "npm run build"
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_deploy
cls
echo ========================================================
echo       Deploying to Firebase Hosting
echo ========================================================
echo.
if not exist "web-dashboard\dist\" (
    echo [INFO] Dist folder not found. Building first...
    cd web-dashboard
    call cmd.exe /c "npm run build"
    cd ..
)
call firebase deploy --only hosting
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_esp_build
cls
echo ========================================================
echo       Compiling ESP32 Firmware
echo ========================================================
echo.
cd esp32-firmware
call "%PIO_CMD%" run
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_esp_upload
cls
echo ========================================================
echo       Uploading Firmware to ESP32 Board
echo ========================================================
echo.
echo [NOTE] Please make sure Serial Monitor is CLOSED before uploading.
echo.
cd esp32-firmware
call "%PIO_CMD%" run --target upload
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_esp_uploadfs
cls
echo ========================================================
echo       Uploading LittleFS Web Files to ESP32 Flash
echo ========================================================
echo.
cd esp32-firmware
call "%PIO_CMD%" run --target uploadfs
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_esp_monitor
cls
echo ========================================================
echo       Opening ESP32 Serial Monitor (115200 baud)
echo ========================================================
echo.
echo [INFO] Press Ctrl+C to close monitor.
echo.
cd esp32-firmware
call "%PIO_CMD%" device monitor
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_sim
cls
echo ========================================================
echo       Starting 6-Hazard Disaster Simulator (Python)
echo ========================================================
echo.
call "%PY_CMD%" simulate_esp32.py
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_bot
cls
echo ========================================================
echo       Starting Telegram Bot Notification Service
echo ========================================================
echo.
call "%PY_CMD%" telegram_bot.py
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_secrets
cls
echo ========================================================
echo       Applying Secrets Configuration
echo ========================================================
echo.
call "%PY_CMD%" setup_secrets.py
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_clean
cls
echo ========================================================
echo       Cleaning Build Cache and Temporary Files
echo ========================================================
echo.
if exist "esp32-firmware\.pio\" (
    echo [CLEAN] Removing PlatformIO build cache...
    rmdir /s /q "esp32-firmware\.pio"
)
if exist "web-dashboard\dist\" (
    echo [CLEAN] Removing Web dist cache...
    rmdir /s /q "web-dashboard\dist"
)
echo [OK] Clean completed.
echo.
pause
goto main_menu

:opt_exit
cls
echo Exiting Smart Building Control Center. Goodbye!
exit /b 0
