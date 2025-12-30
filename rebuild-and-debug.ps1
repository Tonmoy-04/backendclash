# Complete rebuild and test with automatic log monitoring
# Run this script, then run the exe, and logs will stream to console

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Rebuild & Debug Workflow" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean
Write-Host "[1/5] Cleaning old builds..." -ForegroundColor Yellow
Remove-Item -Path "client\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "server\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist2" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Cleaned" -ForegroundColor Green
Write-Host ""

# Step 2: Build React
Write-Host "[2/5] Building React frontend..." -ForegroundColor Yellow
Set-Location client
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ React build failed!" -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}
Set-Location ..
Write-Host "  ✓ React build complete" -ForegroundColor Green
Write-Host ""

# Step 3: Build Server
Write-Host "[3/5] Building Node.js backend..." -ForegroundColor Yellow
Set-Location server
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Server build failed!" -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}
Set-Location ..
Write-Host "  ✓ Server build complete" -ForegroundColor Green
Write-Host ""

# Step 4: Build Electron
Write-Host "[4/5] Building Electron executable..." -ForegroundColor Yellow
npm run build:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Electron build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  ✓ Electron build complete" -ForegroundColor Green
Write-Host ""

# Step 5: Verify
Write-Host "[5/5] Verifying build artifacts..." -ForegroundColor Yellow
$exePath = "dist2\win-unpacked\Inventory Manager.exe"
$indexPath = "dist2\win-unpacked\resources\client\build\index.html"
$serverPath = "dist2\win-unpacked\resources\server\dist\app.js"

if (Test-Path $exePath) {
    Write-Host "  ✓ Executable exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ Executable NOT found!" -ForegroundColor Red
}

if (Test-Path $indexPath) {
    Write-Host "  ✓ React build included" -ForegroundColor Green
} else {
    Write-Host "  ✗ React build NOT included!" -ForegroundColor Red
}

if (Test-Path $serverPath) {
    Write-Host "  ✓ Server build included" -ForegroundColor Green
} else {
    Write-Host "  ✗ Server build NOT included!" -ForegroundColor Red
}
Write-Host ""

# Prepare log monitoring
$logDir = "$env:APPDATA\inventory-desktop-app\logs"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Executable location:" -ForegroundColor Yellow
Write-Host "  $exePath" -ForegroundColor White
Write-Host ""
Write-Host "Logs will be saved to:" -ForegroundColor Yellow
Write-Host "  $logDir" -ForegroundColor White
Write-Host ""

# Offer to run and monitor
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run the executable (it will open in a new window)" -ForegroundColor White
Write-Host "  2. DevTools will auto-open - check Console tab" -ForegroundColor White
Write-Host "  3. Logs will stream below (if you choose to monitor)" -ForegroundColor White
Write-Host ""

$response = Read-Host "Do you want to run the app and monitor logs? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "Starting application..." -ForegroundColor Yellow
    
    # Start the app in background
    Start-Process -FilePath $exePath
    
    # Wait a moment for logs to start
    Start-Sleep -Seconds 2
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Live Log Stream" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Monitor logs
    if (Test-Path $logDir) {
        $latestLog = Get-ChildItem -Path $logDir -Filter "electron-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestLog) {
            Write-Host "Monitoring: $($latestLog.FullName)" -ForegroundColor Green
            Write-Host ""
            Get-Content -Path $latestLog.FullName -Wait -Tail 50
        } else {
            Write-Host "No log file found yet. Run the app first." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Log directory doesn't exist yet. Run the app to generate logs." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "To run the app manually:" -ForegroundColor Yellow
    Write-Host "  .\dist2\win-unpacked\`"Inventory Manager.exe`"" -ForegroundColor White
    Write-Host ""
    Write-Host "To view logs after running:" -ForegroundColor Yellow
    Write-Host "  .\view-logs.bat" -ForegroundColor White
    Write-Host "  OR: Get-Content `$env:APPDATA\inventory-desktop-app\logs\electron-*.log -Tail 100" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
