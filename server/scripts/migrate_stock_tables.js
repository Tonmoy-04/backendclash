const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const txDbPath = path.join(__dirname, '../database/inventory.db');
const stockDbPath = path.join(__dirname, '../database/stock.db');

const txDb = new sqlite3.Database(txDbPath);
const stockDb = new sqlite3.Database(stockDbPath);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

(async () => {
  try {
    console.log('Initializing stock database schema...');
    await run(stockDb, `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(stockDb, `CREATE TABLE IF NOT EXISTS products (
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
    await run(stockDb, `CREATE TABLE IF NOT EXISTS stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    console.log('Copying categories...');
    const categories = await all(txDb, 'SELECT id, name, description, created_at, updated_at FROM categories');
    for (const c of categories) {
      await run(stockDb,
        `INSERT OR REPLACE INTO categories (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.description, c.created_at, c.updated_at]
      );
    }

    console.log('Copying products...');
    const products = await all(txDb, 'SELECT id, name, description, price, cost, quantity, min_stock, created_at, updated_at FROM products');
    for (const p of products) {
      await run(stockDb,
        `INSERT OR REPLACE INTO products (id, name, description, price, cost, quantity, min_stock, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.description, p.price, p.cost, p.quantity, p.min_stock, p.created_at, p.updated_at]
      );
    }

    console.log('✓ Migration to stock.db completed');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    txDb.close();
    stockDb.close();
  }
})();
