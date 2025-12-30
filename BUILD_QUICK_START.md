# 🚀 Quick Start - Production Build

## Build Installer

```powershell
npm run build
```

**Output:** `dist/Setup.exe`

---

## What Changed?

✅ **DevTools:** Only in development (disabled in production)  
✅ **Build Type:** NSIS installer (not portable)  
✅ **Publisher:** "Tonmoy & Rifat"  
✅ **Output:** `dist/Setup.exe`  
✅ **Shortcuts:** Desktop + Start Menu  

---

## Test Production Build

1. Build: `npm run build`
2. Install: Run `dist/Setup.exe`
3. Verify:
   - [ ] No DevTools
   - [ ] No Ctrl+Shift+I
   - [ ] App works correctly
   - [ ] File properties show "Tonmoy & Rifat"

---

## Environment Detection

| Mode | DevTools | Source |
|------|----------|--------|
| Dev | ✅ Open | localhost:3000 |
| Prod | ❌ Disabled | Built files |

**Detection:** `app.isPackaged`

---

## Build Scripts

```powershell
# Full build (recommended)
npm run build

# Step by step
npm run build:client    # React build
npm run build:server    # Backend build  
npm run build:installer # Create Setup.exe

# Alternative
npm run dist            # Same as npm run build
npm run release         # No auto-publish
```

---

## Troubleshooting

### Clean build
```powershell
Remove-Item -Recurse -Force dist, client/build, server/dist
npm run build
```

### Check DevTools issue
- `electron/main.js` line ~211: No `openDevTools()` in production
- `electron/window.js`: `devTools: isDev`

---

## Code Signing (Later)

1. Get certificate (.pfx)
2. Set environment: `$env:CERTIFICATE_PASSWORD = "password"`
3. Update `package.json` with certificate path
4. Build normally

---

**📖 Full Documentation:** [PRODUCTION_BUILD_GUIDE.md](PRODUCTION_BUILD_GUIDE.md)
