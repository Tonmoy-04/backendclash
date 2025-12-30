@echo off
REM Production Build Script for Inventory Management App
REM This script builds the complete Windows .exe file

echo ========================================
echo Inventory Manager - Production Build
echo ========================================
echo.

REM Step 1: Clean old builds
echo [1/5] Cleaning old builds...
if exist "client\build" rmdir /s /q "client\build"
if exist "server\dist" rmdir /s /q "server\dist"
if exist "dist2" rmdir /s /q "dist2"
echo ✓ Cleaned old builds
echo.

REM Step 2: Install dependencies
echo [2/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ✗ Failed to install root dependencies
    pause
    exit /b 1
)
echo ✓ Root dependencies installed
echo.

REM Step 3: Build React frontend
echo [3/5] Building React frontend...
cd client
call npm run build
if errorlevel 1 (
    echo ✗ Failed to build React app
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✓ React build complete
echo.

REM Step 4: Build Node.js backend
echo [4/5] Building Node.js backend...
cd server
call npm run build
if errorlevel 1 (
    echo ✗ Failed to build server
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✓ Server build complete
echo.

REM Step 5: Build Electron executable
echo [5/5] Building Electron executable...
call npm run build:win
if errorlevel 1 (
    echo ✗ Failed to build Electron app
    pause
    exit /b 1
)
echo ✓ Electron build complete
echo.

echo ========================================
echo Build Completed Successfully!
echo ========================================
echo.
echo Your application is ready in the dist2 folder:
echo   - Portable: dist2\Inventory Manager-1.0.1.exe
echo   - Unpacked: dist2\win-unpacked\
echo.
echo You can now distribute the .exe file to users.
echo.
pause
