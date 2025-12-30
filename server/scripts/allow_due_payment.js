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
        user_id INTEGER,
        customer_id INTEGER,
        subtotal DECIMAL(10, 2) DEFAULT 0,
        tax DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'due' CHECK(payment_method IN ('cash','card','bank_transfer','due')),
        notes TEXT,
        status TEXT DEFAULT 'completed',
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      'id, customer_name, customer_phone, user_id, customer_id, subtotal, tax, total, payment_method, notes, status, sale_date, created_at, updated_at'
    );

    await migrateTable(
      'purchases',
      `CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        payment_method TEXT NOT NULL DEFAULT 'due' CHECK(payment_method IN ('cash','card','bank_transfer','due')),
        notes TEXT,
        total DECIMAL(10, 2) DEFAULT 0,
        purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      'id, supplier_id, payment_method, notes, total, purchase_date, user_id, status, created_at, updated_at'
    );

    console.log('\n✅ Migration completed. Payment method now supports "due".');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    db.close();
  }
})();
