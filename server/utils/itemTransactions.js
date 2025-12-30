const stockDb = require('../database/stockDb');

let itemTransactionsTableInitialized = false;

async function ensureItemTransactionsTable() {
  if (itemTransactionsTableInitialized) return;
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS inventory_item_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PURCHASE', 'SELL')),
      quantity REAL NOT NULL,
      price REAL,
      transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reference_type TEXT,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `;
  await stockDb.run(createTableSQL);

  // Backfill missing columns if table existed without them
  const columns = await stockDb.all("PRAGMA table_info('inventory_item_transactions')");
  const columnNames = (columns || []).map(c => c.name);
  if (!columnNames.includes('price')) {
    await stockDb.run("ALTER TABLE inventory_item_transactions ADD COLUMN price REAL");
  }
  if (!columnNames.includes('transaction_date')) {
    await stockDb.run("ALTER TABLE inventory_item_transactions ADD COLUMN transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }
  if (!columnNames.includes('reference_type')) {
    await stockDb.run("ALTER TABLE inventory_item_transactions ADD COLUMN reference_type TEXT");
  }
  if (!columnNames.includes('reference_id')) {
    await stockDb.run("ALTER TABLE inventory_item_transactions ADD COLUMN reference_id INTEGER");
  }

  itemTransactionsTableInitialized = true;
}

async function insertItemTransaction({ item_id, type, quantity, price = null, transaction_date, reference_type, reference_id }) {
  await ensureItemTransactionsTable();
  const sql = `
    INSERT INTO inventory_item_transactions (item_id, type, quantity, price, transaction_date, reference_type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  return await stockDb.run(sql, [item_id, type, quantity, price, transaction_date, reference_type, reference_id]);
}

module.exports = {
  ensureItemTransactionsTable,
  insertItemTransaction
};