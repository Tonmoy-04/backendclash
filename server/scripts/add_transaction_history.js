const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the inventory database.');
});

async function migrate() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create customer_transactions table
      db.run(`
        CREATE TABLE IF NOT EXISTS customer_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('payment', 'charge')),
          amount DECIMAL(10, 2) NOT NULL,
          balance_before DECIMAL(10, 2) NOT NULL,
          balance_after DECIMAL(10, 2) NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating customer_transactions table:', err.message);
          reject(err);
        } else {
          console.log('✓ customer_transactions table created');
        }
      });

      // Create supplier_transactions table
      db.run(`
        CREATE TABLE IF NOT EXISTS supplier_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          supplier_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('payment', 'charge')),
          amount DECIMAL(10, 2) NOT NULL,
          balance_before DECIMAL(10, 2) NOT NULL,
          balance_after DECIMAL(10, 2) NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating supplier_transactions table:', err.message);
          reject(err);
        } else {
          console.log('✓ supplier_transactions table created');
          resolve();
        }
      });
    });
  });
}

migrate()
  .then(() => {
    console.log('\n✅ Transaction history tables created successfully!');
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    db.close();
    process.exit(1);
  });
