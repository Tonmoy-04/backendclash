const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Always prefer a writable directory when running under Electron/packaged.
// Electron main sets DB_DIR to `app.getPath('userData')/database`.
let DB_DIR;
const explicitDbDir = process.env.DB_DIR;
const appDataDir = process.env.APPDATA || os.homedir();

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
    const invPath = path.join(dir, 'inventory.db');
    if (!fs.existsSync(invPath)) continue;
    try {
      const st = fs.statSync(invPath);
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

function resolveDbDir({ explicitDir, appDataRoot, isElectronEnv }) {
  const hasExplicit = explicitDir && typeof explicitDir === 'string';

  if (!isElectronEnv) {
    if (hasExplicit) {
      tryMkdir(explicitDir);
      return explicitDir;
    }
    return __dirname;
  }

  // Packaged/Electron: DB must live under userData (provided via DB_DIR).
  // We still support a one-way migration from older AppData folders to avoid data loss.
  if (hasExplicit) {
    tryMkdir(explicitDir);

    const explicitInv = path.join(explicitDir, 'inventory.db');
    const explicitHasData = scoreDbDir(explicitDir) > 0;

    if (!explicitHasData) {
      const legacy1 = path.join(appDataRoot, 'InventoryManager', 'database');
      const legacy2 = path.join(appDataRoot, 'Inventory Manager', 'database');
      const src = pickMigrationSource({ candidates: [legacy1, legacy2] });
      if (src) {
        try {
          // Only copy if explicit is missing/empty to prevent overwriting newer userData.
          if (!fs.existsSync(explicitInv) || (fs.statSync(explicitInv).size || 0) === 0) {
            tryMkdir(explicitDir);
            fs.copyFileSync(path.join(src, 'inventory.db'), explicitInv);
            const stockSrc = path.join(src, 'stock.db');
            const stockDst = path.join(explicitDir, 'stock.db');
            if (fs.existsSync(stockSrc) && !fs.existsSync(stockDst)) {
              fs.copyFileSync(stockSrc, stockDst);
            }
          }
        } catch {}
      }
    }

    return explicitDir;
  }

  // If Electron didn't provide DB_DIR, fall back to a writable folder under AppData.
  // (This should not happen in the installed app; DB_DIR is required.)
  const fallback = path.join(appDataRoot, 'InventoryManager', 'database');
  tryMkdir(fallback);
  return fallback;
}

try {
  // If APP_ENV explicitly says electron OR we are running from a packaged resources path,
  // direct the DB to AppData (avoids read-only Program Files/resources).
  const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');
  DB_DIR = resolveDbDir({ explicitDir: explicitDbDir, appDataRoot: appDataDir, isElectronEnv });
} catch (err) {
  console.warn('Could not create database directory, falling back to local folder:', err.message);
  DB_DIR = __dirname;
}

const DB_PATH = path.join(DB_DIR, 'inventory.db');

let db;
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

function openDatabase() {
  return new Promise((resolve, reject) => {
    try {
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          return reject(err);
        }

        console.log('Connected to SQLite database');
        initPromise = Promise.resolve()
          .then(() => initializeDatabase())
          .catch((initErr) => {
            // Keep DB usable even if a migration step fails.
            console.error('Error initializing database:', initErr);
          });

        initPromise.then(() => resolve()).catch(() => resolve());
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function closeDatabase() {
  // Avoid closing while schema initialization is running.
  await awaitWithTimeout(initPromise, 5000);
  if (!db || typeof db.close !== 'function') return;
  await new Promise((resolve) => {
    try {
      db.close(() => resolve());
    } catch {
      resolve();
    }
  });
  db = null;
}

async function reopenDatabase() {
  await closeDatabase();
  await openDatabase();
}

// Create database connection
openDatabase().catch(() => {
  // Error already logged above.
});

// Promisify database methods
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database is not initialized'));
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database is not initialized'));
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database is not initialized'));
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize database schema
async function initializeDatabase() {
  try {
    // Use inventory.schema.sql which contains ONLY business logic (no products/stock)
    const schemaPath = path.join(__dirname, 'inventory.schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        await dbRun(statement);
      }
      
      console.log('Inventory database schema initialized');

      // Ensure sales tables exist with correct schema
      await ensureSalesTables();
      await ensureSaleItemsProductName();
      await ensureSaleItemsNullableProductId();
      await ensureSaleItemsShape();

      await ensurePurchaseItemsShape();
      
      // Ensure purchases tables have correct columns
      await ensurePurchasesTables();
      
      // Ensure suppliers table has correct schema
      await ensureSuppliersTable();

      // Ensure cashbox tables exist for deposit/withdrawal tracking
      await ensureCashboxTables();

      // Ensure ledger views exist
      await ensureLedgerViews();
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Products table should NOT exist in inventory.db - it belongs in stock.db only
// This function is no longer needed but kept as stub for backward compatibility
async function ensureProductColumns() {
  try {
    // Check if products table exists in inventory.db (it shouldn't)
    const tables = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    
    if (tables.length > 0) {
      console.warn('⚠️  WARNING: products table found in inventory.db - this should only exist in stock.db');
      console.warn('Please run database migration to move products to stock.db');
    }
  } catch (err) {
    console.error('Error checking for products table:', err);
  }
}

// Ensure sales tables exist with correct schema
async function ensureSalesTables() {
  try {
    // Create sale_items table if it doesn't exist (note: singular form used by controller)
    await dbRun(`CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    // Check if sales table has required columns
    const salesCols = await dbAll("PRAGMA table_info('sales')");
    const salesNames = new Set(salesCols.map(c => c.name));

    // Legacy compatibility: some older DBs used `total_amount` instead of `total`.
    // Ensure both exist so inserts/queries don't hit NOT NULL constraints.
    if (!salesNames.has('total') && salesNames.has('total_amount')) {
      await dbRun("ALTER TABLE sales ADD COLUMN total DECIMAL(10, 2)");
      console.log('Migrated: added sales.total (legacy total_amount compatibility)');
      try {
        await dbRun("UPDATE sales SET total = COALESCE(total, total_amount, 0) WHERE total IS NULL");
      } catch (e) {
        console.warn('Warning: failed to backfill sales.total from total_amount:', e.message);
      }
    }

    if (!salesNames.has('total_amount') && salesNames.has('total')) {
      await dbRun("ALTER TABLE sales ADD COLUMN total_amount DECIMAL(10, 2)");
      console.log('Migrated: added sales.total_amount (legacy compatibility)');
      try {
        await dbRun("UPDATE sales SET total_amount = COALESCE(total, total_amount, 0) WHERE total_amount IS NULL");
      } catch (e) {
        console.warn('Warning: failed to backfill sales.total_amount from total:', e.message);
      }
    }

    if (!salesNames.has('customer_name')) {
      await dbRun("ALTER TABLE sales ADD COLUMN customer_name TEXT");
      console.log('Migrated: added sales.customer_name');
    }

    if (!salesNames.has('customer_phone')) {
      await dbRun("ALTER TABLE sales ADD COLUMN customer_phone TEXT");
      console.log('Migrated: added sales.customer_phone');
    }

    if (!salesNames.has('subtotal')) {
      await dbRun("ALTER TABLE sales ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added sales.subtotal');
    }

    if (!salesNames.has('tax')) {
      await dbRun("ALTER TABLE sales ADD COLUMN tax DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added sales.tax');
    }

    if (!salesNames.has('payment_method')) {
      await dbRun("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash'");
      console.log('Migrated: added sales.payment_method');
    }

    if (!salesNames.has('sale_date')) {
      await dbRun("ALTER TABLE sales ADD COLUMN sale_date DATETIME DEFAULT CURRENT_TIMESTAMP");
      console.log('Migrated: added sales.sale_date');
    }

    if (!salesNames.has('discount')) {
      await dbRun("ALTER TABLE sales ADD COLUMN discount DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added sales.discount');
    }

    if (!salesNames.has('transport_fee')) {
      await dbRun("ALTER TABLE sales ADD COLUMN transport_fee DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added sales.transport_fee');
    }

    if (!salesNames.has('labour_fee')) {
      await dbRun("ALTER TABLE sales ADD COLUMN labour_fee DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added sales.labour_fee');
    }

    if (!salesNames.has('customer_address')) {
      await dbRun("ALTER TABLE sales ADD COLUMN customer_address TEXT DEFAULT NULL");
      console.log('Migrated: added sales.customer_address');
    }

    if (!salesNames.has('description')) {
      await dbRun("ALTER TABLE sales ADD COLUMN description TEXT DEFAULT NULL");
      console.log('Migrated: added sales.description');
    }

    console.log('Sales tables migrated successfully');
  } catch (err) {
    console.error('Error ensuring sales tables:', err);
  }
}

// Ensure sale_items table has product_name column for UI-entered items
async function ensureSaleItemsProductName() {
  try {
    const cols = await dbAll("PRAGMA table_info('sale_items')");
    const names = new Set(cols.map(c => c.name));
    if (!names.has('product_name')) {
      await dbRun("ALTER TABLE sale_items ADD COLUMN product_name TEXT");
      console.log('Migrated: added sale_items.product_name');
    }
  } catch (err) {
    console.error('Error ensuring sale_items.product_name:', err);
  }
}

// Ensure sale_items.product_id allows NULL to support manual item names
async function ensureSaleItemsNullableProductId() {
  try {
    const cols = await dbAll("PRAGMA table_info('sale_items')");
    if (!cols || cols.length === 0) return;

    const colMap = new Map(cols.map(c => [c.name, c]));
    const productIdCol = colMap.get('product_id');
    const needsMigration = productIdCol && productIdCol.notnull === 1;

    if (!needsMigration) return;

    console.log('Migrating sale_items to allow NULL product_id...');

    await dbRun(`CREATE TABLE IF NOT EXISTS sale_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    await dbRun(`INSERT INTO sale_items_new (id, sale_id, product_id, product_name, quantity, price, subtotal, unit_price, total_price, created_at)
      SELECT id,
             sale_id,
             product_id,
             product_name,
             quantity,
             COALESCE(price, unit_price, 0) as price,
             COALESCE(subtotal, total_price, quantity * COALESCE(price, unit_price, 0)) as subtotal,
             unit_price,
             total_price,
             created_at
      FROM sale_items`);

    await dbRun('DROP TABLE sale_items');
    await dbRun('ALTER TABLE sale_items_new RENAME TO sale_items');
    console.log('Migrated: sale_items.product_id is now nullable with product_name preserved');
  } catch (err) {
    console.error('Error migrating sale_items.product_id to NULLABLE:', err);
  }
}

// Ensure sale_items has required columns and nullable product_id in one pass
async function ensureSaleItemsShape() {
  try {
    const cols = await dbAll("PRAGMA table_info('sale_items')");
    if (!cols || cols.length === 0) return;

    const names = new Set(cols.map(c => c.name));
    const productIdCol = cols.find(c => c.name === 'product_id');
    const needsProductName = !names.has('product_name');
    const needsPriceDefaults = !names.has('price') || !names.has('subtotal');
    const needsUnitTotals = !names.has('unit_price') || !names.has('total_price');
    const productIdNotNull = productIdCol && productIdCol.notnull === 1;

    const needsRebuild = needsProductName || productIdNotNull || needsPriceDefaults || needsUnitTotals;
    if (!needsRebuild) return;

    console.log('Rebuilding sale_items to include product_name and nullable product_id...');

    await dbRun('DROP TABLE IF EXISTS sale_items_new');
    await dbRun(`CREATE TABLE sale_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    const hasUnit = names.has('unit_price');
    const hasTotal = names.has('total_price');
    const hasPrice = names.has('price');
    const hasSubtotal = names.has('subtotal');
    const hasProductName = names.has('product_name');

    await dbRun(`INSERT INTO sale_items_new (id, sale_id, product_id, product_name, quantity, price, subtotal, unit_price, total_price, created_at)
      SELECT 
        id,
        sale_id,
        ${names.has('product_id') ? 'product_id' : 'NULL'} AS product_id,
        ${hasProductName ? 'product_name' : "''"} AS product_name,
        quantity,
        ${hasPrice ? 'COALESCE(price, unit_price, 0)' : hasUnit ? 'COALESCE(unit_price, 0)' : '0'} AS price,
        ${hasSubtotal ? 'COALESCE(subtotal, total_price, quantity * COALESCE(price, unit_price, 0))' : hasTotal ? 'COALESCE(total_price, 0)' : '0'} AS subtotal,
        ${hasUnit ? 'unit_price' : hasPrice ? 'price' : '0'} AS unit_price,
        ${hasTotal ? 'total_price' : hasSubtotal ? 'subtotal' : '0'} AS total_price,
        created_at
      FROM sale_items`);

    await dbRun('DROP TABLE sale_items');
    await dbRun('ALTER TABLE sale_items_new RENAME TO sale_items');
    console.log('sale_items rebuilt with product_name and nullable product_id');
  } catch (err) {
    console.error('Error ensuring sale_items shape:', err);
  }
}

// Ensure purchase_items allows nullable product_id and has product_name
async function ensurePurchaseItemsShape() {
  try {
    const cols = await dbAll("PRAGMA table_info('purchase_items')");
    if (!cols || cols.length === 0) {
      // Table missing; create with expected shape.
      await dbRun(`CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT,
        quantity INTEGER NOT NULL,
        cost DECIMAL(10, 2) DEFAULT 0,
        subtotal DECIMAL(10, 2) DEFAULT 0,
        unit_price DECIMAL(10, 2),
        total_price DECIMAL(10, 2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      )`);
      console.log('Created purchase_items table');
      return;
    }

    const names = new Set(cols.map(c => c.name));
    const productIdCol = cols.find(c => c.name === 'product_id');
    const needsProductName = !names.has('product_name');
    const productIdNotNull = productIdCol && productIdCol.notnull === 1;
    const needsUnitTotals = !names.has('unit_price') || !names.has('total_price');
    const needsCostSubtotal = !names.has('cost') || !names.has('subtotal');
    const needsRebuild = needsProductName || productIdNotNull || needsUnitTotals || needsCostSubtotal;
    if (!needsRebuild) return;

    console.log('Rebuilding purchase_items to include product_name and nullable product_id...');

    await dbRun('DROP TABLE IF EXISTS purchase_items_new');
    await dbRun(`CREATE TABLE purchase_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      cost DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    const hasUnit = names.has('unit_price');
    const hasTotal = names.has('total_price');
    const hasCost = names.has('cost');
    const hasSubtotal = names.has('subtotal');
    const hasProductName = names.has('product_name');

    await dbRun(`INSERT INTO purchase_items_new (id, purchase_id, product_id, product_name, quantity, cost, subtotal, unit_price, total_price, created_at)
      SELECT 
        id,
        purchase_id,
        ${names.has('product_id') ? 'product_id' : 'NULL'} AS product_id,
        ${hasProductName ? 'product_name' : "''"} AS product_name,
        quantity,
        ${hasCost ? 'COALESCE(cost, unit_price, 0)' : hasUnit ? 'COALESCE(unit_price, 0)' : '0'} AS cost,
        ${hasSubtotal ? 'COALESCE(subtotal, total_price, quantity * COALESCE(cost, unit_price, 0))' : hasTotal ? 'COALESCE(total_price, 0)' : '0'} AS subtotal,
        ${hasUnit ? 'unit_price' : hasCost ? 'cost' : '0'} AS unit_price,
        ${hasTotal ? 'total_price' : hasSubtotal ? 'subtotal' : '0'} AS total_price,
        created_at
      FROM purchase_items`);

    await dbRun('DROP TABLE purchase_items');
    await dbRun('ALTER TABLE purchase_items_new RENAME TO purchase_items');
    console.log('purchase_items rebuilt with product_name and nullable product_id');
  } catch (err) {
    console.error('Error ensuring purchase_items shape:', err);
  }
}

// Ensure purchases tables have correct columns
async function ensurePurchasesTables() {
  try {
    const purchasesCols = await dbAll("PRAGMA table_info('purchases')");
    const purchasesNames = new Set(purchasesCols.map(c => c.name));

    // Ensure purchase_items exists before attempting ALTERs.
    await dbRun(`CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      cost DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    if (!purchasesNames.has('purchase_date')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP");
      console.log('Migrated: added purchases.purchase_date');
    }

    if (!purchasesNames.has('payment_method')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN payment_method TEXT DEFAULT 'cash'");
      console.log('Migrated: added purchases.payment_method');
    }

    if (!purchasesNames.has('user_id')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN user_id INTEGER");
      console.log('Migrated: added purchases.user_id');
    }

    if (!purchasesNames.has('total')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN total DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchases.total');
    }

    if (!purchasesNames.has('discount')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN discount DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchases.discount');
    }

    // New fee columns for transport and labour (keep defaults for backward compatibility)
    if (!purchasesNames.has('transport_fee')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN transport_fee DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchases.transport_fee');
    }

    if (!purchasesNames.has('labour_fee')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN labour_fee DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchases.labour_fee');
    }

    if (!purchasesNames.has('supplier_address')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN supplier_address TEXT DEFAULT NULL");
      console.log('Migrated: added purchases.supplier_address');
    }

    if (!purchasesNames.has('description')) {
      await dbRun("ALTER TABLE purchases ADD COLUMN description TEXT DEFAULT NULL");
      console.log('Migrated: added purchases.description');
    }

    // Check purchase_items table
    const itemsCols = await dbAll("PRAGMA table_info('purchase_items')");
    const itemsNames = new Set(itemsCols.map(c => c.name));

    if (!itemsNames.has('cost')) {
      await dbRun("ALTER TABLE purchase_items ADD COLUMN cost DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchase_items.cost');
    }

    if (!itemsNames.has('subtotal')) {
      await dbRun("ALTER TABLE purchase_items ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0");
      console.log('Migrated: added purchase_items.subtotal');
    }

    if (!itemsNames.has('unit_price')) {
      await dbRun("ALTER TABLE purchase_items ADD COLUMN unit_price DECIMAL(10, 2)");
      console.log('Migrated: added purchase_items.unit_price');
    }

    if (!itemsNames.has('total_price')) {
      await dbRun("ALTER TABLE purchase_items ADD COLUMN total_price DECIMAL(10, 2)");
      console.log('Migrated: added purchase_items.total_price');
    }

    console.log('Purchases tables migrated successfully');
  } catch (err) {
    console.error('Error ensuring purchases tables:', err);
  }
}

// Ensure suppliers table has correct schema (name and other fields optional)
async function ensureSuppliersTable() {
  try {
    // Check current suppliers table columns
    const cols = await dbAll("PRAGMA table_info('suppliers')");
    const colMap = {};
    cols.forEach(col => {
      colMap[col.name] = col;
    });

    // If table has NOT NULL constraints on optional fields, we need to recreate it
    const hasOldSchema = colMap.name && colMap.name.notnull === 1;

    if (hasOldSchema) {
      console.log('Migrating suppliers table to new schema (optional fields)...');
      
      // Back up existing data
      await dbRun(`CREATE TABLE IF NOT EXISTS suppliers_old AS SELECT * FROM suppliers`);
      
      // Drop old table
      await dbRun(`DROP TABLE suppliers`);
      
      // Create new table with optional fields
      await dbRun(`CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        contact_person TEXT,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Restore data, handling old columns that no longer exist
      try {
        const hadBalance = !!colMap.balance;
        if (hadBalance) {
          await dbRun(`INSERT INTO suppliers (id, name, email, phone, address, contact_person, balance, created_at, updated_at)
            SELECT id, name, email, phone, address, contact_person, COALESCE(balance, 0), created_at, updated_at FROM suppliers_old`);
        } else {
          await dbRun(`INSERT INTO suppliers (id, name, email, phone, address, contact_person, balance, created_at, updated_at)
            SELECT id, name, email, phone, address, contact_person, 0, created_at, updated_at FROM suppliers_old`);
        }
        console.log('Migrated: Restored supplier data to new schema');
      } catch (err) {
        console.error('Error restoring supplier data:', err);
      }
      
      // Drop backup table
      await dbRun(`DROP TABLE IF EXISTS suppliers_old`);
    }

    // Check for removed columns (city, state, zip_code, country) and drop them if they exist
    if (colMap.city || colMap.state || colMap.zip_code || colMap.country) {
      console.log('Migrating suppliers table to remove deprecated columns...');
      
      // SQLite doesn't support DROP COLUMN directly in all versions, so we recreate
      await dbRun(`CREATE TABLE IF NOT EXISTS suppliers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        contact_person TEXT,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      try {
        // Some older DBs may not have balance; default it to 0.
        const colsNow = await dbAll("PRAGMA table_info('suppliers')");
        const namesNow = new Set(colsNow.map(c => c.name));
        if (namesNow.has('balance')) {
          await dbRun(`INSERT INTO suppliers_new (id, name, email, phone, address, contact_person, balance, created_at, updated_at)
            SELECT id, name, email, phone, address, contact_person, COALESCE(balance, 0), created_at, updated_at FROM suppliers`);
        } else {
          await dbRun(`INSERT INTO suppliers_new (id, name, email, phone, address, contact_person, balance, created_at, updated_at)
            SELECT id, name, email, phone, address, contact_person, 0, created_at, updated_at FROM suppliers`);
        }
        
        await dbRun(`DROP TABLE suppliers`);
        await dbRun(`ALTER TABLE suppliers_new RENAME TO suppliers`);
        console.log('Migrated: Removed deprecated columns from suppliers table');
      } catch (err) {
        console.error('Error removing deprecated columns:', err);
        await dbRun(`DROP TABLE IF EXISTS suppliers_new`);
      }
    }

    // Ensure balance column exists even if no full migration ran.
    try {
      const finalCols = await dbAll("PRAGMA table_info('suppliers')");
      const finalNames = new Set(finalCols.map(c => c.name));
      if (!finalNames.has('balance')) {
        await dbRun("ALTER TABLE suppliers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0");
        console.log('Migrated: added suppliers.balance');
      }
    } catch (err) {
      console.error('Error ensuring suppliers.balance:', err);
    }

    console.log('Suppliers table migrated successfully');
  } catch (err) {
    console.error('Error ensuring suppliers table:', err);
  }
}

// Ensure cashbox base tables exist so cashbox UI can function
async function ensureCashboxTables() {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS cashbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
      current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
      is_initialized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS cashbox_transactions (
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

    // Handle older DBs where tables exist but columns differ.
    try {
      const cashboxCols = await dbAll("PRAGMA table_info('cashbox')");
      const cashboxNames = new Set(cashboxCols.map(c => c.name));
      if (!cashboxNames.has('opening_balance')) {
        await dbRun('ALTER TABLE cashbox ADD COLUMN opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0');
      }
      if (!cashboxNames.has('current_balance')) {
        await dbRun('ALTER TABLE cashbox ADD COLUMN current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0');
      }
      if (!cashboxNames.has('is_initialized')) {
        await dbRun('ALTER TABLE cashbox ADD COLUMN is_initialized INTEGER DEFAULT 0');
        // Best-effort backfill from legacy column name.
        if (cashboxNames.has('initialized')) {
          try {
            await dbRun('UPDATE cashbox SET is_initialized = COALESCE(is_initialized, initialized, 0)');
          } catch {}
        }
      }
      if (!cashboxNames.has('updated_at')) {
        await dbRun('ALTER TABLE cashbox ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      }

      // Legacy schemas sometimes include an `amount` column with NOT NULL.
      // Keep it populated so inserts/updates don't violate constraints.
      if (cashboxNames.has('amount')) {
        try {
          await dbRun(
            'UPDATE cashbox SET amount = COALESCE(amount, current_balance, opening_balance, 0) WHERE amount IS NULL'
          );
        } catch {}
      }
    } catch (e) {
      console.warn('Cashbox table migration warning:', e.message);
    }

    try {
      const txCols = await dbAll("PRAGMA table_info('cashbox_transactions')");
      const txNames = new Set(txCols.map(c => c.name));
      if (!txNames.has('note')) {
        await dbRun('ALTER TABLE cashbox_transactions ADD COLUMN note TEXT');
      }
      if (!txNames.has('balance_after')) {
        await dbRun('ALTER TABLE cashbox_transactions ADD COLUMN balance_after DECIMAL(10, 2) NOT NULL DEFAULT 0');
      }
      if (!txNames.has('created_at')) {
        await dbRun('ALTER TABLE cashbox_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      }
      if (!txNames.has('date')) {
        await dbRun('ALTER TABLE cashbox_transactions ADD COLUMN date DATETIME DEFAULT CURRENT_TIMESTAMP');
      }
    } catch (e) {
      console.warn('Cashbox transactions migration warning:', e.message);
    }

    console.log('Cashbox tables ensured');
  } catch (err) {
    console.error('Error ensuring cashbox tables:', err);
  }
}

module.exports = {
  get db() {
    return db;
  },
  run: dbRun,
  get: dbGet,
  all: dbAll,
  close: closeDatabase,
  reopen: reopenDatabase,
  getPaths: () => ({
    dbDir: DB_DIR,
    inventoryDbPath: DB_PATH
  })
};

// Create computed views for daily ledgers
async function ensureLedgerViews() {
  try {
    await dbRun(`CREATE VIEW IF NOT EXISTS customer_daily_ledger AS
      SELECT 
        customer_id,
        DATE(created_at) AS date,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) AS deposit,
        SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END) AS spend,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END) AS balance,
        CASE 
          WHEN (SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END)) > 0 THEN 'Advanced'
          WHEN (SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END)) < 0 THEN 'Due'
          ELSE 'No Due'
        END AS status
      FROM customer_transactions
      GROUP BY customer_id, DATE(created_at)`);
    console.log('Ledger views ensured (customer_daily_ledger)');

    await dbRun(`CREATE VIEW IF NOT EXISTS supplier_daily_ledger AS
      SELECT 
        supplier_id,
        DATE(created_at) AS date,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) AS deposit,
        SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END) AS spend,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END) AS balance,
        CASE 
          WHEN (SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END)) > 0 THEN 'Advanced'
          WHEN (SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END)) < 0 THEN 'Due'
          ELSE 'No Due'
        END AS status
      FROM supplier_transactions
      GROUP BY supplier_id, DATE(created_at)`);
    console.log('Ledger views ensured (supplier_daily_ledger)');
  } catch (err) {
    console.error('Error ensuring ledger views:', err);
  }
}
