@echo off
REM Diagnostic script to check build artifacts and logs

echo ========================================
echo Build Diagnostic Tool
echo ========================================
echo.

echo [1] Checking React Build...
if exist "client\build\index.html" (
    echo ✓ React index.html exists
    dir "client\build\index.html" | find "index.html"
) else (
    echo ✗ React build missing! Run: cd client ^&^& npm run build
)

if exist "client\build\static" (
    echo ✓ React static folder exists
) else (
    echo ✗ React static folder missing!
)
echo.

echo [2] Checking Server Build...
if exist "server\dist\app.js" (
    echo ✓ Server app.js exists
    dir "server\dist\app.js" | find "app.js"
) else (
    echo ✗ Server build missing! Run: cd server ^&^& npm run build
)
echo.

echo [3] Checking Electron Build...
if exist "dist2\win-unpacked\Inventory Manager.exe" (
    echo ✓ Electron exe exists
    dir "dist2\win-unpacked\Inventory Manager.exe" | find "Inventory Manager.exe"
) else (
    echo ✗ Electron build missing! Run: npm run build:win
)
echo.

echo [4] Checking Build Resources...
if exist "dist2\win-unpacked\resources\client\build\index.html" (
    echo ✓ React build included in Electron package
) else (
    echo ✗ React build NOT included in package!
)

if exist "dist2\win-unpacked\resources\server\dist\app.js" (
    echo ✓ Server build included in Electron package
) else (
    echo ✗ Server build NOT included in package!
)

if exist "dist2\win-unpacked\resources\electron\main.js" (
    echo ✓ Electron main.js included
) else (
    echo ✗ Electron files NOT included!
)
echo.

echo [5] Checking Logs...
set LOGDIR=%APPDATA%\inventory-desktop-app\logs
if exist "%LOGDIR%" (
    echo ✓ Log directory exists: %LOGDIR%
    echo.
    echo Recent log files:
    dir /b /o-d "%LOGDIR%\*.log" 2>nul
    echo.
    echo To view latest log:
    echo Get-Content "%LOGDIR%\electron-*.log" -Tail 50
) else (
    echo ⚠ No logs yet - app hasn't run
)
echo.

echo [6] Package.json Configuration...
findstr /C:"\"homepage\"" client\package.json >nul
if %errorlevel% equ 0 (
    echo ✓ Homepage field exists in client/package.json
    findstr /C:"\"homepage\"" client\package.json
) else (
    echo ✗ Homepage field missing!
)

findstr /C:"\"asar\"" package.json >nul
if %errorlevel% equ 0 (
    echo ✓ ASAR configuration found
    findstr /C:"\"asar\"" package.json
) else (
    echo ⚠ ASAR setting not found
)
echo.

echo ========================================
echo Diagnostic Complete
echo ========================================
echo.

echo Next Steps:
echo 1. If any builds are missing, run: .\build-production.bat
echo 2. If builds exist but app fails, check logs in: %LOGDIR%
echo 3. Run app with: .\dist2\win-unpacked\"Inventory Manager.exe"
echo 4. DevTools will auto-open - check console for errors
echo.

pause
