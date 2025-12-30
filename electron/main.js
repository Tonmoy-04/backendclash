const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork, spawn } = require('child_process');
const http = require('http');
const https = require('https');
const url = require('url');
const { createWindow } = require('./window');

let mainWindow;
let serverProcess;
let logStream;

// Initialize error logging to file
function initializeLogging() {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFile = path.join(logsDir, `electron-${Date.now()}.log`);
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  console.log('[INIT] Log file created:', logFile);
  logToFile(`=== Electron Started at ${new Date().toISOString()} ===`);
  logToFile(`App Version: ${app.getVersion()}`);
  logToFile(`Electron Version: ${process.versions.electron}`);
  logToFile(`Node Version: ${process.versions.node}`);
  logToFile(`Is Packaged: ${app.isPackaged}`);
  logToFile(`App Path: ${app.getAppPath()}`);
  logToFile(`User Data: ${app.getPath('userData')}`);
  logToFile(`Resources Path: ${process.resourcesPath}`);
}

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  if (logStream) {
    logStream.write(logMessage);
  }
}

// Ensure single instance to prevent "clones"
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logToFile(`[UNCAUGHT EXCEPTION] ${error.stack || error.message}`);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`[UNHANDLED REJECTION] ${reason}`);
  console.error('Unhandled Rejection:', reason);
});

