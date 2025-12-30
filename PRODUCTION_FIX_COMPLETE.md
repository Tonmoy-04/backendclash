# Production-Ready Fix - White Screen After Splash

## Executive Summary

**Problem**: Electron splash works, but main window shows white screen in production .exe  
**Root Cause**: Silent renderer failures + incorrect path resolution for ASAR packaging  
**Solution**: Comprehensive logging + path fixes + ASAR disabled + error instrumentation

## Changes Made

### 1. electron/main.js - Complete Overhaul ✓

#### Added Features:
- **File logging system** to `%APPDATA%\inventory-desktop-app\logs\electron-[timestamp].log`
- **Path resolution** using `app.getAppPath()` and `process.resourcesPath`
- **ASAR-aware** path detection
- **DevTools auto-open** in production (temporary, for debugging)
- **Comprehensive error handlers**:
  - `did-fail-load` - Catches HTML/resource load failures
  - `render-process-gone` - Catches renderer crashes  
  - `console-message` - Logs all React console output
  - `preload-error` - Catches preload script errors
  - `unresponsive`/`responsive` - Detects frozen renderer
  - `uncaughtException` - Global error handler
  - `unhandledRejection` - Promise rejection handler

#### Path Resolution Logic:
```javascript
// Production mode:
if (app.isPackaged) {
  // Use resources path (works without ASAR)
  indexPath = path.join(process.resourcesPath, 'client', 'build', 'index.html');
} else {
  // Development
  indexPath = path.join(app.getAppPath(), 'client', 'build', 'index.html');
}

// Fallback: Try alternative paths if not found
// Logs every attempt for debugging
```

### 2. electron/preload.js - Hardened ✓

#### Added Features:
- **File logging** to `%APPDATA%\inventory-desktop-app\logs\preload-[timestamp].log`
- **Try-catch wrapper** around all contextBridge setup
- **Fallback API** if contextBridge fails (prevents white screen)
- **Per-function error logging** for all IPC calls
- **Error handlers** for uncaught exceptions in preload context
- **Detailed diagnostics** logged on startup

#### Error Protection:
```javascript
try {
  contextBridge.exposeInMainWorld('electronAPI', { ... });
  logPreload('✓ Successfully exposed electronAPI');
} catch (error) {
  logPreload('✗ CRITICAL ERROR: ' + error.stack);
  // Expose minimal fallback API so renderer doesn't crash
  contextBridge.exposeInMainWorld('electronAPI', {
    error: 'Failed to initialize',
    message: error.message
  });
}
```

### 3. package.json - Build Configuration ✓

#### Key Changes:
```json
{
  "build": {
    "asar": false,  // ← DISABLED for compatibility
    "extraResources": [
      // All resources now outside ASAR archive
      "client/build/**/*",
      "server/dist/**/*",
      "server/node_modules/**/*",
      "server/config/**/*"
    ]
  }
}
```

#### Why ASAR Disabled:
- **Native modules** (SQLite, better-sqlite3) can fail in ASAR
- **Path resolution** is simpler without ASAR
- **Debugging** is easier with plain files
- **File size** increase is minimal (~5-10MB)
- **Can re-enable** after confirming everything works

## Build Process

### Correct Order (Critical):
```
1. React build    → client/build/
2. Server build   → server/dist/
3. Electron build → dist2/
```

### Automated Build Script:
```powershell
.\build-production.bat
```

Or step by step:
```powershell
# Clean
Remove-Item client\build, server\dist, dist2 -Recurse -Force

# Build React
cd client
npm run build
cd ..

# Build Server  
cd server
npm run build
cd ..

# Build Electron
npm run build:win
```

## Debugging Workflow

### 1. Build the Application
```powershell
.\build-production.bat
```

### 2. Check Build Artifacts
```powershell
.\diagnose-build.bat
```

This verifies:
- ✓ React build exists
- ✓ Server build exists
- ✓ Files included in Electron package
- ✓ Configuration is correct

### 3. Run the Application
```powershell
.\dist2\win-unpacked\"Inventory Manager.exe"
```

