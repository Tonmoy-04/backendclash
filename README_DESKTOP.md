# 🖥️ Inventory Manager - Desktop Application

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-28.0.0-blue)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Professional Inventory Management System**

A powerful, offline-capable desktop application for managing inventory, sales, purchases, and more.

[Quick Start](#-quick-start) • [Features](#-features) • [Installation](#-installation) • [Documentation](#-documentation)

</div>

---

## 📋 Overview

This is a full-featured inventory management desktop application built with:

- **Electron** - Desktop application framework
- **React** - Modern UI framework  
- **Express** - Backend API server
- **SQLite** - Local database
- **TypeScript** - Type-safe development

### 🎯 Key Features

✅ **Completely Offline** - No internet required  
✅ **Local Database** - All data stored locally  
✅ **Bengali Support** - Full Bengali language support  
✅ **PDF Generation** - Invoice and report printing  
✅ **Auto Backup** - Automatic database backups  
✅ **Modern UI** - Beautiful, responsive interface  

---

## 🚀 Quick Start

### For Users

1. **Download** the installer: `Inventory Manager-Setup-1.0.0.exe`
2. **Run** the installer and follow instructions
3. **Launch** from desktop shortcut or Start Menu
4. **Start managing** your inventory!

### For Developers

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
start.bat

# Or using npm
npm run electron:dev
```

---

## 💻 System Requirements

### Minimum
- Windows 10 (64-bit)
- 4 GB RAM
- 500 MB free disk space
- 1024x768 screen resolution

### Recommended
- Windows 11 (64-bit)
- 8 GB RAM
- 1 GB free disk space
- 1920x1080 screen resolution

---

## 📥 Installation

### End User Installation

1. Download `Inventory Manager-Setup-1.0.0.exe`
2. Double-click to run installer
3. Choose installation directory
4. Click "Install"
5. Launch from desktop shortcut

### Developer Setup

```bash
# Clone or download the project
cd inventory-software

# Install all dependencies (one time)
npm install

# Verify setup
verify-setup.bat

# Run in development mode
start.bat
```

---

## 🎨 Features

### 📦 Product Management
- Add, edit, delete products
- Category organization
- Stock tracking
- Price management

### 💰 Sales Management
- Create sales invoices
- Customer tracking
- Transaction history
- PDF invoice generation

### 🛒 Purchase Management
- Record purchases
- Supplier management
- Purchase history
- Cost tracking

### 👥 Customer & Supplier Management
- Contact management
- Balance tracking
- Transaction history
- Payment tracking

### 📊 Dashboard & Reports
- Real-time statistics
- Sales analytics
- Stock levels
- Financial summary

### 💵 Cash Management
- Cash box tracking
- Income/expense recording
- Balance monitoring
- Transaction history

### 🇧🇩 Bengali Support
- Full Bengali interface
- Bengali numerals
- Bengali PDF generation
- Date formatting

### 💾 Backup & Restore
- Automatic backups
- Manual backup creation
- Database restore
- Export functionality

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Web dev (browser)
npm run electron:dev     # Desktop dev mode
npm run server          # Backend only
npm run client          # Frontend only

# Building
npm run build           # Build React app
npm run build:win       # Build Windows installer
npm run dist            # Complete build

# Utilities
verify-setup.bat        # Verify installation
start.bat               # Quick dev start
build-windows.bat       # Build automation
```

### Project Structure

```
inventory-software/
├── electron/          # Desktop wrapper
│   ├── main.js       # Main process
│   ├── window.js     # Window config
│   └── preload.js    # IPC bridge
│
├── client/           # React frontend
│   ├── src/         # Components
│   └── build/       # Production build
│
├── server/           # Express backend
│   ├── app.ts       # Server entry
│   ├── routes/      # API routes
│   ├── controllers/ # Business logic
│   └── database/    # SQLite DBs
│
└── build/            # Icons & resources
```

### Building for Production

```bash
# Quick build
build-windows.bat

# Or step by step
npm run build:client
npm run build:win

# Output
dist/Inventory Manager-Setup-1.0.0.exe
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute quick start guide |
| [INSTALLATION.md](INSTALLATION.md) | Complete installation guide |
| [BUILD_GUIDE.md](BUILD_GUIDE.md) | Building and packaging |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [ELECTRON_SETUP.md](ELECTRON_SETUP.md) | Electron configuration |
| [CONVERSION_SUMMARY.md](CONVERSION_SUMMARY.md) | Conversion details |

---

## 🔧 Configuration

### Customize Window Size

Edit `electron/window.js`:
```javascript
width: 1400,
height: 900,
```

### Change Server Port

Edit `server/app.ts`:
```javascript
const PORT = process.env.PORT || 5000;
```

### Add Custom Icon

1. Create 256x256 PNG icon
2. Convert to .ico format
3. Save as `build/icon.ico`
4. Rebuild: `npm run dist`

---

## 🐛 Troubleshooting

### App won't start

```bash
# Check installation
verify-setup.bat

# Reinstall dependencies
npm install

# Try dev mode
npm run electron:dev
```

### Build fails

```bash
# Clear build cache
rmdir /s /q dist
rmdir /s /q client\build

# Rebuild
npm run build
npm run build:win
```

### Port conflicts

```bash
# Check what's using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <PID> /F
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE.txt](LICENSE.txt) for details.

---

## 🎯 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 28 |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS |
| Backend | Express + TypeScript |
| Database | SQLite3 |
| PDF | PDFKit |
| Build | electron-builder |

---

## 🔐 Security

- ✅ Context isolation enabled
- ✅ Node integration disabled  
- ✅ Remote module disabled
- ✅ Secure IPC communication
- ✅ Navigation protection
- ✅ Local data storage only

---

## 📞 Support

Need help?

1. Check [documentation](#-documentation)
2. Run `verify-setup.bat`
3. Review [troubleshooting](#-troubleshooting)
4. Check error logs
5. Contact support

---

## 🎉 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 📸 Screenshots

*Add screenshots of your application here*

---

## 🗺️ Roadmap

- [ ] Auto-update functionality
- [ ] Multi-language support
- [ ] Cloud backup option
- [ ] Mobile companion app
- [ ] Advanced reporting
- [ ] Barcode scanning

---

<div align="center">

**Made with ❤️ for inventory management**

[⬆ Back to Top](#-inventory-manager---desktop-application)

</div>
