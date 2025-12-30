# ⚡ Quick Start Guide

## 🎯 For Developers

### First Time Setup (5 minutes)

1. **Install dependencies**
   ```bash
   npm install
   ```
   ⏱️ Takes 2-3 minutes

2. **Verify setup**
   ```bash
   verify-setup.bat
   ```
   ✅ Checks everything is ready

3. **Run the app**
   ```bash
   start.bat
   ```
   🚀 Opens desktop app in dev mode

---

## 🔨 Building (10 minutes)

### Create Windows Installer

**Easy Way:**
```bash
build-windows.bat
```

**Manual Way:**
```bash
npm run build:client
npm run build:win
```

**Result:**
📦 `dist/Inventory Manager-Setup-1.0.0.exe`

---

## 📋 Common Commands

| Command | What it does |
|---------|-------------|
| `start.bat` | 🟢 Start development with Electron |
| `npm run dev` | 🌐 Start web dev (browser only) |
| `npm run electron:dev` | 🖥️ Full desktop development |
| `build-windows.bat` | 📦 Build Windows installer |
| `npm run dist` | 📦 Build complete package |
| `verify-setup.bat` | ✅ Check installation |

---

## 🎨 Add Custom Icon

1. Get a 256x256 PNG image
2. Convert to .ico format
3. Save as `build/icon.ico`
4. Rebuild: `npm run dist`

**Online converter:** https://anyconv.com/png-to-ico-converter/

---

## 🧪 Test Before Distribution

```bash
# Build first
npm run dist

# Test unpacked version
cd dist\win-unpacked
"Inventory Manager.exe"

# Test installer
cd ..
"Inventory Manager-Setup-1.0.0.exe"
```

---

## 🆘 Problems?

### "Cannot find module 'electron'"
```bash
npm install
```

### "Port 5000 already in use"
```bash
# Find and kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Build fails
```bash
# Clear everything
rmdir /s /q dist
rmdir /s /q client\build
rmdir /s /q node_modules

# Start fresh
npm install
npm run dist
```

---

## 📂 Important Files

```
📁 inventory-software/
├── 🎯 start.bat              👈 Click to start dev
├── 🔨 build-windows.bat      👈 Click to build
├── ✅ verify-setup.bat        👈 Click to verify
├── 📖 CONVERSION_SUMMARY.md  👈 Full details
├── 📖 INSTALLATION.md        👈 Complete guide
└── 📖 BUILD_GUIDE.md         👈 Build instructions
```

---

## ✅ Checklist

### Before Development
- [ ] Node.js installed?
- [ ] Ran `npm install`?
- [ ] Ran `verify-setup.bat`?
- [ ] Ready to code!

### Before Building
- [ ] App works in dev mode?
- [ ] Icon added to `build/`?
- [ ] All features tested?
- [ ] Ready to build!

### Before Distribution
- [ ] Installer tested?
- [ ] Works on clean PC?
- [ ] Documentation ready?
- [ ] Ready to ship!

---

## 🎓 Learn More

- **Full Details:** [CONVERSION_SUMMARY.md](CONVERSION_SUMMARY.md)
- **Setup Guide:** [INSTALLATION.md](INSTALLATION.md)
- **Build Guide:** [BUILD_GUIDE.md](BUILD_GUIDE.md)
- **What Changed:** [ELECTRON_SETUP.md](ELECTRON_SETUP.md)

---

## 🎉 That's It!

Your inventory software is now a professional Windows desktop app.

**Nothing in your React code was changed.**
**Everything works exactly as before.**
**Just packaged nicely!**

Happy coding! 🚀
