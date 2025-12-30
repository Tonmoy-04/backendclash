const fs = require('fs');
const path = require('path');
const os = require('os');

class Logger {
  constructor() {
    // In production/packaged Electron, use writable AppData or temp directory
    if (process.env.APP_ENV === 'electron') {
      const appDataDir = process.env.APPDATA || os.homedir();
      this.logDir = path.join(appDataDir, 'InventoryManager', 'logs');
    } else {
      this.logDir = path.join(__dirname, '../logs');
    }
    
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorFile = path.join(this.logDir, 'error.log');
    
    // Create logs directory if it doesn't exist
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.warn('Could not create log directory:', err.message);
    }
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'object' 
      ? JSON.stringify(message, null, 2) 
      : message;
    
    return `[${timestamp}] [${level}] ${formattedMessage}\n`;
  }

  writeToFile(file, message) {
    try {
      fs.appendFileSync(file, message, 'utf8');
    } catch (err) {
      // Silently fail if we can't write logs (e.g., no permissions)
      console.warn('Failed to write log:', err.message);
    }
  }

  info(message) {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    this.writeToFile(this.logFile, formattedMessage);
  }

  error(message) {
    const formattedMessage = this.formatMessage('ERROR', message);
    console.error(formattedMessage);
    this.writeToFile(this.errorFile, formattedMessage);
    this.writeToFile(this.logFile, formattedMessage);
  }

  warn(message) {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    this.writeToFile(this.logFile, formattedMessage);
  }

  debug(message) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message);
      console.debug(formattedMessage);
      this.writeToFile(this.logFile, formattedMessage);
    }
  }

  // Clean old logs (keep last 30 days)
  cleanOldLogs() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return;
      }

      const files = fs.readdirSync(this.logDir);
      if (!files || files.length === 0) {
        return;
      }

      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        try {
          const filePath = path.join(this.logDir, file);
          if (!fs.existsSync(filePath)) {
            return;
          }
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.warn(`Failed to clean log file ${file}:`, err.message);
        }
      });
    } catch (err) {
      console.warn('Failed to clean old logs:', err.message);
    }
  }
}

module.exports = new Logger();
