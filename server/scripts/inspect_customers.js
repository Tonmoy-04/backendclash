const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'inventory.db');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

(async () => {
  try {
    console.log('Inspecting customers table and ledger view...');

    const cols = await run("PRAGMA table_info('customers')");
    console.log('\nCustomers table columns:');
    console.log(JSON.stringify(cols, null, 2));

    const views = await run("SELECT name FROM sqlite_master WHERE type='view' AND name IN ('customer_daily_ledger', 'supplier_daily_ledger')");
    console.log('\nExisting views:');
    console.log(JSON.stringify(views, null, 2));

    const customers = await run("SELECT id, name, balance, created_at FROM customers ORDER BY created_at DESC LIMIT 5");
    console.log('\nSample customers:');
    console.log(JSON.stringify(customers, null, 2));

    if (customers.length > 0) {
      const id = customers[0].id;
      const ledger = await run(
        "SELECT date, deposit, spend, balance, status FROM customer_daily_ledger WHERE customer_id = ? ORDER BY date DESC LIMIT 10",
        [id]
      );
      console.log(`\nLedger for customer_id=${id}:`);
      console.log(JSON.stringify(ledger, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
