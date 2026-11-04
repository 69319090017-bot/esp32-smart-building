@echo off
echo =========================================
echo  Cleaning Build and Node Modules...
echo =========================================
echo.

if exist "dist" (
    echo Deleting dist folder...
    rmdir /s /q "dist"
    echo [OK] dist removed.
) else (
    echo [SKIP] dist folder not found.
)

if exist "node_modules" (
    echo Deleting node_modules folder...
    rmdir /s /q "node_modules"
    echo [OK] node_modules removed.
) else (
    echo [SKIP] node_modules folder not found.
)

echo.
echo =========================================
echo  Cleanup Complete!
echo  (Run 'npm install' when you want to run the project again)
echo =========================================
pause
