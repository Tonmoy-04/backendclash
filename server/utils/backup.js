const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

class BackupManager {
  constructor() {
    // Prefer a writable AppData base when running packaged/Electron
    const appDataDir = process.env.APPDATA || os.homedir();
    const electronBaseDir = path.join(appDataDir, 'InventoryManager');
    const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');
    const baseDir = isElectronEnv ? electronBaseDir : path.join(__dirname, '..');

    this.configPath = path.join(baseDir, 'backup.config.json');
    this.defaultBackupDir = path.join(baseDir, 'backups');
    this.backupDir = this.defaultBackupDir;
    this.dbPath = path.join(baseDir, 'database', 'inventory.db');
    this.stockDbPath = path.join(baseDir, 'database', 'stock.db');

    // Ensure base directories exist in packaged mode
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    } catch (err) {
      logger.warn(`Could not prime backup base directories: ${err.message}`);
    }
    
    // Load stored config if present
    this.loadConfig();
    
    // Ensure backup directory exists
    this.ensureBackupDir();
  }

  getDefaultDir() {
    return this.defaultBackupDir;
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (config.backupDir) {
          this.backupDir = config.backupDir;
        }
      }
    } catch (error) {
      logger.error(`Failed to load backup config: ${error.message}`);
      this.backupDir = this.defaultBackupDir;
    }
  }

  saveConfig() {
    const config = { backupDir: this.backupDir };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  setBackupDir(newDir) {
    if (!newDir || typeof newDir !== 'string') {
      throw new Error('Invalid backup directory');
    }

    this.backupDir = newDir;
    this.ensureBackupDir();
    this.saveConfig();

    logger.info(`Backup directory set to ${newDir}`);

    return { success: true, backupDir: this.backupDir };
  }

  resetBackupDir() {
    this.backupDir = this.defaultBackupDir;
    this.ensureBackupDir();
    this.saveConfig();
    logger.info('Backup directory reset to default');
    return { success: true, backupDir: this.backupDir };
  }

  // Create a backup of the database
  async createBackup() {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.db`;
      const stockBackupFileName = `backup_stock_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);
      const stockBackupPath = path.join(this.backupDir, stockBackupFileName);

      // Copy main database file if it exists
      if (!fs.existsSync(this.dbPath)) {
        logger.warn(`Database file not found at ${this.dbPath}, skipping backup`);
        return { success: false, message: 'Database file not found' };
      }

      try {
        fs.copyFileSync(this.dbPath, backupPath);
      } catch (err) {
        logger.error(`Failed to backup main database: ${err.message}`);
        throw err;
      }

      // Copy stock database file if it exists
      if (fs.existsSync(this.stockDbPath)) {
        try {
          fs.copyFileSync(this.stockDbPath, stockBackupPath);
          logger.info(`Stock backup created: ${stockBackupFileName}`);
        } catch (err) {
          logger.warn(`Failed to backup stock database: ${err.message}`);
        }
      }

      logger.info(`Backup created: ${backupFileName}`);
      
      return {
        success: true,
        fileName: backupFileName,
        stockFileName: stockBackupFileName,
        path: backupPath,
        stockPath: stockBackupPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Backup creation failed: ${error.message}`);
      throw error;
    }
  }

  // Restore database from backup
  async restoreBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);

      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }

      // Create a backup of current database before restoring
      await this.createBackup();

      // Restore main database backup
      fs.copyFileSync(backupPath, this.dbPath);

      // Restore stock database backup if it exists
      const stockBackupFileName = backupFileName.replace('backup_', 'backup_stock_');
      const stockBackupPath = path.join(this.backupDir, stockBackupFileName);
      
      if (fs.existsSync(stockBackupPath)) {
        fs.copyFileSync(stockBackupPath, this.stockDbPath);
        logger.info(`Stock database restored from: ${stockBackupFileName}`);
      } else {
        logger.warn(`Stock backup file not found: ${stockBackupFileName}`);
      }

      logger.info(`Database restored from: ${backupFileName}`);
      
      return {
        success: true,
        message: 'Database restored successfully'
      };
    } catch (error) {
      logger.error(`Backup restoration failed: ${error.message}`);
      throw error;
    }
  }

  // List all available backups
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      
      const backups = files
        .filter(file => file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            fileName: file,
            size: stats.size,
            created: stats.mtime,
            path: filePath
          };
        })
        .sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      logger.error(`Failed to list backups: ${error.message}`);
      throw error;
    }
  }

  // Delete a specific backup file
  deleteBackup(fileName) {
    if (!fileName) {
      throw new Error('fileName is required');
    }

    const targetPath = path.join(this.backupDir, fileName);
    // Prevent path traversal outside backupDir
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(this.backupDir))) {
      throw new Error('Invalid backup path');
    }
    if (!fs.existsSync(targetPath)) {
      throw new Error('Backup file not found');
    }

    fs.unlinkSync(targetPath);
    logger.info(`Deleted backup: ${fileName}`);
    return { success: true, fileName };
  }

  // Delete old backups (keep last N backups)
  cleanOldBackups(keepCount = 10) {
    try {
      const backups = this.listBackups();
      
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);
        
        toDelete.forEach(backup => {
          fs.unlinkSync(backup.path);
          logger.info(`Deleted old backup: ${backup.fileName}`);
        });

        return {
          success: true,
          deletedCount: toDelete.length
        };
      }

      return {
        success: true,
        deletedCount: 0
      };
    } catch (error) {
      logger.error(`Failed to clean old backups: ${error.message}`);
      throw error;
    }
  }

  // Schedule automatic backups
  scheduleAutoBackup(intervalHours = 24) {
    setInterval(async () => {
      try {
        await this.createBackup();
        await this.cleanOldBackups();
        logger.info('Automatic backup completed');
      } catch (error) {
        logger.error(`Automatic backup failed: ${error.message}`);
      }
    }, intervalHours * 60 * 60 * 1000);

    logger.info(`Automatic backup scheduled every ${intervalHours} hours`);
  }
}

module.exports = new BackupManager();
