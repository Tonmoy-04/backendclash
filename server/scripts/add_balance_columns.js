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
      // Check if balance column exists in customers table
      db.all("PRAGMA table_info(customers)", (err, columns) => {
        if (err) {
          console.error('Error checking customers table:', err.message);
          reject(err);
          return;
        }

        const hasBalance = columns.some(col => col.name === 'balance');
        
        if (!hasBalance) {
          console.log('Adding balance column to customers table...');
          db.run("ALTER TABLE customers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0", (err) => {
            if (err) {
              console.error('Error adding balance to customers:', err.message);
              reject(err);
            } else {
              console.log('✓ Balance column added to customers table');
            }
          });
        } else {
          console.log('✓ Balance column already exists in customers table');
        }
      });

      // Check if balance column exists in suppliers table
      db.all("PRAGMA table_info(suppliers)", (err, columns) => {
        if (err) {
          console.error('Error checking suppliers table:', err.message);
          reject(err);
          return;
        }

        const hasBalance = columns.some(col => col.name === 'balance');
        
        if (!hasBalance) {
          console.log('Adding balance column to suppliers table...');
          db.run("ALTER TABLE suppliers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0", (err) => {
            if (err) {
              console.error('Error adding balance to suppliers:', err.message);
              reject(err);
            } else {
              console.log('✓ Balance column added to suppliers table');
              resolve();
            }
          });
        } else {
          console.log('✓ Balance column already exists in suppliers table');
          resolve();
        }
      });
    });
  });
}

migrate()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
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
