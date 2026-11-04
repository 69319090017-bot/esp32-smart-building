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
echo     SMART BUILDING COMMAND CENTER - CONTROL CENTER (2026 HIG EDITION)
echo =======================================================================
echo.
echo   [ WEB DASHBOARD & CLOUD ]
echo     [1] Start Web Dashboard (Vite Dev Mode on localhost:3000)
echo     [2] Build Web Dashboard (Production dist)
echo     [3] Deploy to Vercel (Live Production https://web-dashboard-eta-rust.vercel.app)
echo     [4] Run Web Test Suite (Vitest 161 Tests)
echo     [5] Free Port 3000 / Kill Zombie Web Server Processes
echo.
echo   [ ESP32 HARDWARE FIRMWARE ]
echo     [6] Build ESP32 Firmware (PlatformIO Compile)
echo     [7] Upload Firmware to ESP32 Board
echo     [8] Upload Web Dashboard to ESP32 Flash (LittleFS uploadfs)
echo     [9] Open ESP32 Serial Monitor (115200 baud)
echo.
echo   [ SIMULATORS & NOTIFICATION BOTS ]
echo    [10] Run 6-Hazard Disaster Simulator (Open-Meteo & Weather Hazards)
echo    [11] Run Telegram Bot Notification Service
echo    [12] Run Discord Bot Alert Service (Live Webhooks)
echo    [13] Run MCP Server (Stdio JSON-RPC for AI Agents)
echo.
echo   [ CONFIG & MAINTENANCE ]
echo    [14] Apply Secrets / Update Config (setup_secrets.py)
echo    [15] Clean Cache and Temp Files
echo.
echo     [0] Exit
echo =======================================================================
set "opt="
set /p opt="Please select an option [0-15]: "

if "%opt%"=="1" goto opt_dev
if "%opt%"=="2" goto opt_build
if "%opt%"=="3" goto opt_deploy_vercel
if "%opt%"=="4" goto opt_test
if "%opt%"=="5" goto opt_kill_port
if "%opt%"=="6" goto opt_esp_build
if "%opt%"=="7" goto opt_esp_upload
if "%opt%"=="8" goto opt_esp_uploadfs
if "%opt%"=="9" goto opt_esp_monitor
if "%opt%"=="10" goto opt_sim
if "%opt%"=="11" goto opt_bot
if "%opt%"=="12" goto opt_discord
if "%opt%"=="13" goto opt_mcp
if "%opt%"=="14" goto opt_secrets
if "%opt%"=="15" goto opt_clean
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
:opt_deploy_vercel
cls
echo ========================================================
echo       Deploying to Vercel (Production Live Deployment)
echo ========================================================
echo.
if exist "deploy_vercel.bat" (
    call deploy_vercel.bat
) else (
    cd web-dashboard
    call cmd.exe /c "npm run build"
    cd ..
    call cmd.exe /c "npx vercel deploy --prod"
)
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_test
cls
echo ========================================================
echo       Running Vitest Test Suite (161 Unit & Integration Tests)
echo ========================================================
echo.
cd web-dashboard
call cmd.exe /c "npm test -- --run"
cd ..
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_kill_port
cls
echo ========================================================
echo       Freeing Port 3000 / Killing Zombie Node Processes
echo ========================================================
echo.
powershell -Command "Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('Killed PID ' + $_.OwningProcess + ' on port ' + $_.LocalPort) }"
echo.
echo [OK] Port check completed.
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
call "%PY_CMD%" simulator\simulate_esp32.py
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
call "%PY_CMD%" telegram-bot\telegram_bot.py
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_discord
cls
echo ========================================================
echo       Starting Discord Bot Alert Service
echo ========================================================
echo.
if exist "run_discord_bot.bat" (
    call run_discord_bot.bat
) else (
    call "%PY_CMD%" discord-bot\discord_bot.py
)
echo.
pause
goto main_menu

:: -------------------------------------------------------------
:opt_mcp
cls
echo ========================================================
echo       Starting MCP Server (Stdio JSON-RPC)
echo ========================================================
echo.
node mcp-server\server.js
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
call "%PY_CMD%" scripts\setup_secrets.py
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
