# Quick Start - Build Production Executable

## One-Step Build (Recommended)

### Option 1: Using Batch Script
```powershell
.\build-production.bat
```

### Option 2: Using npm
```powershell
npm run dist
```

Both commands will:
1. Clean old builds
2. Build React frontend
3. Build Node.js backend
4. Create Windows .exe

## Output

Your executable will be at:
```
dist2\Inventory Manager-1.0.1.exe
```

## Run & Test

```powershell
.\dist2\Inventory Manager-1.0.1.exe
```

Should load **WITHOUT white screen**! ✅

## Development Mode

Test in development first:
```powershell
npm run electron:dev
```

## What Was Fixed

✅ Production now loads from file system (not localhost)
✅ Uses `app.isPackaged` for environment detection
✅ Added error logging for debugging
✅ Secure Electron settings maintained
✅ Proper build order automated

## Full Documentation

- **Complete Guide**: See `ELECTRON_BUILD_GUIDE.md`
- **Fix Summary**: See `WHITE_SCREEN_FIX_SUMMARY.md`

## Troubleshooting

If white screen still appears:
1. Check console output
2. Verify `client/build/index.html` exists
3. Run from command line to see errors:
   ```powershell
   .\dist2\win-unpacked\"Inventory Manager.exe"
   ```

## System Requirements

- Windows 7 or later (64-bit recommended)
- 4GB RAM minimum
- 500MB free disk space

---

**Status**: Production Ready 🚀
