@echo off
title Smart Building Command Center - Web Launcher
cd /d "%~dp0"

echo ========================================================
echo   Smart Building Command Center - Web Launcher (2026)
echo ========================================================
echo.
echo [1] เปิดหน้าเว็บทดสอบทันที (Instant Live Mode - พอร์ต 5000)
echo [2] เปิดหน้าเว็บแบบ Vite Dev Mode (Hot-Reload - พอร์ต 3000)
echo.
set /p mode="เลือกโหมด [1 หรือ 2]: "

if "%mode%"=="2" goto opt_vite

:opt_instant
py scripts\run_live_web.py
goto end

:opt_vite
cd web-dashboard
call cmd.exe /c "npm run dev -- --open"
cd ..

:end
pause