// Start the backend server (non-blocking)
async function startBackendServer() {
  const isDev = !app.isPackaged;
  logToFile(`[SERVER] Starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

  if (isDev) {
    // In dev, try to detect running server; if not, start it
    const ready = await waitForServerReady('http://localhost:5000/api/health', 8000, 500);
    if (ready) {
      logToFile('[DEV] Backend already running on http://localhost:5000');
      return;
    }

    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      logToFile('[DEV] Starting backend: npm run start in /server');
      serverProcess = spawn(npmCmd, ['run', 'start'], {
        cwd: path.join(__dirname, '../server'),
        env: { ...process.env, NODE_ENV: 'development', PORT: '5000', APP_ENV: 'electron' },
        stdio: 'pipe'
      });
      serverProcess.stdout.on('data', (d) => {
        logToFile(`[SERVER STDOUT] ${d.toString().trim()}`);
      });
      serverProcess.stderr.on('data', (d) => {
        logToFile(`[SERVER STDERR] ${d.toString().trim()}`);
      });
      serverProcess.on('exit', (code) => logToFile(`[DEV] Server exited with code ${code}`));
      serverProcess.on('error', (err) => logToFile(`[DEV] Server error: ${err.message}`));
      return;
    } catch (err) {
      logToFile(`[DEV] Failed to start backend: ${err.message}`);
      return;
    }
  }

  try {
    // Production: Use compiled server from resources (NOT asar)
    const serverEntry = path.join(process.resourcesPath, 'server', 'dist', 'app.js');
    logToFile(`[PRODUCTION] Server entry: ${serverEntry}`);
    logToFile(`[PRODUCTION] Entry exists: ${fs.existsSync(serverEntry)}`);

    if (!fs.existsSync(serverEntry)) {
      logToFile('[PRODUCTION ERROR] Server entry file not found!');
      return;
    }

    const serverNodeModules = path.join(process.resourcesPath, 'server', 'node_modules');
    logToFile(`[PRODUCTION] Node modules: ${serverNodeModules}`);
    
    serverProcess = fork(serverEntry, [], {
      env: { 
        ...process.env, 
        NODE_ENV: 'production', 
        PORT: '5000', 
        APP_ENV: 'electron',
        NODE_PATH: serverNodeModules
      },
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (d) => logToFile(`[PROD SERVER] ${d.toString().trim()}`));
    serverProcess.stderr.on('data', (d) => logToFile(`[PROD SERVER ERROR] ${d.toString().trim()}`));
    serverProcess.on('message', (m) => logToFile(`[SERVER MESSAGE] ${JSON.stringify(m)}`));
    serverProcess.on('exit', (code) => logToFile(`[PRODUCTION] Server exited with code ${code}`));
    serverProcess.on('error', (err) => logToFile(`[PRODUCTION] Server error: ${err.message}`));
  } catch (err) {
    logToFile(`[PRODUCTION] Failed to start server: ${err.stack || err.message}`);
  }
}

async function initializeApp() {
  // Initialize logging first
  initializeLogging();
  
  // Start server in background
  await startBackendServer();

  const isDev = !app.isPackaged;
  logToFile(`[INIT] Initializing app in ${isDev ? 'DEV' : 'PROD'} mode`);

  // Only wait for server in dev mode or if using remote API
  if (isDev) {
    const targetUrl = 'http://localhost:3000';
    logToFile(`[DEV] Waiting for React dev server: ${targetUrl}`);
    const ready = await waitForServerReady(targetUrl, 30000, 500);
    if (!ready) {
      logToFile('[DEV WARNING] React dev server timed out');
    }
  } else {
    // In production, wait for backend API to be ready
    const targetUrl = 'http://localhost:5000/api/health';
    logToFile(`[PROD] Waiting for backend API: ${targetUrl}`);
    const ready = await waitForServerReady(targetUrl, 30000, 500);
    if (!ready) {
      logToFile('[PROD WARNING] Backend API timed out');
    }
  }

  // Create window and load
  mainWindow = createWindow();
  
  // Add comprehensive renderer error logging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logToFile(`[RENDERER FAILED] Code: ${errorCode}, Desc: ${errorDescription}, URL: ${validatedURL}, Main: ${isMainFrame}`);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile(`[RENDERER CRASHED] Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    logToFile('[RENDERER UNRESPONSIVE] Renderer process is not responding');
  });
  
  mainWindow.webContents.on('responsive', () => {
    logToFile('[RENDERER RESPONSIVE] Renderer process resumed');
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    logToFile(`[RENDERER CONSOLE ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });
  
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    logToFile(`[PRELOAD ERROR] Path: ${preloadPath}, Error: ${error.message}`);
  });
  
  // Add comprehensive white screen debugging
  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('[RENDERER] did-finish-load event fired');
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    logToFile('[RENDERER] DOM ready');
  });
  
  mainWindow.webContents.on('did-start-loading', () => {
    logToFile('[RENDERER] Started loading');
  });
  
  mainWindow.webContents.on('did-stop-loading', () => {
    logToFile('[RENDERER] Stopped loading');
  });
  
  if (isDev) {
    // Development: Load from React dev server
    const devUrl = 'http://localhost:3000';
    logToFile(`[DEV] Loading from React dev server: ${devUrl}`);
    try {
      await mainWindow.loadURL(devUrl);
      // Open DevTools ONLY in development
      mainWindow.webContents.openDevTools();
      logToFile('[DEV] Successfully loaded from dev server');
    } catch (e) {
      logToFile(`[DEV ERROR] Failed to load: ${e.stack || e.message}`);
    }
  } else {
    // Production: Load React build files directly using file:// protocol
    const indexPath = path.join(__dirname, '..', 'client', 'build', 'index.html');
    const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
    logToFile(`[PROD] Loading from file: ${fileUrl}`);
    logToFile(`[PROD] Index path exists: ${fs.existsSync(indexPath)}`);
    
    try {
      await mainWindow.loadFile(indexPath);
      logToFile('[PROD] Successfully loaded React build');
      // DevTools are NOT opened in production mode
      
    } catch (e) {
      logToFile(`[PROD ERROR] Failed to load: ${e.stack || e.message}`);
      // Fallback: Try to load from backend server if file load fails
      logToFile('[PROD] Attempting fallback to backend server...');
      try {
        await mainWindow.loadURL('http://localhost:5000');
        logToFile('[PROD] Fallback successful - loaded from backend');
      } catch (fallbackErr) {
        logToFile(`[PROD ERROR] Fallback also failed: ${fallbackErr.message}`);
      }
    }
  }

  mainWindow.on('closed', () => {
    logToFile('[WINDOW] Main window closed');
    mainWindow = null;
  });
}

// Simple HTTP readiness check helper
function waitForServerReady(url, timeoutMs = 20000, intervalMs = 500) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const lib = url.startsWith('https') ? https : http;
    const tick = () => {
      const req = lib.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          res.resume();
          logToFile(`[HEALTH CHECK] ${url} responded with ${res.statusCode}`);
          return resolve(true);
        }
        res.resume();
        if (Date.now() - startedAt >= timeoutMs) {
          logToFile(`[HEALTH CHECK] ${url} timed out after ${timeoutMs}ms`);
          return resolve(false);
        }
        setTimeout(tick, intervalMs);
      });
      req.on('error', (err) => {
        if (Date.now() - startedAt >= timeoutMs) {
          logToFile(`[HEALTH CHECK] ${url} failed: ${err.message}`);
          return resolve(false);
        }
        setTimeout(tick, intervalMs);
      });
      req.end();
    };
    tick();
  });
}

// App event handlers
app.whenReady().then(initializeApp);

// IPC Handlers
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  logToFile('[APP] All windows closed');
  if (serverProcess) {
    try { 
      serverProcess.kill(); 
      logToFile('[APP] Server process killed');
    } catch (err) {
      logToFile(`[APP ERROR] Failed to kill server: ${err.message}`);
    }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  logToFile('[APP] Activate event');
  if (BrowserWindow.getAllWindows().length === 0) initializeApp();
});

app.on('before-quit', () => {
  logToFile('[APP] Before quit');
  if (serverProcess) {
    try { 
      serverProcess.kill(); 
      logToFile('[APP] Server killed on quit');
    } catch (err) {
      logToFile(`[APP ERROR] Failed to kill server on quit: ${err.message}`);
    }
  }
  if (logStream) {
    logStream.end();
  }
});

app.on('quit', () => {
  logToFile('[APP] Application quit');
});
