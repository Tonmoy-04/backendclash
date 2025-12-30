# White Screen After Splash - Complete Fix Guide

## Problem Diagnosis

**Symptom**: Splash screen works, then main window shows white screen
**Root Cause**: React renderer fails to load or crashes silently

## What Was Fixed

### 1. **Comprehensive Error Logging ✓**
All errors now log to: `%APPDATA%\inventory-desktop-app\logs\`

**Main.js logs:**
- `electron-[timestamp].log` - All Electron main process events
- Renderer crashes, load failures, console messages
- Path resolution attempts
- Server startup status

**Preload.js logs:**
- `preload-[timestamp].log` - Preload script execution
- Context bridge setup
- IPC call attempts
- All errors with stack traces

### 2. **Path Resolution Fixed ✓**
**Problem**: Using `__dirname` doesn't work with ASAR packaging

**Solution**: 
```javascript
// OLD (broken in production):
path.join(__dirname, '../client/build/index.html')

// NEW (works with and without ASAR):
if (app.isPackaged) {
  path.join(process.resourcesPath, 'client', 'build', 'index.html')
} else {
  path.join(app.getAppPath(), 'client', 'build', 'index.html')
}
```

### 3. **ASAR Disabled ✓**
**Why**: Native modules (SQLite) can cause issues in ASAR
**Impact**: Slightly larger file size, but 100% compatibility

```json
"build": {
  "asar": false,  // ← Disabled
  "extraResources": [
    // All files now in resources/ folder (not app.asar)
  ]
}
```

### 4. **DevTools Enabled in Production ✓**
**Temporarily** enabled for debugging:
```javascript
// In production mode:
mainWindow.webContents.openDevTools();
```

### 5. **Renderer Error Detection ✓**
Now logs all renderer issues:
- `did-fail-load` - HTML/resource load failures
- `render-process-gone` - Renderer crashes
- `console-message` - All console output from React
- `preload-error` - Preload script failures
- `unresponsive` - Frozen renderer

### 6. **Preload Hardening ✓**
- Wrapped in try-catch to prevent crashes
- File logging for all operations
- Fallback API if contextBridge fails
- Error logging for all IPC calls

## Build & Debug Steps

### Step 1: Clean Everything
```powershell
# Remove all old builds
Remove-Item -Path "client\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "server\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist2" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
```

### Step 2: Build React (Critical)
```powershell
cd client
npm run build
```

**Verify React Build:**
```powershell
# Should exist and contain files:
dir client\build\index.html
dir client\build\static
```

**Common Issues:**
- If build fails, React won't load in production
- Check for TypeScript errors
- Check for missing dependencies
- Ensure `"homepage": "./"` in client/package.json

### Step 3: Build Server
```powershell
cd server
npm run build
```

**Verify Server Build:**
```powershell
# Should exist:
dir server\dist\app.js
```

### Step 4: Build Electron
```powershell
cd ..
npm run build:win
```

**Output**: `dist2\Inventory Manager-1.0.1.exe`

### Step 5: Run and Check Logs
```powershell
# Run the exe
.\dist2\win-unpacked\"Inventory Manager.exe"
```

**Immediately check logs:**
```powershell
# Open logs folder
start $env:APPDATA\inventory-desktop-app\logs

