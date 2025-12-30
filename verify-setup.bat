@echo off
echo ========================================
echo   Electron Setup Verification
echo ========================================
echo.

echo Checking Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo OK: Node.js is installed
echo.

echo Checking npm installation...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm is not available!
    pause
    exit /b 1
)
echo OK: npm is installed
echo.

echo Checking project dependencies...
if not exist "node_modules\" (
    echo WARNING: Dependencies not installed
    echo Run: npm install
) else (
    echo OK: Root dependencies found
)
echo.

if not exist "client\node_modules\" (
    echo WARNING: Client dependencies not installed
) else (
    echo OK: Client dependencies found
)
echo.

if not exist "server\node_modules\" (
    echo WARNING: Server dependencies not installed
) else (
    echo OK: Server dependencies found
)
echo.

echo Checking required files...
if not exist "electron\main.js" (
    echo ERROR: electron/main.js not found!
) else (
    echo OK: electron/main.js found
)

if not exist "electron\window.js" (
    echo ERROR: electron/window.js not found!
) else (
    echo OK: electron/window.js found
)

if not exist "electron\preload.js" (
    echo ERROR: electron/preload.js not found!
) else (
    echo OK: electron/preload.js found
)

if not exist "package.json" (
    echo ERROR: package.json not found!
) else (
    echo OK: package.json found
)
echo.

echo Checking Electron installation...
if exist "node_modules\electron\" (
    echo OK: Electron is installed
) else (
    echo WARNING: Electron not found in node_modules
    echo Run: npm install
)
echo.

echo ========================================
echo   Verification Complete
echo ========================================
echo.
echo Next steps:
echo 1. If dependencies missing: npm install
echo 2. To run development: npm run electron:dev
echo 3. To build: npm run dist
echo.
pause
