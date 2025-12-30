# Production Build Guide - Windows Installer

This guide explains how to build a professional Windows installer (Setup.exe) for production deployment.

## ✅ What's Been Fixed

### 1. **DevTools Behavior**
- ❌ Removed unconditional `openDevTools()` in production
- ✅ DevTools open ONLY when `app.isPackaged === false`
- ✅ Disabled Ctrl+Shift+I, Ctrl+Shift+J, and F12 in production
- ✅ `devTools: false` in webPreferences for packaged apps

### 2. **Environment Detection**
- ✅ Uses `app.isPackaged` to detect production vs development
- ✅ Development: Loads React dev server (`http://localhost:3000`)
- ✅ Production: Loads built React files from backend (`http://localhost:5000`)

### 3. **Installer Type**
- ❌ Removed portable build target
- ✅ Uses NSIS installer ONLY
- ✅ Generates `Setup.exe` instead of portable exe
- ✅ Output directory: `dist/` (was `dist2/`)

### 4. **Publisher Metadata**
- ✅ Publisher: **"Tonmoy & Rifat"**
- ✅ Company Name: "Tonmoy & Rifat"
- ✅ Copyright: "Copyright © 2025 Tonmoy & Rifat"
- ✅ Legal Trademarks: "Tonmoy & Rifat"
- ✅ App ID: `com.tonmoyrifat.inventorymanager`

### 5. **Code Signing Preparation**
- ✅ Placeholder configuration for future signing
- ✅ No hardcoded secrets
- ✅ Environment variable support ready
- ℹ️ Currently builds unsigned (ready for signing later)

## 🚀 How to Build

### Prerequisites
1. Node.js installed (v16 or later)
2. All dependencies installed:
   ```powershell
   npm install
   cd client && npm install
   cd ../server && npm install
   cd ..
   ```

### Build Commands

#### Quick Build (Recommended)
```powershell
npm run build
```
This will:
1. Build React frontend → `client/build/`
2. Build Node.js backend → `server/dist/`
3. Package with Electron Builder → `dist/Setup.exe`

#### Step-by-Step Build
```powershell
# 1. Build React frontend
npm run build:client

# 2. Build Node.js backend
npm run build:server

# 3. Create installer
npm run build:installer
```

#### Alternative Commands
```powershell
# Same as npm run build
npm run build:win

# Same as npm run build
npm run dist

# Build for release (no auto-publish)
npm run release
```

### Build Output
After successful build, you'll find:
```
dist/
  └── Setup.exe          ← Windows installer (NSIS)
```

## 📦 What Gets Packaged

The installer includes:
- ✅ Electron main process (`electron/main.js`)
- ✅ Electron preload script (`electron/preload.js`)
- ✅ Window configuration (`electron/window.js`)
- ✅ React build files (`client/build/`)
- ✅ Compiled backend (`server/dist/`)
- ✅ Backend dependencies (`server/node_modules/`)
- ✅ Database schema files (`server/database/`)
- ✅ Font configurations (`server/config/`)

## 🖥️ Installation Experience

