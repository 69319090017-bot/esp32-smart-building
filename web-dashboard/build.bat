@echo off
chcp 65001 >nul
title Web Dashboard - Build
cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
)

call npm run build
pause
