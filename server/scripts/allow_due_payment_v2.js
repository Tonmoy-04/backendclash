const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'inventory.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function migrateTable(table, createSql, columns) {
  console.log(`\nMigrating ${table} to allow payment_method = 'due'...`);
  await run('PRAGMA foreign_keys = OFF');
  await run('BEGIN TRANSACTION');
  try {
    await run(`ALTER TABLE ${table} RENAME TO ${table}_old`);
    await run(createSql);
    await run(
      `INSERT INTO ${table} (${columns}) SELECT ${columns} FROM ${table}_old`
    );
    await run(`DROP TABLE ${table}_old`);
    await run('COMMIT');
    console.log(`✓ ${table} migrated`);
  } catch (err) {
    await run('ROLLBACK');
    console.error(`✗ Failed migrating ${table}:`, err.message);
    throw err;
  } finally {
    await run('PRAGMA foreign_keys = ON');
  }
}

(async () => {
  try {
    await migrateTable(
      'sales',
      `CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_phone TEXT,
        subtotal REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'due' CHECK(payment_method IN ('cash','card','bank_transfer','due')),
        notes TEXT,
        sale_date DATE DEFAULT CURRENT_DATE,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      'id, customer_name, customer_phone, subtotal, tax, total, payment_method, notes, sale_date, user_id, created_at, updated_at'
    );

    await migrateTable(
      'purchases',
      `CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'due' CHECK(payment_method IN ('cash','card','bank_transfer','due')),
        status TEXT DEFAULT 'pending',
        notes TEXT,
        purchase_date DATE DEFAULT CURRENT_DATE,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      'id, supplier_id, total, payment_method, status, notes, purchase_date, user_id, created_at, updated_at'
    );

    console.log('\n✅ Migration completed. payment_method now supports "due".');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    db.close();
  }
})();