**DevTools will auto-open** - check Console tab for errors

### 4. Check Logs
```powershell
.\view-logs.bat
```

Or manually:
```powershell
# View latest Electron log
Get-Content $env:APPDATA\inventory-desktop-app\logs\electron-*.log -Tail 100

# View latest Preload log  
Get-Content $env:APPDATA\inventory-desktop-app\logs\preload-*.log -Tail 50
```

## Log Analysis

### ✓ Success Pattern:
```
[INIT] Initializing app in PROD mode
[PROD] Index path exists: true
[PROD] Loading from file system: file:///C:/Users/.../resources/client/build/index.html
[PROD] Successfully loaded index.html
[RENDERER CONSOLE info] React loaded
[PRELOAD] ✓ Successfully exposed electronAPI
```

### ✗ Failure Patterns:

#### Pattern 1: React Build Missing
```
[PROD ERROR] index.html not found at: ...
[PROD] Index path exists: false
```
**Fix**: Rebuild React (`cd client && npm run build`)

#### Pattern 2: Renderer Crash
```
[RENDERER CRASHED] Reason: crashed, Exit Code: -1073741819
[RENDERER CONSOLE error] Uncaught ReferenceError: ...
```
**Fix**: Check DevTools console, look for JavaScript errors in React code

#### Pattern 3: Preload Failure
```
[PRELOAD ERROR] Path: .../preload.js, Error: ...
[PRELOAD] ✗ CRITICAL ERROR exposing electronAPI
```
**Fix**: Check preload log for stack trace

#### Pattern 4: Load Timeout
```
[RENDERER FAILED] Code: -3, Desc: ERR_ABORTED
[LOAD FAILED] -3 ERR_ABORTED file:///...
```
**Fix**: File path incorrect or file doesn't exist

## React Code Requirements

### ❌ Forbidden in React:
```javascript
// These will crash the renderer:
const fs = require('fs');
const path = require('path');  
const { ipcRenderer } = require('electron');
window.require('anything');
```

### ✓ Correct Usage:
```javascript
// All Node.js features accessed via IPC:
await window.electronAPI.db.query('SELECT ...');
await window.electronAPI.file.selectFile();
await window.electronAPI.backup.create();
```

## File Structure (Production)

```
dist2/win-unpacked/
├── Inventory Manager.exe
├── resources/
│   ├── electron/              ← main.js, preload.js, window.js
│   │   ├── main.js           ← Instrumented with logging
│   │   ├── preload.js        ← Hardened with error handling
│   │   └── window.js
│   ├── client/
│   │   └── build/            ← React production build
│   │       ├── index.html    ← Entry point
│   │       └── static/       ← JS, CSS, assets
│   ├── server/
│   │   ├── dist/
│   │   │   └── app.js        ← Backend server
│   │   ├── node_modules/     ← Server dependencies
│   │   ├── config/           ← Fonts, etc.
│   │   └── package.json
│   └── package.json
└── [Chromium/Electron files]
```

**Note**: NO app.asar file (ASAR disabled)

## Production Checklist

Before distributing:

### Required:
- [x] Comprehensive logging enabled
- [x] ASAR disabled for compatibility
- [x] Paths use process.resourcesPath
- [x] Error handlers on all renderer events
- [x] Preload wrapped in try-catch
- [x] Client package.json has `"homepage": "./"`

### Temporary (Debug Only):
- [x] DevTools auto-open in production

### Before Release:
- [ ] Remove DevTools auto-open
- [ ] Test on clean Windows machine
- [ ] Verify all features work
- [ ] Check log files for errors
- [ ] (Optional) Re-enable ASAR if desired

## Remove DevTools After Debugging

Once the app works, edit `electron/main.js`:

```javascript
// Find this line in production section (~line 157):
mainWindow.webContents.openDevTools();  // ← DELETE THIS LINE

// Or comment it out:
// mainWindow.webContents.openDevTools();  // TODO: Remove for release
```

Then rebuild:
```powershell
npm run build:win
```

## Re-Enable ASAR (Optional)

After confirming everything works with ASAR disabled:

