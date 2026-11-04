@echo off
title Deploy to Vercel Production
cd /d "%~dp0"

echo ========================================================
echo       Deploy Web Dashboard to Vercel Production
echo ========================================================
echo.

if not exist "web-dashboard\package.json" (
    echo [ERROR] web-dashboard folder not found!
    pause
    exit /b 1
)

cd web-dashboard
echo [1/3] Building Web Dashboard production bundle...
call npm run build

echo.
echo [2/3] Generating Vercel prebuilt bundle...
call npx vercel build --prod --yes

echo.
echo [3/3] Deploying prebuilt bundle to Vercel...
call npx vercel deploy --prebuilt --prod --yes

echo.
echo ========================================================
echo       Vercel Production Deployment Completed!
echo       Live URL: https://web-dashboard-eta-rust.vercel.app
echo ========================================================
cd ..
pause
