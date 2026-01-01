const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Always prefer a writable directory when running under Electron/packaged.
// Electron main sets DB_DIR to `app.getPath('userData')/database`.
let STOCK_DB_DIR;
const explicitDbDir = process.env.DB_DIR;
const appDataDir = process.env.APPDATA || os.homedir();

function isPackagedReadonlyPath(p) {
  const s = String(p || '').toLowerCase();
  return s.includes('app.asar') || s.includes(`${path.sep}resources${path.sep}`);
}

function tryMkdir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function pickMigrationSource({ candidates = [] } = {}) {
  const scored = [];
  for (const dir of candidates) {
    if (!dir || typeof dir !== 'string') continue;
    if (isPackagedReadonlyPath(dir)) continue;
    const stockPath = path.join(dir, 'stock.db');
    if (!fs.existsSync(stockPath)) continue;
    try {
      const st = fs.statSync(stockPath);
      const size = st.size || 0;
      const mtimeMs = st.mtimeMs || 0;
      if (size <= 0) continue;
      scored.push({ dir, size, mtimeMs });
    } catch {
      // ignore
    }
  }
  scored.sort((a, b) => (b.mtimeMs - a.mtimeMs) || (b.size - a.size));
  return scored[0]?.dir || null;
}

function scoreDbDir(dir) {
  try {
    const invPath = path.join(dir, 'inventory.db');
    const stockPath = path.join(dir, 'stock.db');
    const invSize = fs.existsSync(invPath) ? fs.statSync(invPath).size : 0;
    const stockSize = fs.existsSync(stockPath) ? fs.statSync(stockPath).size : 0;
    return invSize + stockSize;
  } catch {
    return 0;
  }
}

function resolveDbDir({ explicitDir, appDataRoot, isElectronEnv }) {
  const hasExplicit = explicitDir && typeof explicitDir === 'string';

  if (!isElectronEnv) {
    if (hasExplicit) {
      tryMkdir(explicitDir);
      return explicitDir;
    }
    return __dirname;
  }

  if (hasExplicit) {
    tryMkdir(explicitDir);

    const explicitStock = path.join(explicitDir, 'stock.db');
    const explicitHasData = scoreDbDir(explicitDir) > 0;
    if (!explicitHasData) {
      const legacy1 = path.join(appDataRoot, 'InventoryManager', 'database');
      const legacy2 = path.join(appDataRoot, 'Inventory Manager', 'database');
      const src = pickMigrationSource({ candidates: [legacy1, legacy2] });
      if (src) {
        try {
          if (!fs.existsSync(explicitStock) || (fs.statSync(explicitStock).size || 0) === 0) {
            tryMkdir(explicitDir);
            fs.copyFileSync(path.join(src, 'stock.db'), explicitStock);
          }
        } catch {}
      }
    }

    return explicitDir;
  }

  const fallback = path.join(appDataRoot, 'InventoryManager', 'database');
  tryMkdir(fallback);
  return fallback;
}

try {
  const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');
  STOCK_DB_DIR = resolveDbDir({ explicitDir: explicitDbDir, appDataRoot: appDataDir, isElectronEnv });
} catch (err) {
  console.warn('Could not create stock database directory, falling back to local folder:', err.message);
  STOCK_DB_DIR = __dirname;
}

const STOCK_DB_PATH = path.join(STOCK_DB_DIR, 'stock.db');

// Ensure directory exists (it should, but be safe)
try {
  fs.mkdirSync(path.dirname(STOCK_DB_PATH), { recursive: true });
} catch {}

let stockDb;
let initPromise = Promise.resolve();

function awaitWithTimeout(promise, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) resolve();
    }, timeoutMs);
    Promise.resolve(promise)
      .then(() => {
        settled = true;
        clearTimeout(timer);
        resolve();
      })
      .catch(() => {
        settled = true;
        clearTimeout(timer);
        resolve();
      });
  });
}

function openStockDatabase() {
  return new Promise((resolve, reject) => {
    try {
      stockDb = new sqlite3.Database(STOCK_DB_PATH, (err) => {
        if (err) {
          console.error('Error opening stock database:', err);
          return reject(err);
        }

        console.log('Connected to SQLite stock database');
        initPromise = Promise.resolve()
          .then(() => initializeStockDatabase())
          .catch((initErr) => {
            console.error('Error initializing stock database schema:', initErr);
          });

        initPromise.then(() => resolve()).catch(() => resolve());
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function closeStockDatabase() {
  await awaitWithTimeout(initPromise, 5000);
  if (!stockDb || typeof stockDb.close !== 'function') return;
  await new Promise((resolve) => {
    try {
      stockDb.close(() => resolve());
    } catch {
      resolve();
    }
  });
  stockDb = null;
}

async function reopenStockDatabase() {
  await closeStockDatabase();
  await openStockDatabase();
}

// Create stock database connection
openStockDatabase().catch(() => {
  // Error already logged above.
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  if (!stockDb) return reject(new Error('Stock database is not initialized'));
  stockDb.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  if (!stockDb) return reject(new Error('Stock database is not initialized'));
  stockDb.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  if (!stockDb) return reject(new Error('Stock database is not initialized'));
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

module.exports = {
  get db() {
    return stockDb;
  },
  run,
  get,
  all,
  close: closeStockDatabase,
  reopen: reopenStockDatabase,
  getPaths: () => ({
    dbDir: STOCK_DB_DIR,
    stockDbPath: STOCK_DB_PATH
  })
};
