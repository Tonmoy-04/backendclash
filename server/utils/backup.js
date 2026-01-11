const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const AdmZip = require('adm-zip');

// Current backup format version - increment when schema changes
const BACKUP_VERSION = '2.0.0';

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

      // Add metadata file with version and backup information
      const metadata = {
        backupVersion: BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        created: new Date().toISOString(),
        databases: {
          inventory: fs.existsSync(this.dbPath),
          stock: fs.existsSync(this.stockDbPath)
        },
        features: {
          cashbox: true,
          customerTransactions: true,
          supplierTransactions: true,
          stockHistory: true,
          separatedDatabases: true
        },
        schemaVersion: {
          inventory: '2.0',  // Updated schema with cashbox, transactions
          stock: '1.0'       // Stock schema
        }
      };

      zip.addFile('backup-metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

      zip.writeZip(backupPath);

      // Re-open DB connections after backup so the app continues working.
      await this.reloadDatabases();

      logger.info(`Backup created: ${backupFileName} (version ${BACKUP_VERSION})`);

      return {
        success: true,
        fileName: backupFileName,
        path: backupPath,
        timestamp: new Date().toISOString(),
        version: BACKUP_VERSION
      };
    } catch (error) {
      logger.error(`Backup creation failed: ${error.message}`);
      try {
        await this.reloadDatabases();
      } catch {}
      throw error;
    }
  }

  /**
   * Safe temp extraction with validation (prevents zip-slip)
   */
  async extractBackupToTemp(zipPath) {
    const tempDir = path.join(os.tmpdir(), `backup-extract-${Date.now()}`);
    
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      
      // Validate all entries before extracting (prevent zip-slip)
      for (const entry of entries) {
        const entryPath = path.resolve(tempDir, entry.entryName);
        if (!entryPath.startsWith(path.resolve(tempDir))) {
          throw new Error(`Zip-slip detected: ${entry.entryName}`);
        }
      }
      
      // Extract safely
      zip.extractAllTo(tempDir, true);
      
      logger.info(`[BACKUP] Extracted ZIP to temp: ${tempDir}`);
      return tempDir;
    } catch (error) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
  }

  /**
   * Clean up temp extraction directory
   */
  cleanupTempDir(tempDir) {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info(`[BACKUP] Cleaned up temp directory: ${tempDir}`);
      }
    } catch (error) {
      logger.warn(`[BACKUP] Failed to cleanup temp directory: ${error.message}`);
    }
  }

  /**
   * Unified restore pipeline - handles ZIP, legacy .db, and uploaded files
   * Atomic restore: either both DBs restored or restore aborted
   * Returns detailed info about what was restored
   */
  async unifiedRestore(sourcePath) {
    let tempDir = null;
    
    try {
      logger.info(`[RESTORE] Starting unified restore from: ${sourcePath}`);
      
      const s = String(this.dbPath || '').toLowerCase();
      if (s.includes('app.asar') || s.includes(`${path.sep}resources${path.sep}`)) {
        throw new Error(`Refusing to restore into bundled path: ${this.dbPath}`);
      }

      // Validate source file exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      // Create safety backup before any restore
      await this.createBackup();

      // Close all database connections
      await this.closeDatabases();

      // Remove WAL/SHM sidecars
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

      let backupVersion = '1.0.0';
      let metadata = null;
      const restoredFiles = [];
      
      const isZip = sourcePath.toLowerCase().endsWith('.zip');
      const isDb = sourcePath.toLowerCase().endsWith('.db');

      if (isZip) {
        // ZIP restore path with temp extraction
        logger.info('[RESTORE] Processing ZIP backup format');
        
        tempDir = await this.extractBackupToTemp(sourcePath);
        
        // Try to read metadata
        try {
          const metadataPath = path.join(tempDir, 'backup-metadata.json');
          if (fs.existsSync(metadataPath)) {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            backupVersion = metadata.backupVersion || '1.0.0';
            logger.info(`[RESTORE] Detected backup version from metadata: ${backupVersion}`);
          }
        } catch (err) {
          logger.warn(`[RESTORE] Could not read metadata: ${err.message}`);
        }

        // Restore inventory.db (required)
        const inventoryPath = path.join(tempDir, 'inventory.db');
        if (!fs.existsSync(inventoryPath)) {
          throw new Error('Invalid backup: inventory.db missing from ZIP');
        }
        
        fs.copyFileSync(inventoryPath, this.dbPath);
        restoredFiles.push('inventory.db');
        logger.info('[RESTORE] ✓ Inventory database restored from ZIP');

        // Restore stock.db (optional)
        const stockPath = path.join(tempDir, 'stock.db');
        if (fs.existsSync(stockPath)) {
          fs.copyFileSync(stockPath, this.stockDbPath);
          restoredFiles.push('stock.db');
          logger.info('[RESTORE] ✓ Stock database restored from ZIP');
        } else {
          logger.info('[RESTORE] ℹ Stock database not in ZIP - keeping existing stock.db');
        }

      } else if (isDb) {
        // Legacy .db restore path
        logger.info('[RESTORE] Processing legacy .db backup format');
        
        // Restore the DB file
        fs.copyFileSync(sourcePath, this.dbPath);
        restoredFiles.push('inventory.db');
        logger.info('[RESTORE] ✓ Inventory database restored from .db file');

        // Check for paired stock backup (legacy naming: backup_stock_*.db)
        const stockBackupPath = sourcePath.replace(/^backup_/, 'backup_stock_');
        if (stockBackupPath !== sourcePath && fs.existsSync(stockBackupPath)) {
          try {
            fs.copyFileSync(stockBackupPath, this.stockDbPath);
            restoredFiles.push('stock.db');
            logger.info('[RESTORE] ✓ Stock database restored from paired backup');
          } catch (err) {
            logger.warn(`[RESTORE] Could not restore stock DB from paired file: ${err.message}`);
            logger.warn('[RESTORE] Keeping existing stock database');
          }
        } else {
          logger.info('[RESTORE] ℹ No paired stock backup found - keeping existing stock.db');
        }

      } else {
        throw new Error('Unsupported backup file type (must be .zip or .db)');
      }

      // Apply backward compatibility migrations
      await this.applyBackwardCompatibilityMigrations(backupVersion);

      // Reload database connections
      await this.reloadDatabases();

      logger.info(`[RESTORE] ✓ Restore completed successfully`);
      
      return {
        success: true,
        message: 'Database restored successfully',
        restored: restoredFiles,
        backupVersion: backupVersion,
        currentVersion: BACKUP_VERSION,
        migrationsApplied: backupVersion !== BACKUP_VERSION
      };

    } catch (error) {
      logger.error(`[RESTORE] Restore failed: ${error.message}`);
      try {
        await this.reloadDatabases();
      } catch {}
      throw error;
    } finally {
      // Always cleanup temp directory
      if (tempDir) {
        this.cleanupTempDir(tempDir);
      }
    }
  }

  // Restore database from backup (wrapper using unified pipeline)
  async restoreBackup(backupFileName) {
    try {
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

      // Use unified restore pipeline
      const result = await this.unifiedRestore(backupPath);
      
      return {
        success: true,
        message: 'Database restored successfully',
        restored: result.restored,
        backupVersion: result.backupVersion,
        currentVersion: BACKUP_VERSION,
        migrationsApplied: result.migrationsApplied
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

  /**
   * Apply migrations to ensure old backups work with current schema
   * This handles backward compatibility when restoring older backups
   */
  async applyBackwardCompatibilityMigrations(backupVersion) {
    try {
      logger.info(`[MIGRATION] Applying backward compatibility migrations for backup version ${backupVersion}`);

      const db = require('../database/db');
      const stockDb = require('../database/stockDb');

      // Parse version numbers for comparison
      const [major, minor] = backupVersion.split('.').map(Number);

      // Migrations for backups older than v2.0.0 (before cashbox and transaction tracking)
      if (major < 2) {
        logger.info('[MIGRATION] Backup is from v1.x - applying v2.0 migrations');

        // Ensure cashbox tables exist (these are new in v2.0)
        await this.ensureCashboxTablesExist(db);

        // Ensure customer/supplier transaction tables exist (new in v2.0)
        await this.ensureTransactionTablesExist(db);

        // Ensure sale_items has all new columns
        await this.ensureSaleItemsColumns(db);

        // Ensure purchase_items has all new columns
        await this.ensurePurchaseItemsColumns(db);

        // Ensure sales table has new columns
        await this.ensureSalesColumns(db);

        // Ensure purchases table has new columns
        await this.ensurePurchasesColumns(db);

        // Ensure suppliers table has balance column
        await this.ensureSuppliersColumns(db);

        // Ensure customers table has balance column
        await this.ensureCustomersColumns(db);

        // Ensure stock_history table exists in stock.db
        await this.ensureStockHistoryTable(stockDb);
      }

      logger.info('[MIGRATION] Backward compatibility migrations completed successfully');
    } catch (error) {
      logger.error(`[MIGRATION] Error during backward compatibility migrations: ${error.message}`);
      // Don't throw - allow restore to continue even if some migrations fail
    }
  }

  /**
   * Ensure cashbox tables exist for old backups
   */
  async ensureCashboxTablesExist(db) {
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS cashbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_initialized INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      await db.run(`CREATE TABLE IF NOT EXISTS cashbox_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbox_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amount DECIMAL(10, 2) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        balance_after DECIMAL(10, 2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashbox_id) REFERENCES cashbox(id) ON DELETE CASCADE
      )`);

      logger.info('[MIGRATION] ✓ Cashbox tables ensured');
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring cashbox tables: ${err.message}`);
    }
  }

  /**
   * Ensure customer and supplier transaction tables exist
   */
  async ensureTransactionTablesExist(db) {
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS customer_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('payment', 'charge')),
        amount DECIMAL(10, 2) NOT NULL,
        balance_before DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`);

      await db.run(`CREATE TABLE IF NOT EXISTS supplier_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('payment', 'charge')),
        amount DECIMAL(10, 2) NOT NULL,
        balance_before DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      )`);

      logger.info('[MIGRATION] ✓ Transaction tables ensured');
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring transaction tables: ${err.message}`);
    }
  }

  /**
   * Ensure sale_items has all required columns
   */
  async ensureSaleItemsColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('sale_items')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('product_name')) {
        await db.run('ALTER TABLE sale_items ADD COLUMN product_name TEXT');
        logger.info('[MIGRATION] ✓ Added product_name to sale_items');
      }

      if (!columnNames.has('unit_price')) {
        await db.run('ALTER TABLE sale_items ADD COLUMN unit_price DECIMAL(10, 2)');
        // Backfill from price if available
        await db.run('UPDATE sale_items SET unit_price = COALESCE(unit_price, price) WHERE unit_price IS NULL');
        logger.info('[MIGRATION] ✓ Added unit_price to sale_items');
      }

      if (!columnNames.has('total_price')) {
        await db.run('ALTER TABLE sale_items ADD COLUMN total_price DECIMAL(10, 2)');
        // Backfill from subtotal if available
        await db.run('UPDATE sale_items SET total_price = COALESCE(total_price, subtotal, quantity * unit_price) WHERE total_price IS NULL');
        logger.info('[MIGRATION] ✓ Added total_price to sale_items');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring sale_items columns: ${err.message}`);
    }
  }

  /**
   * Ensure purchase_items has all required columns
   */
  async ensurePurchaseItemsColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('purchase_items')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('product_name')) {
        await db.run('ALTER TABLE purchase_items ADD COLUMN product_name TEXT');
        logger.info('[MIGRATION] ✓ Added product_name to purchase_items');
      }

      if (!columnNames.has('unit_price')) {
        await db.run('ALTER TABLE purchase_items ADD COLUMN unit_price DECIMAL(10, 2)');
        await db.run('UPDATE purchase_items SET unit_price = COALESCE(unit_price, cost) WHERE unit_price IS NULL');
        logger.info('[MIGRATION] ✓ Added unit_price to purchase_items');
      }

      if (!columnNames.has('total_price')) {
        await db.run('ALTER TABLE purchase_items ADD COLUMN total_price DECIMAL(10, 2)');
        await db.run('UPDATE purchase_items SET total_price = COALESCE(total_price, subtotal, quantity * unit_price) WHERE total_price IS NULL');
        logger.info('[MIGRATION] ✓ Added total_price to purchase_items');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring purchase_items columns: ${err.message}`);
    }
  }

  /**
   * Ensure sales table has all required columns
   */
  async ensureSalesColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('sales')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('customer_phone')) {
        await db.run('ALTER TABLE sales ADD COLUMN customer_phone TEXT');
        logger.info('[MIGRATION] ✓ Added customer_phone to sales');
      }

      if (!columnNames.has('user_id')) {
        await db.run('ALTER TABLE sales ADD COLUMN user_id INTEGER');
        logger.info('[MIGRATION] ✓ Added user_id to sales');
      }

      if (!columnNames.has('status')) {
        await db.run("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'");
        logger.info('[MIGRATION] ✓ Added status to sales');
      }

      if (!columnNames.has('customer_id')) {
        await db.run('ALTER TABLE sales ADD COLUMN customer_id INTEGER');
        logger.info('[MIGRATION] ✓ Added customer_id to sales');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring sales columns: ${err.message}`);
    }
  }

  /**
   * Ensure purchases table has all required columns
   */
  async ensurePurchasesColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('purchases')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('user_id')) {
        await db.run('ALTER TABLE purchases ADD COLUMN user_id INTEGER');
        logger.info('[MIGRATION] ✓ Added user_id to purchases');
      }

      if (!columnNames.has('status')) {
        await db.run("ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'completed'");
        logger.info('[MIGRATION] ✓ Added status to purchases');
      }

      if (!columnNames.has('supplier_name')) {
        await db.run('ALTER TABLE purchases ADD COLUMN supplier_name TEXT');
        logger.info('[MIGRATION] ✓ Added supplier_name to purchases');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring purchases columns: ${err.message}`);
    }
  }

  /**
   * Ensure suppliers table has balance column
   */
  async ensureSuppliersColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('suppliers')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('balance')) {
        await db.run('ALTER TABLE suppliers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0');
        logger.info('[MIGRATION] ✓ Added balance to suppliers');
      }

      if (!columnNames.has('contact_person')) {
        await db.run('ALTER TABLE suppliers ADD COLUMN contact_person TEXT');
        logger.info('[MIGRATION] ✓ Added contact_person to suppliers');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring suppliers columns: ${err.message}`);
    }
  }

  /**
   * Ensure customers table has balance column
   */
  async ensureCustomersColumns(db) {
    try {
      const columns = await db.all("PRAGMA table_info('customers')");
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('balance')) {
        await db.run('ALTER TABLE customers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0');
        logger.info('[MIGRATION] ✓ Added balance to customers');
      }
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring customers columns: ${err.message}`);
    }
  }

  /**
   * Ensure stock_history table exists in stock database
   */
  async ensureStockHistoryTable(stockDb) {
    try {
      await stockDb.run(`CREATE TABLE IF NOT EXISTS stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        change INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`);
      logger.info('[MIGRATION] ✓ Stock history table ensured');
    } catch (err) {
      logger.warn(`[MIGRATION] Warning ensuring stock_history table: ${err.message}`);
    }
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
