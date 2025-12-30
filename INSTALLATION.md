# Desktop App Installation & Setup

## For Developers

### First Time Setup

1. **Clone or extract the project**
   ```bash
   cd inventory-software
   ```

2. **Install all dependencies**
   ```bash
   npm install
   ```
   This will automatically install dependencies for:
   - Root project (Electron)
   - Client folder (React)
   - Server folder (Express/Node)

3. **Run in development mode**
   
   **Windows (Easy way):**
   ```bash
   start.bat
   ```
   
   **Or using npm:**
   ```bash
   npm run electron:dev
   ```

4. **Wait for the app to open**
   - Backend starts on port 5000
   - Frontend starts on port 3000
   - Electron window opens automatically

### Development Commands

```bash
# Start with Electron (recommended for desktop testing)
npm run electron:dev

# Start without Electron (web browser only)
npm run dev

# Start backend only
npm run server

# Start frontend only  
npm run client
```

## Building for Production

### Prerequisites
- All dependencies installed (`npm install`)
- Build tools installed (Windows Build Tools if needed)

### Build Steps

#### Option 1: Automated Build (Recommended)
```bash
build-windows.bat
```
This will:
1. Install dependencies
2. Build React frontend
3. Create Windows installer

#### Option 2: Manual Build
```bash
# Step 1: Build frontend
npm run build:client

# Step 2: Build Windows installer
npm run build:win
```

### Build Output
- **Installer**: `dist/Inventory Manager-Setup-1.0.0.exe`
- **Unpacked**: `dist/win-unpacked/` (for testing without installing)

### Testing the Build
Before distributing, test the installer:

1. Run the unpacked version:
   ```bash
   dist\win-unpacked\Inventory Manager.exe
   ```

2. Test the installer:
   - Double-click `dist/Inventory Manager-Setup-1.0.0.exe`
   - Install to a test location
   - Run the installed app
   - Verify all features work

## For End Users

### System Requirements
- Windows 10 or later (64-bit)
- 4 GB RAM minimum
- 500 MB free disk space

### Installation

1. **Download** `Inventory Manager-Setup-1.0.0.exe`

2. **Run the installer**
   - Double-click the .exe file
   - Choose installation directory (default: C:\Program Files\Inventory Manager)
   - Click Install

3. **Launch the app**
   - Desktop shortcut will be created
   - Or find in Start Menu under "Inventory Manager"

4. **First Launch**
   - App will initialize database
   - Login screen will appear
   - Default credentials (if applicable) should be in documentation

### Updating
- Download new installer version
- Run installer (will update existing installation)
- Your data will be preserved

### Uninstalling
- Windows Settings → Apps → Inventory Manager → Uninstall
- Or run uninstaller from installation directory

## Application Icons

To customize the app icon:

1. Create/obtain icon files:
   - **icon.ico** - 256x256 px (Windows)
   - **icon.icns** - Various sizes (macOS)
   - **icon.png** - 512x512 px (Linux)

2. Place in `build/` folder

3. Rebuild:
   ```bash
   npm run dist
   ```

### Icon Resources
- Generate from PNG: https://www.npmjs.com/package/electron-icon-builder
- Online converter: https://anyconv.com/png-to-ico-converter/

## Project Structure

```
inventory-software/
│
├── electron/              # Desktop app wrapper
│   ├── main.js           # Main process (starts server, creates window)
│   ├── window.js         # Window configuration
│   └── preload.js        # Secure IPC bridge
│
├── client/               # React frontend (UI)
│   ├── src/             # React components
│   ├── public/          # Static assets
│   └── build/           # Production build (generated)
│
├── server/               # Express backend (API)
│   ├── app.ts           # Server entry point
│   ├── database/        # SQLite databases
│   ├── controllers/     # Business logic
│   ├── routes/          # API endpoints
│   └── utils/           # Helper functions
│
├── build/                # Build resources (icons)
├── dist/                 # Build output (installers)
│
├── package.json          # Main configuration
├── .electron-builder.yml # Build configuration
├── start.bat             # Development launcher
└── build-windows.bat     # Build automation
```

## Troubleshooting

### Build Issues

**Error: Cannot find module 'electron'**
```bash
npm install
```

**Build fails with "out of memory"**
```bash
set NODE_OPTIONS=--max-old-space-size=4096
npm run dist
```

**Icon not showing**
- Ensure icon files are in `build/` folder
- Verify icon.ico is 256x256 pixels
- Rebuild: `npm run dist`

### Runtime Issues

**App won't start**
- Check if port 5000 is available
- Look for error logs in console
- Try: `npm run electron` for debugging

**Database errors**
- Check database file permissions
- Verify database folder exists
- Try deleting and reinitializing database

**UI not loading**
- Check if React build exists: `client/build/`
- Rebuild frontend: `npm run build:client`
- Clear cache and rebuild

### Development Issues

**Hot reload not working**
- Restart development server
- Check if port 3000 is available
- Try: `npm run client` separately

**Backend not responding**
- Check server logs
- Verify port 5000 is free
- Try: `npm run server` separately

**Electron window blank**
- Check DevTools console (F12)
- Verify React dev server is running
- Check network requests in DevTools

## Advanced Configuration

### Change Window Size
Edit `electron/window.js`:
```javascript
width: 1400,  // Change this
height: 900,  // Change this
```

### Change Server Port
Edit `server/app.ts`:
```javascript
const PORT = process.env.PORT || 5000; // Change default
```

### Change App Name
Edit `package.json`:
```json
"build": {
  "productName": "Your App Name",
  ...
}
```

### Enable Auto-Updates
- Set up update server
- Configure electron-updater
- Add update checking logic

## Security Notes

- Database is stored locally
- No external connections required
- All data stays on the user's machine
- HTTPS not required (local-only)

## Performance Tips

- Close unnecessary background apps
- Ensure SSD for database storage
- Allocate enough RAM (4GB+)
- Keep Windows updated

## Support & Documentation

- Build Guide: `BUILD_GUIDE.md`
- Electron Setup: `ELECTRON_SETUP.md`
- Feature Documentation: Check `.md` files in root
- Issues: Create GitHub issue or contact support

## License

MIT License - See LICENSE.txt
