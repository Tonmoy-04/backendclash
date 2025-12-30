# Inventory Manager - Desktop Application Build Guide

## Overview
This inventory management system is now packaged as a Windows desktop application using Electron.

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Install dependencies (first time only)
npm install

# This will also install dependencies in /client and /server folders
```

### Running in Development Mode

**Option 1: Using the batch file**
```bash
start.bat
```

**Option 2: Using npm**
```bash
npm run electron:dev
```

This will:
1. Start the backend server on http://localhost:5000
2. Start the React dev server on http://localhost:3000
3. Open the Electron window automatically

### Development Scripts
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run dev` - Start both backend and frontend (no Electron)
- `npm run electron:dev` - Full development mode with Electron

## Building for Production

### Build Steps

1. **Build the React frontend**
   ```bash
   npm run build:client
   ```

2. **Build Windows installer (64-bit)**
   ```bash
   npm run build:win
   ```

3. **Or build everything at once**
   ```bash
   npm run dist
   ```

### Build Outputs
- Installer will be in: `dist/Inventory Manager-Setup-1.0.0.exe`
- Unpacked files in: `dist/win-unpacked/`

### Build Scripts
- `npm run build` - Build React app only
- `npm run build:win` - Build Windows installer (x64)
- `npm run build:win32` - Build Windows installer (32-bit)
- `npm run dist` - Build complete distribution package
- `npm run pack` - Pack without creating installer (for testing)

## Application Icons

Place icon files in the `build/` folder:
- `icon.ico` - Windows icon (256x256 px)
- `icon.icns` - macOS icon (multiple sizes)
- `icon.png` - Linux icon (512x512 px)

You can generate these from a single PNG using online tools or electron-icon-builder.

## Project Structure

```
inventory-desktop-app/
├── electron/           # Electron main process
│   ├── main.js        # App entry point
│   ├── window.js      # Window configuration
│   └── preload.js     # Preload scripts (IPC bridge)
├── server/            # Backend Express API
│   ├── app.ts         # Server entry
│   ├── database/      # SQLite databases
│   └── ...
├── client/            # React frontend
│   ├── src/           # React components
│   ├── build/         # Production build output
│   └── ...
├── build/             # Icons and resources
├── dist/              # Build output (installers)
└── package.json       # Main config
```

## Configuration

### Electron Settings
Edit `electron/window.js` to modify:
- Window size (default: 1400x900)
- Minimum size (default: 1024x768)
- Other window properties

### Backend Settings
Edit `server/app.ts` for:
- Port configuration (default: 5000)
- CORS settings
- API routes

## Features

✅ Offline-capable desktop application
✅ Local SQLite database
✅ Automatic server startup
✅ Auto-hide menu bar
✅ Single window application
✅ Windows installer with desktop shortcut
✅ Automatic backup system
✅ Bengali language support
✅ PDF bill generation

## Troubleshooting

### Build fails
- Ensure all dependencies are installed: `npm install`
- Clear build cache: `rm -rf dist/ client/build/`
- Rebuild: `npm run build && npm run build:win`

### Server doesn't start in production
- Check that server files are included in `extraResources`
- Verify Node.js is bundled or available

### App doesn't open
- Check electron logs in the terminal
- Try running with: `npm run electron` for debugging

## Database Location

Development: `server/database/`
Production: Application data folder

## Support

For issues or questions, check the documentation in the `/docs` folder or create an issue.

## License

MIT License - See LICENSE.txt for details
