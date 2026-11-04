@echo off
echo ========================================================
echo       Deploy to Firebase Hosting Script
echo ========================================================
echo.

echo [1/2] Building Web Dashboard...
cd web-dashboard
echo Installing dependencies...
call npm install
echo Building project...
call npm run build
cd ..

echo.
echo [2/2] Deploying to Firebase Hosting...
call npx firebase-tools deploy --only hosting

echo.
echo ========================================================
echo       Done! Web updated on Firebase.
echo ========================================================
pause
