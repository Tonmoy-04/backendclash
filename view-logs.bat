@echo off
REM Quick log viewer for debugging

set LOGDIR=%APPDATA%\inventory-desktop-app\logs

echo ========================================
echo Electron Log Viewer
echo ========================================
echo.
echo Log directory: %LOGDIR%
echo.

if not exist "%LOGDIR%" (
    echo No logs found. App hasn't been run yet.
    echo.
    pause
    exit /b
)

echo Recent log files:
dir /b /o-d "%LOGDIR%\*.log"
echo.

echo [1] Opening log directory in Explorer...
start "" "%LOGDIR%"
echo.

echo [2] Displaying latest Electron log (last 100 lines):
echo ========================================
for /f "delims=" %%F in ('dir /b /o-d "%LOGDIR%\electron-*.log" 2^>nul') do (
    powershell -Command "Get-Content '%LOGDIR%\%%F' -Tail 100"
    goto :found_electron
)
echo No Electron logs found.
:found_electron
echo.

echo [3] Displaying latest Preload log (last 50 lines):
echo ========================================
for /f "delims=" %%F in ('dir /b /o-d "%LOGDIR%\preload-*.log" 2^>nul') do (
    powershell -Command "Get-Content '%LOGDIR%\%%F' -Tail 50"
    goto :found_preload
)
echo No Preload logs found.
:found_preload
echo.

echo ========================================
echo Log Search - Looking for Errors...
echo ========================================
findstr /i /C:"ERROR" /C:"FAILED" /C:"CRASHED" "%LOGDIR%\*.log" 2>nul
if %errorlevel% neq 0 (
    echo No errors found in logs (this is good!)
)
echo.

echo ========================================
echo.
echo Logs displayed above.
echo Log folder opened in Explorer.
echo.
echo To continuously monitor logs:
echo   PowerShell: Get-Content "%LOGDIR%\electron-*.log" -Wait -Tail 50
echo.
pause
