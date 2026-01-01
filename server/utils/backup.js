const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const AdmZip = require('adm-zip');

class BackupManager {
  constructor() {
    const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');

    const explicitDbDir = process.env.DB_DIR;
    const dbDir = (explicitDbDir && typeof explicitDbDir === 'string')
      ? explicitDbDir
      : (isElectronEnv
        ? path.join((process.env.APPDATA || os.homedir()), 'InventoryManager', 'database')
        : path.join(__dirname, '..', 'database'));

    // Base for backups/config should be userData root (parent of database dir)
    // Electron provides DB_DIR as <userData>/database, so parent is <userData>.
    const baseDir = isElectronEnv ? path.dirname(dbDir) : path.join(__dirname, '..');

    this.configPath = path.join(baseDir, 'backup.config.json');
    this.defaultBackupDir = path.join(baseDir, 'backups');
    this.backupDir = this.defaultBackupDir;
    this.dbPath = path.join(dbDir, 'inventory.db');
    this.stockDbPath = path.join(dbDir, 'stock.db');

    const isBundled = (p) => {
      const s = String(p || '').toLowerCase();
      return s.includes('app.asar') || s.includes(`${path.sep}resources${path.sep}`);
    };

    logger.info(`[BACKUP] isElectronEnv=${isElectronEnv} DB_DIR=${explicitDbDir || ''}`);
    logger.info(`[BACKUP] Using inventory DB: ${this.dbPath}`);
    logger.info(`[BACKUP] Using stock DB: ${this.stockDbPath}`);
    logger.info(`[BACKUP] Backups dir (default): ${this.defaultBackupDir}`);

    // In Electron/packaged mode the DB MUST be in a writable userData folder.
    // If we ever see a bundled/resources path here, refuse to continue to avoid backing up stale packaged data.
    if (isElectronEnv && (isBundled(this.dbPath) || isBundled(this.stockDbPath))) {
      logger.error(`[BACKUP] Refusing to use bundled DB path. Ensure Electron sets DB_DIR to app.getPath('userData')/database. inventory=${this.dbPath}`);
    }

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
        if (config.backupDir && typeof config.backupDir === 'string') {
          this.backupDir = config.backupDir;
        }
      }
    } catch (error) {
      logger.error(`Failed to load backup config: ${error.message}`);
      this.backupDir = this.defaultBackupDir;
    }

    // If saved backupDir is invalid/unwritable, fall back to default.
    try {
      if (!this.backupDir || typeof this.backupDir !== 'string') {
        this.backupDir = this.defaultBackupDir;
      }
      fs.mkdirSync(this.backupDir, { recursive: true });
      const probe = path.join(this.backupDir, '.write-test');
      fs.writeFileSync(probe, 'ok', 'utf8');
      fs.unlinkSync(probe);
    } catch (err) {
      logger.warn(`Backup dir not writable (${this.backupDir}); using default. Reason: ${err.message}`);
      this.backupDir = this.defaultBackupDir;
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch {}
      try {
        this.saveConfig();
      } catch {}
    }
  }

  saveConfig() {
    const config = { backupDir: this.backupDir };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  ensureBackupDir() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (err) {
      logger.warn(`Failed to create backupDir (${this.backupDir}), falling back: ${err.message}`);
      this.backupDir = this.defaultBackupDir;
      fs.mkdirSync(this.backupDir, { recursive: true });
      try {
        this.saveConfig();
      } catch {}
    }
  }

  setBackupDir(newDir) {
    if (!newDir || typeof newDir !== 'string') {
      throw new Error('Invalid backup directory');
    }

    // Validate directory is writable
    try {
      fs.mkdirSync(newDir, { recursive: true });
      const probe = path.join(newDir, `.write-test-${Date.now()}`);
      fs.writeFileSync(probe, 'ok', 'utf8');
      fs.unlinkSync(probe);
    } catch (err) {
      throw new Error(`Backup directory is not writable: ${err.message}`);
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
      const s = String(this.dbPath || '').toLowerCase();
      if (s.includes('app.asar') || s.includes(`${path.sep}resources${path.sep}`)) {
        throw new Error(`Refusing to backup from bundled path: ${this.dbPath}`);
      }
      logger.info(`[BACKUP] Creating backup from source: ${this.dbPath}`);

      // Close sqlite connections to flush changes and avoid stale snapshots / locked reads.
      await this.closeDatabases();

      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.zip`;
      const backupPath = path.join(this.backupDir, backupFileName);

      if (!fs.existsSync(this.dbPath)) {
        logger.warn(`Database file not found at ${this.dbPath}, skipping backup`);
        await this.reloadDatabases();
        return { success: false, message: `Database file not found at ${this.dbPath}` };
      }

      const zip = new AdmZip();

      // Always include main DB
      zip.addLocalFile(this.dbPath, '', 'inventory.db');

      // Include stock DB if present
      if (fs.existsSync(this.stockDbPath)) {
        try {
          zip.addLocalFile(this.stockDbPath, '', 'stock.db');
        } catch (err) {
          logger.warn(`Failed to include stock database in archive: ${err.message}`);
        }
      }

      zip.writeZip(backupPath);

      // Re-open DB connections after backup so the app continues working.
      await this.reloadDatabases();

      logger.info(`Backup created: ${backupFileName}`);

      return {
        success: true,
        fileName: backupFileName,
        path: backupPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Backup creation failed: ${error.message}`);
      try {
        await this.reloadDatabases();
      } catch {}
      throw error;
    }
  }

  // Restore database from backup
  async restoreBackup(backupFileName) {
    try {
      const s = String(this.dbPath || '').toLowerCase();
      if (s.includes('app.asar') || s.includes(`${path.sep}resources${path.sep}`)) {
        throw new Error(`Refusing to restore into bundled path: ${this.dbPath}`);
      }
      if (!backupFileName || typeof backupFileName !== 'string') {
        throw new Error('fileName is required');
      }

      // If a user accidentally picks the stock-only legacy backup, map to the primary backup.
      let normalizedFileName = backupFileName;
      if (normalizedFileName.startsWith('backup_stock_') && normalizedFileName.endsWith('.db')) {
        normalizedFileName = normalizedFileName.replace(/^backup_stock_/, 'backup_');
      }

      const backupPath = path.join(this.backupDir, normalizedFileName);

      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }

      logger.info(`[RESTORE] Requested restore file: ${normalizedFileName}`);
      logger.info(`[RESTORE] Target inventory DB: ${this.dbPath}`);

      // Create a backup of current database before restoring
      await this.createBackup();

      // Close sqlite connections to avoid file locks on Windows
      await this.closeDatabases();

      // Remove any WAL/SHM sidecars to avoid mixing old/new states.
      const sidecars = [
        `${this.dbPath}-wal`,
        `${this.dbPath}-shm`,
        `${this.stockDbPath}-wal`,
        `${this.stockDbPath}-shm`
      ];
      for (const f of sidecars) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch {}
      }

      if (normalizedFileName.toLowerCase().endsWith('.zip')) {
        const zip = new AdmZip(backupPath);

        const inventoryEntry = zip.getEntry('inventory.db');
        if (!inventoryEntry) {
          throw new Error('Invalid backup archive: inventory.db missing');
        }

        fs.writeFileSync(this.dbPath, inventoryEntry.getData());

        const stockEntry = zip.getEntry('stock.db');
        if (stockEntry) {
          try {
            fs.writeFileSync(this.stockDbPath, stockEntry.getData());
            logger.info('Stock database restored from archive');
          } catch (err) {
            logger.warn(`Failed to restore stock database from archive: ${err.message}`);
          }
        }
      } else if (normalizedFileName.toLowerCase().endsWith('.db')) {
        // Legacy restore path (.db + optional backup_stock_*.db)
        fs.copyFileSync(backupPath, this.dbPath);

        const stockBackupFileName = normalizedFileName.replace(/^backup_/, 'backup_stock_');
        const stockBackupPath = path.join(this.backupDir, stockBackupFileName);
        if (fs.existsSync(stockBackupPath)) {
          try {
            fs.copyFileSync(stockBackupPath, this.stockDbPath);
            logger.info(`Stock database restored from: ${stockBackupFileName}`);
          } catch (err) {
            logger.warn(`Failed to restore stock database from legacy backup: ${err.message}`);
          }
        }
      } else {
        throw new Error('Unsupported backup file type');
      }

      // Reload DB modules so the app continues working without manual restart
      await this.reloadDatabases();

      logger.info(`Database restored from: ${normalizedFileName}`);
      
      return {
        success: true,
        message: 'Database restored successfully'
      };
    } catch (error) {
      logger.error(`Backup restoration failed: ${error.message}`);
      try {
        await this.reloadDatabases();
      } catch {}
      throw error;
    }
  }

  async closeDatabases() {
    const closeOne = async (modPath) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(modPath);
        if (mod && typeof mod.close === 'function') {
          await mod.close();
          return;
        }
        const db = mod?.db;
        if (!db || typeof db.close !== 'function') return;
        await new Promise(resolve => {
          try {
            db.close(() => resolve());
          } catch {
            resolve();
          }
        });
      } catch {
        // ignore
      }
    };

    await closeOne('../database/db');
    await closeOne('../database/stockDb');
  }

  async reloadDatabases() {
    const reopenOne = async (modPath) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(modPath);
        if (mod && typeof mod.reopen === 'function') {
          await mod.reopen();
          return;
        }
        // Fallback: if reopen isn't available, re-require (best-effort).
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(modPath);
        } catch {}
      } catch {
        // ignore
      }
    };

    await reopenOne('../database/db');
    await reopenOne('../database/stockDb');
  }

  // List all available backups
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      
      const backups = files
        .filter(file => {
          const lower = String(file).toLowerCase();
          if (lower.endsWith('.zip')) return true;

          // Legacy backups: show only primary .db backups; hide stock duplicates.
          if (!lower.endsWith('.db')) return false;
          if (lower.startsWith('backup_stock_')) return false;
          if (lower.startsWith('uploaded-')) return true;
          return lower.startsWith('backup_');
        })
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
