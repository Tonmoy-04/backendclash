const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Always prefer a writable AppData directory when running under Electron/packaged
let STOCK_DB_DIR;
const appDataDir = process.env.APPDATA || os.homedir();
const electronDbDir = path.join(appDataDir, 'InventoryManager', 'database');

try {
  const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');
  if (isElectronEnv) {
    if (!fs.existsSync(electronDbDir)) {
      fs.mkdirSync(electronDbDir, { recursive: true });
    }
    STOCK_DB_DIR = electronDbDir;
  } else {
    STOCK_DB_DIR = __dirname;
  }
} catch (err) {
  console.warn('Could not create stock database directory, falling back to local folder:', err.message);
  STOCK_DB_DIR = __dirname;
}

const STOCK_DB_PATH = path.join(STOCK_DB_DIR, 'stock.db');

// Ensure directory exists (it should, but be safe)
try {
  fs.mkdirSync(path.dirname(STOCK_DB_PATH), { recursive: true });
} catch {}

// Create stock database connection
const stockDb = new sqlite3.Database(STOCK_DB_PATH, (err) => {
  if (err) {
    console.error('Error opening stock database:', err);
  } else {
    console.log('Connected to SQLite stock database');
    initializeStockDatabase();
  }
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  stockDb.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  stockDb.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  stockDb.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function initializeStockDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Load stock-specific schema
    const schemaPath = path.join(__dirname, 'stock.schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        await run(statement);
      }
      
      console.log('Stock database schema initialized');
    } else {
      console.warn('stock.schema.sql not found, creating tables manually');
      
      // Fallback: Create core stock tables if they don't exist
      await run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      await run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10, 2),
        cost DECIMAL(10, 2),
        quantity INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER DEFAULT 10,
        category_id INTEGER,
        barcode TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )`);

      await run(`CREATE TABLE IF NOT EXISTS stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        change INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`);
    }
  } catch (err) {
    console.error('Error initializing stock database schema:', err);
  }
}

module.exports = { db: stockDb, run, get, all };
