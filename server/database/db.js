const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Always prefer a writable directory when running under Electron/packaged.
// Electron main sets DB_DIR to `app.getPath('userData')/database`.
let DB_DIR;
const explicitDbDir = process.env.DB_DIR;
const appDataDir = process.env.APPDATA || os.homedir();
const electronDbDir = path.join(appDataDir, 'InventoryManager', 'database');

try {
  if (explicitDbDir && typeof explicitDbDir === 'string') {
    if (!fs.existsSync(explicitDbDir)) {
      fs.mkdirSync(explicitDbDir, { recursive: true });
    }
    DB_DIR = explicitDbDir;
  } else {
    // If APP_ENV explicitly says electron OR we are running from a packaged resources path,
    // direct the DB to AppData (avoids read-only Program Files/resources).
    const isElectronEnv = process.env.APP_ENV === 'electron' || String(__dirname).includes('resources');
    if (isElectronEnv) {
      if (!fs.existsSync(electronDbDir)) {
        fs.mkdirSync(electronDbDir, { recursive: true });
      }
      DB_DIR = electronDbDir;
    } else {
      DB_DIR = __dirname;
    }
  }
} catch (err) {
  console.warn('Could not create database directory, falling back to local folder:', err.message);
  DB_DIR = __dirname;
}

const DB_PATH = path.join(DB_DIR, 'inventory.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Promisify database methods
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
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
    if (!cols || cols.length === 0) return;

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

    console.log('Cashbox tables ensured');
  } catch (err) {
    console.error('Error ensuring cashbox tables:', err);
  }
}

module.exports = {
  db,
  run: dbRun,
  get: dbGet,
  all: dbAll
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
