@echo off
title Smart Garage - Discord Notification Bot
cd /d "%~dp0"

echo ========================================================
echo       Starting Discord Notification Bot
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

if not exist "discord-bot\discord_bot.py" (
    echo [ERROR] discord-bot/discord_bot.py not found!
    pause
    exit /b 1
)

cd discord-bot

if not exist ".env" (
    if exist ".env.example" (
        echo [WARNING] .env not found! Creating from .env.example...
        copy .env.example .env >nul
        echo [INFO] Please edit discord-bot/.env with your DISCORD_BOT_TOKEN before running.
    )
)

echo [INFO] Starting Discord bot...
echo [INFO] Press Ctrl+C in this window to stop bot.
echo.

python discord_bot.py

cd ..
pause