### User Installation Process
1. Double-click `Setup.exe`
2. Choose installation directory (default: `C:\Users\<User>\AppData\Local\Programs\Inventory Manager\`)
3. Select Desktop shortcut option
4. Install

### Shortcuts Created
- ✅ Desktop shortcut: "Inventory Manager"
- ✅ Start Menu shortcut: "Inventory Manager"

### File Properties
When you right-click the installed app → Properties → Details:
- **Product Name:** Inventory Manager
- **Publisher:** Tonmoy & Rifat
- **Company Name:** Tonmoy & Rifat
- **Copyright:** Copyright © 2025 Tonmoy & Rifat
- **Version:** 1.0.1

## 🔒 Code Signing (Future)

To enable code signing, follow these steps:

### 1. Obtain a Code Signing Certificate
- Purchase from: Sectigo, DigiCert, GlobalSign, etc.
- Format: `.pfx` or `.p12` file
- Place in secure location (DO NOT commit to git)

### 2. Update package.json
In the `build.win` section, uncomment and configure:

```json
"win": {
  "target": [{"target": "nsis", "arch": ["x64"]}],
  "icon": "build/icon.ico",
  "publisherName": "Tonmoy & Rifat",
  "certificateFile": "path/to/your-certificate.pfx",
  "certificatePassword": "${CERTIFICATE_PASSWORD}",
  "signingHashAlgorithms": ["sha256"]
}
```

### 3. Set Environment Variable
```powershell
# Set password (DO NOT hardcode)
$env:CERTIFICATE_PASSWORD = "YourCertificatePassword"

# Then build
npm run build
```

### 4. Verify Signature
After building:
```powershell
# Check signature
signtool verify /pa dist/Setup.exe
```

## ✅ Production Checklist

Before distributing:
- [ ] Build completes without errors
- [ ] `Setup.exe` exists in `dist/` folder
- [ ] Install on clean test PC
- [ ] App launches without DevTools
- [ ] No "Inspect" option in context menu
- [ ] Publisher shows "Tonmoy & Rifat" in file properties
- [ ] Desktop shortcut works
- [ ] Start Menu shortcut works
- [ ] App functions correctly
- [ ] Database initializes properly
- [ ] Uninstaller works

## 🐛 Troubleshooting

### DevTools Still Opening
- Check `electron/main.js` line ~211 - ensure no `openDevTools()` in production block
- Verify `app.isPackaged` returns `true` in built app
- Check `electron/window.js` has `devTools: isDev` in webPreferences

### Build Fails
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist, client/build, server/dist
npm run build
```

### Icon Not Showing
- Ensure `build/icon.ico` exists
- Rebuild after adding icon
- Clear Windows icon cache

### "Publisher: Unknown"
- Verify `publisherName: "Tonmoy & Rifat"` in package.json
- Code signing is required for verified publisher status
- Without signing, Windows shows "Unknown Publisher" warning

## 📝 Configuration Files

### package.json (Root)
```json
{
  "name": "inventory-desktop-app",
  "version": "1.0.1",
  "productName": "Inventory Manager",
  "author": {
    "name": "Tonmoy & Rifat",
    "email": "contact@example.com"
  },
  "copyright": "Copyright © 2025 Tonmoy & Rifat",
  "build": {
    "appId": "com.tonmoyrifat.inventorymanager",
    "productName": "Inventory Manager",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis",
      "publisherName": "Tonmoy & Rifat"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "artifactName": "Setup.${ext}"
    }
  }
}
```

### electron/main.js
```javascript
// Environment detection
const isDev = !app.isPackaged;

// DevTools ONLY in development
if (isDev) {
  mainWindow.webContents.openDevTools();
}
// Production: NO DevTools
```

### electron/window.js
```javascript
const isDev = !app.isPackaged;

// Disable DevTools in production
webPreferences: {
  devTools: isDev
}

// Block shortcuts in production
if (!isDev) {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      event.preventDefault();
    }
  });
}
```

## 🎯 Key Differences: Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| DevTools | ✅ Opens automatically | ❌ Disabled |
| Keyboard Shortcuts | ✅ Ctrl+Shift+I works | ❌ Blocked |
| React Source | Dev server (3000) | Built files (via 5000) |
| Backend | npm start | Compiled dist/ |
| `app.isPackaged` | `false` | `true` |
| Build Type | N/A | NSIS Installer |
| Output | N/A | Setup.exe |

## 📚 Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [NSIS Installer Options](https://www.electron.build/configuration/nsis)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)

## 🔄 Version History

- **v1.0.1** - Production build configuration
  - Fixed DevTools in production
  - Switched to NSIS installer
  - Added publisher metadata
  - Prepared for code signing

---

**Ready to build?** Run: `npm run build`

**Questions?** Check logs in: `%APPDATA%\Inventory Manager\logs\`
