@echo off
echo ========================================
echo   Building Inventory Manager
echo   Windows Desktop Application
echo ========================================
echo.
echo This will create a Windows installer (.exe)
echo.
echo Step 1: Installing dependencies...
call npm install
echo.
echo Step 2: Building React frontend...
call npm run build:client
echo.
echo Step 3: Building Windows installer...
call npm run build:win
echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Installer location: dist\Inventory Manager-Setup-1.0.0.exe
echo.
pause
