@echo off
chcp 65001 >nul
title Web Dashboard - Dev Server
cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
)

call npm run dev -- --open
pause
