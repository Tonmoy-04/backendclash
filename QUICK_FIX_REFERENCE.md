# Quick Reference - White Screen Fix

## 🚀 Build & Test (3 Commands)

```powershell
# 1. Build everything
.\build-production.bat

# 2. Check if build succeeded
.\diagnose-build.bat

# 3. Run and debug
.\dist2\win-unpacked\"Inventory Manager.exe"
```

## 📋 What Was Fixed

✅ **Comprehensive logging** → All errors to `%APPDATA%\inventory-desktop-app\logs\`  
✅ **Path resolution** → Uses `process.resourcesPath` (ASAR-compatible)  
✅ **ASAR disabled** → Full compatibility with native modules  
✅ **Error instrumentation** → Catches all renderer crashes/failures  
✅ **Preload hardening** → Won't crash renderer even if errors occur  
✅ **DevTools auto-open** → See errors immediately (temporary)

## 🔍 Check Logs

```powershell
# Quick view
.\view-logs.bat

# Or manually
Get-Content $env:APPDATA\inventory-desktop-app\logs\electron-*.log -Tail 100
```

## ✓ Success Looks Like

**In DevTools Console:**
- No red errors
- React components visible

**In Log Files:**
```
[PROD] Index path exists: true
[PROD] Successfully loaded index.html
[PRELOAD] ✓ Successfully exposed electronAPI
```

**Visually:**
- Splash shows → Main window loads with UI (not white)

## ✗ Common Issues

| Symptom | Check | Fix |
|---------|-------|-----|
| White screen | DevTools console | Check for React errors |
| "Cannot find module" | Log files | React using Node.js - use IPC |
| "index.html not found" | `diagnose-build.bat` | Rebuild React: `cd client && npm run build` |
| Renderer crashed | Log files | Check `render-process-gone` message |

## 🔧 Modified Files

1. `electron/main.js` - Logging + path resolution
2. `electron/preload.js` - Error handling + logging  
3. `package.json` - ASAR disabled + build config

## 📦 File Structure

```
dist2/win-unpacked/resources/
├── electron/      ← main.js, preload.js
├── client/build/  ← React app (index.html)
└── server/dist/   ← Backend (app.js)
```

**No app.asar** (ASAR disabled)

## 🎯 Before Release

- [ ] Remove DevTools line from main.js (~line 157)
- [ ] Test on clean Windows PC
- [ ] Delete log files or clear sensitive data
- [ ] (Optional) Re-enable ASAR if desired

## 📞 Emergency

**Logs**: `%APPDATA%\inventory-desktop-app\logs\`  
**Clean rebuild**: Delete `client\build`, `server\dist`, `dist2` → run `.\build-production.bat`  
**Test React separately**: `cd client\build && python -m http.server 8000`

---

**Status**: Production-ready with full debugging enabled  
**Next**: Build → Test → Check logs → Fix issues → Rebuild