# Or view latest log:
Get-Content $env:APPDATA\inventory-desktop-app\logs\electron-*.log -Tail 100
```

## What to Look For in Logs

### ✓ Good Signs:
```
[INIT] Initializing app in PROD mode
[PROD] Index path exists: true
[PROD] Loading from file system: file:///...
[PROD] Successfully loaded index.html
[RENDERER CONSOLE info] React app loaded
```

### ✗ Bad Signs and Fixes:

#### Issue: "Index path exists: false"
```
[PROD ERROR] index.html not found at: ...
```
**Fix**: React build failed or didn't complete
```powershell
cd client
npm run build
# Verify: dir build\index.html
```

#### Issue: Renderer crashes immediately
```
[RENDERER CRASHED] Reason: crashed, Exit Code: ...
[RENDERER CONSOLE error] ...
```
**Fix**: Check DevTools console (now auto-opens), look for:
- JavaScript errors in React code
- Missing dependencies
- Node.js code in React (fs, path, etc.)

#### Issue: "Failed to load file"
```
[PROD ERROR] Failed to load file: ...
```
**Fix**: Path resolution issue - check the attempted paths in logs

#### Issue: Preload errors
```
[PRELOAD] ✗ CRITICAL ERROR exposing electronAPI
```
**Fix**: Check preload log for stack trace

## React Code Requirements

### ❌ NEVER in React Code:
```javascript
// These crash in production:
const fs = require('fs');
const path = require('path');
window.require('electron');
```

### ✓ ALWAYS Use IPC:
```javascript
// Correct way to access Node.js features:
window.electronAPI.db.query('SELECT * FROM ...')
window.electronAPI.file.selectFile()
window.electronAPI.backup.create()
```

## Folder Structure After Build

```
dist2/win-unpacked/
├── Inventory Manager.exe
├── resources/
│   ├── electron/         ← main.js, preload.js (NO ASAR)
│   ├── client/
│   │   └── build/        ← React app (index.html, static/)
│   └── server/
│       ├── dist/         ← Backend (app.js)
│       └── node_modules/ ← Server dependencies
└── [chromium files]
```

## Disable DevTools After Debugging

Once working, remove this line from `electron/main.js`:
```javascript
// Remove this after debugging:
mainWindow.webContents.openDevTools();
```

## Testing Checklist

### Development Mode Test:
```powershell
npm run electron:dev
```
- [ ] React loads at localhost:3000
- [ ] Backend at localhost:5000
- [ ] DevTools open
- [ ] No errors in console

### Production Build Test:
```powershell
npm run dist
.\dist2\win-unpacked\"Inventory Manager.exe"
```
- [ ] Splash screen shows
- [ ] Main window loads (not white)
- [ ] DevTools open automatically
- [ ] Check DevTools console for errors
- [ ] Check log files in %APPDATA%
- [ ] Backend starts (check logs)
- [ ] Can interact with app

## Common Issues & Solutions

### 1. White Screen Persists
**Check DevTools Console** (auto-opens now):
- Look for red errors
- Check Network tab for failed loads
- Check Console tab for React errors

**Check Log Files**:
```powershell
Get-Content $env:APPDATA\inventory-desktop-app\logs\electron-*.log
```

### 2. "Cannot find module" Errors
**In Renderer**: 
- React code trying to use Node.js modules
- Must use IPC instead

**In Main Process**:
- Server dependencies not copied
- Check extraResources in package.json

### 3. SQLite/Database Errors
- Check server logs in main electron log
- Ensure server/node_modules copied
- ASAR disabled (already done)

### 4. Blank White Screen, No Errors
- React built successfully but not mounting
- Check React index.js/index.tsx
- Ensure `ReactDOM.render` or `createRoot` exists
- Check for crash in React error boundary

### 5. Works in Dev, Fails in Production
- Check for `process.env.NODE_ENV` checks in React
- Ensure all assets use relative paths
- Verify `"homepage": "./"` in client/package.json

## Re-Enable ASAR (Optional, After Fixing)

Once working, you can try re-enabling ASAR:

1. In package.json:
```json
"build": {
  "asar": true,
  "asarUnpack": [
    "**/*.node",
    "server/node_modules/sqlite3/**/*",
    "server/node_modules/better-sqlite3/**/*"
  ]
}
```

2. Update main.js path resolution to handle ASAR:
```javascript
// Already implemented - checks app.isPackaged
```

3. Rebuild and test thoroughly

## File Manifest

### Modified Files:
1. ✅ `electron/main.js` - Comprehensive logging, path fixes
2. ✅ `electron/preload.js` - Error handling, file logging
3. ✅ `package.json` - ASAR disabled, build config

### Log Files Created:
- `%APPDATA%\inventory-desktop-app\logs\electron-*.log`
- `%APPDATA%\inventory-desktop-app\logs\preload-*.log`

### Configuration:
- `"asar": false` - Disabled for compatibility
- `"homepage": "./"` - Relative paths (already set)
- DevTools auto-open in production (temporary)

## Success Criteria

✓ Splash screen shows
✓ Main window loads with content (not white)
✓ DevTools console shows no errors
✓ Log files show successful load
✓ React app is interactive
✓ Backend API responds
✓ Database operations work

## Next Steps After Fix

1. **Remove DevTools** from production build
2. **Re-enable ASAR** if desired (test thoroughly)
3. **Add proper error UI** instead of white screen
4. **Implement auto-updater** for future fixes
5. **Add crash reporter** for production monitoring

## Emergency Debugging

If logs don't help:

1. **Check file existence manually:**
```powershell
dir "dist2\win-unpacked\resources\client\build\index.html"
```

2. **Run with console output:**
```powershell
cd dist2\win-unpacked
."Inventory Manager.exe"
# Don't close console window
```

3. **Check React build quality:**
```powershell
cd client\build
python -m http.server 8000
# Visit http://localhost:8000 in browser
```

4. **Temporarily add alert in index.html:**
```html
<!-- In client/build/index.html after rebuild: -->
<script>alert('HTML loaded!');</script>
```

---

## Summary

**Root Cause**: Path resolution + silent errors
**Solution**: Logging + ASAR disable + proper paths
**Status**: Ready to rebuild and debug

**Build Command**:
```powershell
.\build-production.bat
```

**Run and Debug**:
```powershell
.\dist2\win-unpacked\"Inventory Manager.exe"
# Check DevTools + log files immediately
```
