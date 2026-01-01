const { BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const { app } = require('electron');
  const isDev = !app.isPackaged;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
  
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#ffffff',
    title: 'M/S DIDAR TRADING',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      webSecurity: true,
      // Disable DevTools in production
      devTools: isDev
    },
    frame: true,
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    autoHideMenuBar: true // Hide menu bar by default
  });

  // Window state management
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Block DevTools keyboard shortcuts in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block Ctrl+Shift+I, Ctrl+Shift+J, F12
      if (
        (input.control && input.shift && (input.key === 'I' || input.key === 'i' || input.key === 'J' || input.key === 'j')) ||
        input.key === 'F12'
      ) {
        event.preventDefault();
      }
    });
  }

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedHosts = ['localhost:3000', 'localhost:5000', '127.0.0.1:3000', '127.0.0.1:5000'];
    const urlObj = new URL(url);
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development') {
      if (!allowedHosts.some(host => url.includes(host))) {
        event.preventDefault();
        console.log('Navigation blocked:', url);
      }
    } else {
      // In production, only allow file:// protocol
      // In production, allow packaged server on localhost:5000
      const isLocalhost5000 = url.startsWith('http://localhost:5000') || url.startsWith('https://localhost:5000');
      if (!url.startsWith('file://') && !isLocalhost5000) {
        event.preventDefault();
        console.log('Navigation blocked:', url);
      }
    }
  });

  // Prevent opening new windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked new window:', url);
    return { action: 'deny' };
  });

  return mainWindow;
}

module.exports = { createWindow };
