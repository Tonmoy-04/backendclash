const { contextBridge, ipcRenderer, app } = require('electron');
const fs = require('fs');
const path = require('path');

// Get user data path for logging (app is not available in preload, use remote path)
const { remote } = process;
let preloadLogPath;
try {
  // Try to get userData path - this might fail in strict contexts
  const userDataPath = process.env.APPDATA || process.env.HOME || '.';
  const logsDir = path.join(userDataPath, 'inventory-desktop-app', 'logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  preloadLogPath = path.join(logsDir, `preload-${Date.now()}.log`);
} catch (err) {
  console.error('Failed to setup preload logging:', err);
}

function logPreload(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [PRELOAD] ${message}\n`;
  console.log(`[PRELOAD] ${message}`);
  
  if (preloadLogPath) {
    try {
      fs.appendFileSync(preloadLogPath, logMessage);
    } catch (err) {
      console.error('Failed to write preload log:', err);
    }
  }
}

logPreload('=== Preload script started ===');
logPreload(`Node Version: ${process.versions.node}`);
logPreload(`Electron Version: ${process.versions.electron}`);
logPreload(`Chrome Version: ${process.versions.chrome}`);

// Safely expose protected methods to the renderer process
// Wrapped in try-catch to prevent renderer crashes
try {
  logPreload('Attempting to expose electronAPI via contextBridge...');
  
  contextBridge.exposeInMainWorld('electronAPI', {
    // Database operations
    db: {
      query: (sql, params) => {
        logPreload(`db.query called: ${sql}`);
        return ipcRenderer.invoke('db:query', sql, params).catch(err => {
          logPreload(`db.query error: ${err.message}`);
          throw err;
        });
      },
      execute: (sql, params) => {
        logPreload(`db.execute called: ${sql}`);
        return ipcRenderer.invoke('db:execute', sql, params).catch(err => {
          logPreload(`db.execute error: ${err.message}`);
          throw err;
        });
      }
    },
    
    // File operations
    file: {
      selectFile: () => {
        logPreload('file.selectFile called');
        return ipcRenderer.invoke('file:select').catch(err => {
          logPreload(`file.selectFile error: ${err.message}`);
          throw err;
        });
      },
      saveFile: (data) => {
        logPreload('file.saveFile called');
        return ipcRenderer.invoke('file:save', data).catch(err => {
          logPreload(`file.saveFile error: ${err.message}`);
          throw err;
        });
      },
      exportData: (data, filename) => {
        logPreload(`file.exportData called: ${filename}`);
        return ipcRenderer.invoke('file:export', data, filename).catch(err => {
          logPreload(`file.exportData error: ${err.message}`);
          throw err;
        });
      }
    },
    
    // Backup operations
    backup: {
      create: () => {
        logPreload('backup.create called');
        return ipcRenderer.invoke('backup:create').catch(err => {
          logPreload(`backup.create error: ${err.message}`);
          throw err;
        });
      },
      restore: (path) => {
        logPreload(`backup.restore called: ${path}`);
        return ipcRenderer.invoke('backup:restore', path).catch(err => {
          logPreload(`backup.restore error: ${err.message}`);
          throw err;
        });
      }
    },
    
    // Print operations
    print: {
      invoice: (data) => {
        logPreload('print.invoice called');
        return ipcRenderer.invoke('print:invoice', data).catch(err => {
          logPreload(`print.invoice error: ${err.message}`);
          throw err;
        });
      },
      report: (data) => {
        logPreload('print.report called');
        return ipcRenderer.invoke('print:report', data).catch(err => {
          logPreload(`print.report error: ${err.message}`);
          throw err;
        });
      }
    },
    
    // Shell operations
    shell: {
      openExternal: (url) => {
        logPreload(`shell.openExternal called: ${url}`);
        return ipcRenderer.invoke('shell:openExternal', url).catch(err => {
          logPreload(`shell.openExternal error: ${err.message}`);
          throw err;
        });
      }
    },
    
    // App info
    getVersion: () => {
      logPreload('getVersion called');
      return ipcRenderer.invoke('app:version').catch(err => {
        logPreload(`getVersion error: ${err.message}`);
        throw err;
      });
    },
    
    // Event listeners with validation
    on: (channel, callback) => {
      const validChannels = ['update-available', 'download-progress', 'update-downloaded'];
      if (validChannels.includes(channel)) {
        logPreload(`Event listener registered for: ${channel}`);
        const subscription = (event, ...args) => {
          try {
            callback(...args);
          } catch (err) {
            logPreload(`Event callback error for ${channel}: ${err.message}`);
          }
        };
        ipcRenderer.on(channel, subscription);
        return subscription;
      } else {
        logPreload(`Invalid channel attempted: ${channel}`);
      }
    },
    
    removeListener: (channel, callback) => {
      const validChannels = ['update-available', 'download-progress', 'update-downloaded'];
      if (validChannels.includes(channel)) {
        logPreload(`Event listener removed for: ${channel}`);
        ipcRenderer.removeListener(channel, callback);
      } else {
        logPreload(`Invalid channel for removeListener: ${channel}`);
      }
    }
  });
  
  logPreload('✓ Successfully exposed electronAPI to renderer');
} catch (error) {
  logPreload(`✗ CRITICAL ERROR exposing electronAPI: ${error.stack || error.message}`);
  console.error('[PRELOAD CRITICAL ERROR]', error);
  
  // Expose a minimal API so renderer doesn't crash
  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      error: 'Failed to initialize Electron API',
      message: error.message
    });
    logPreload('Exposed minimal error API as fallback');
  } catch (fallbackError) {
    logPreload(`✗ Even fallback API failed: ${fallbackError.message}`);
  }
}

// Catch any unhandled errors in preload
process.on('uncaughtException', (error) => {
  logPreload(`UNCAUGHT EXCEPTION in preload: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (reason) => {
  logPreload(`UNHANDLED REJECTION in preload: ${reason}`);
});

logPreload('=== Preload script completed ===');