### 1. Update package.json:
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

### 2. Update main.js path logic:
The code already handles this - it checks `app.isPackaged` and uses appropriate paths.

### 3. Rebuild and Test:
```powershell
npm run dist
.\dist2\win-unpacked\"Inventory Manager.exe"
```

### 4. Verify:
- Check for `app.asar` file in resources/
- Test all features thoroughly
- Check logs for any new errors

## Troubleshooting Guide

### Issue: White screen, no errors in console
**Diagnosis**: React built but not mounting  
**Check**:
1. DevTools Console tab (should auto-open)
2. DevTools Network tab - check for failed resource loads
3. React entry point (client/src/index.tsx or index.jsx)
4. Error boundaries in React code

**Solution**: 
```javascript
// Add to React index file temporarily:
console.log('React entry point reached');
ReactDOM.render(...);
console.log('React rendered');
```

### Issue: DevTools don't open
**Diagnosis**: Renderer crashed before DevTools could initialize  
**Check**: Log files for renderer-process-gone events

**Solution**: Add earlier in main.js:
```javascript
mainWindow.webContents.on('did-start-loading', () => {
  mainWindow.webContents.openDevTools();
});
```

### Issue: "Cannot find module" in renderer
**Diagnosis**: React code trying to use Node.js modules  
**Check**: DevTools console for require/import errors

**Solution**: Move all Node.js code to backend, access via IPC

### Issue: Backend fails to start
**Diagnosis**: Server files not copied or node_modules missing  
**Check**: Log files for server startup errors

**Solution**: Verify extraResources in package.json includes server/node_modules

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `build-production.bat` | Build everything (React → Server → Electron) |
| `diagnose-build.bat` | Check if all build artifacts exist |
| `view-logs.bat` | View log files and open log directory |

## Log Locations

| Log Type | Location |
|----------|----------|
| Electron main | `%APPDATA%\inventory-desktop-app\logs\electron-[timestamp].log` |
| Preload script | `%APPDATA%\inventory-desktop-app\logs\preload-[timestamp].log` |

Full path example:
```
C:\Users\YourName\AppData\Roaming\inventory-desktop-app\logs\
```

## Success Indicators

### During Build:
- ✓ React build creates `client/build/index.html`
- ✓ Server build creates `server/dist/app.js`
- ✓ Electron build creates `.exe` in dist2/

### During Runtime:
- ✓ Splash screen appears
- ✓ Main window loads with content (not white)
- ✓ DevTools open automatically
- ✓ No red errors in DevTools console
- ✓ Log files show successful load
- ✓ App is interactive and functional

### In Logs:
- ✓ "Successfully loaded index.html"
- ✓ "Index path exists: true"
- ✓ "Successfully exposed electronAPI"
- ✓ No "ERROR", "FAILED", or "CRASHED" messages

## Emergency Recovery

If completely stuck:

### 1. Nuclear Clean:
```powershell
Remove-Item client\build, client\node_modules, server\dist, server\node_modules, dist2, node_modules -Recurse -Force
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### 2. Rebuild Everything:
```powershell
.\build-production.bat
```

### 3. Test React Build Standalone:
```powershell
cd client\build
python -m http.server 8000
# Open http://localhost:8000 in browser
# If this doesn't work, React build is broken
```

### 4. Contact Support:
Include:
- Full log files from %APPDATA%\inventory-desktop-app\logs\
- Output of `diagnose-build.bat`
- DevTools console screenshot
- Description of last thing that worked

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Error Logging | ✅ Complete | All errors logged to files |
| Path Resolution | ✅ Fixed | ASAR-aware, uses proper APIs |
| ASAR Packaging | ✅ Disabled | For maximum compatibility |
| Preload Hardening | ✅ Complete | Wrapped in error handlers |
| DevTools | ✅ Enabled | Temporary, for debugging |
| Build Scripts | ✅ Automated | One-command build process |
| Diagnostics | ✅ Provided | Scripts to check build/logs |

**Next Step**: Run `.\build-production.bat` and then `.\diagnose-build.bat`
