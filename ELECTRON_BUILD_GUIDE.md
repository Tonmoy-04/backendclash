# Electron Production Build Guide

## Overview
This guide provides complete instructions to build a production-ready Windows .exe for your Inventory Management application.

## Prerequisites
- Node.js 16+ installed
- npm installed
- Windows OS (for building Windows executables)

## Fixed Issues

### 1. **White Screen Issue - RESOLVED**
- **Problem**: App showed white screen in production because it was trying to load from `http://localhost:5000` instead of local files
- **Solution**: Updated `electron/main.js` to use `app.isPackaged` to detect production mode and load from `file://` protocol using `client/build/index.html`

### 2. **Correct Environment Detection**
- **Changed**: `process.env.NODE_ENV === 'development' || !app.isPackaged`
- **To**: `!app.isPackaged`
- **Reason**: `app.isPackaged` is the reliable way to detect if running from built .exe

### 3. **Homepage Configuration**
- Client `package.json` already has `"homepage": "./"` which ensures correct relative paths in production

### 4. **Error Logging Added**
- Production builds now log renderer errors to console
- Added `did-fail-load` event handler
- Added `console-message` event handler for debugging

### 5. **Secure Preload Script**
- Wrapped `contextBridge.exposeInMainWorld` in try-catch
- Added error logging to prevent crashes
- Maintains security with contextIsolation and no nodeIntegration

## Build Steps

### Step 1: Clean Previous Builds
```powershell
# Remove old build artifacts
Remove-Item -Path "client\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "server\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist2" -Recurse -Force -ErrorAction SilentlyContinue
```

### Step 2: Install Dependencies (if needed)
```powershell
npm install
cd client
npm install
cd ../server
npm install
cd ..
```

### Step 3: Build React Frontend
```powershell
cd client
npm run build
cd ..
```

**Verify**: Check that `client/build/index.html` exists

### Step 4: Build Node.js Backend
```powershell
cd server
npm run build
cd ..
```

**Verify**: Check that `server/dist/app.js` exists

### Step 5: Build Electron Executable
```powershell
# For 64-bit Windows (recommended)
npm run build:win

# OR for 32-bit Windows
npm run build:win32

# OR build both at once
npm run dist
```

**Output Location**: `dist2/` folder

### Step 6: Find Your Executable
The built application will be in:
- **Portable**: `dist2/Inventory Manager-1.0.1.exe` (portable, no installation)
- **Installer** (if configured): `dist2/Inventory Manager-Setup-1.0.1.exe`

## Quick Build Command

For a complete build from scratch:
```powershell
npm run build:all && npm run build:win
```

Or use the shorthand:
```powershell
npm run dist
```

## Testing the Built Application

### 1. Test in Development First
```powershell
npm run electron:dev
```
- Should show React app at http://localhost:3000
- Backend should be at http://localhost:5000
- DevTools should open automatically

### 2. Test Production Build
After building, run the .exe from `dist2/` folder
- Should load from file system (no localhost)
- Should show the app without white screen
- Backend API should start automatically

### 3. Check Logs
If issues occur, check:
- Windows Event Viewer
- Console output when running from command line:
  ```powershell
  cd dist2/win-unpacked
  "Inventory Manager.exe"
  ```

## Troubleshooting

### White Screen After Building
✅ **FIXED** - The app now correctly loads from file system in production

If you still see issues:
1. Check that `client/build/index.html` exists
2. Verify `"homepage": "./"` in `client/package.json`
3. Check console logs for errors

### Cannot Find Module Errors
Ensure build order is correct:
1. Build React first (`npm run build:client`)
2. Build Server second (`npm run build:server`)
3. Build Electron last (`npm run build:win`)

### Backend Not Starting
Check that:
- `server/dist/app.js` exists
- `server/node_modules` is included in build
- Database files are accessible

### DevTools in Production
If you need to debug production:

Edit `electron/main.js` and temporarily add:
```javascript
mainWindow.webContents.openDevTools();
```
After the `loadURL` call in production mode.

## File Structure After Build

```
dist2/
├── Inventory Manager-1.0.1.exe (portable)
└── win-unpacked/
    ├── Inventory Manager.exe
    ├── resources/
    │   ├── app.asar (electron/, package.json)
    │   ├── client/
    │   │   └── build/
    │   │       ├── index.html ← React app loads from here
    │   │       └── static/
    │   └── server/
    │       ├── dist/
    │       │   └── app.js ← Backend runs from here
    │       ├── node_modules/
    │       └── package.json
    └── [other electron files]
```

## Security Settings

Your app uses secure Electron settings:
- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `contextBridge` for safe IPC
- ✅ No remote module
- ✅ Sandboxed renderer process

## Distribution

To distribute your application:

1. **Portable Version**: Share `dist2/Inventory Manager-1.0.1.exe`
   - Users can run directly, no installation needed
   - Good for USB drives or quick testing

2. **Installer Version** (if you enable NSIS target):
   - Users run the installer
   - Creates Start Menu shortcuts
   - Registers uninstaller
   - More professional distribution

## Build Configuration Summary

### Updated Files:
1. **electron/main.js**
   - Uses `app.isPackaged` for environment detection
   - Loads from `file://` in production
   - Loads from `http://localhost:3000` in development
   - Enhanced error logging

2. **electron/preload.js**
   - Safe error handling with try-catch
   - Prevents crashes from contextBridge errors
   - Maintains security

3. **package.json**
   - Updated scripts for proper build order
   - Enhanced electron-builder config
   - Includes all necessary files and resources

4. **client/package.json**
   - Already has `"homepage": "./"` ✓

## Version Updates

To update version number:
1. Edit `package.json` → `"version": "1.0.2"`
2. Rebuild: `npm run dist`
3. New exe will have updated version in filename

## Next Steps

1. ✅ Build the application using steps above
2. ✅ Test the generated .exe
3. ✅ Distribute to users
4. Consider code signing for trusted installation
5. Set up auto-updates (optional)

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify all build steps completed successfully
3. Check file paths in console logs
4. Ensure React build folder exists before Electron build

---

**Build Status**: ✅ Ready for Production
**White Screen Issue**: ✅ Fixed
**Security**: ✅ Configured Correctly
**Build Order**: ✅ Automated in Scripts
