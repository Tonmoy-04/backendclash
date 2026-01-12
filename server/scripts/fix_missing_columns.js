/**
 * Migration script to add missing columns to purchases and sales tables
 * This fixes the "table purchases has no column named supplier_address" error
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

async function runMigration() {
  try {
    // Determine the userData directory
    const userDataPath = app ? app.getPath('userData') : path.join(process.env.APPDATA || process.env.HOME, 'inventory-software');
    const dbPath = path.join(userDataPath, 'inventory.db');

    console.log('Migration: Fix missing columns');
    console.log('Database path:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.log('Database does not exist yet. No migration needed.');
      return;
    }

    const db = new sqlite3.Database(dbPath);

    // Helper function to check if column exists
    const columnExists = (tableName, columnName) => {
      return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
          if (err) {
            reject(err);
          } else {
            const exists = columns.some(col => col.name === columnName);
            resolve(exists);
          }
        });
      });
    };

    // Helper function to run SQL
    const runSQL = (sql) => {
      return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    console.log('\n=== Checking and adding missing columns ===\n');

    // Sales table columns
    const salesColumns = [
      { name: 'customer_address', type: 'TEXT DEFAULT NULL' },
      { name: 'description', type: 'TEXT DEFAULT NULL' },
      { name: 'discount', type: 'DECIMAL(10, 2) DEFAULT 0' },
      { name: 'transport_fee', type: 'DECIMAL(10, 2) DEFAULT 0' },
      { name: 'labour_fee', type: 'DECIMAL(10, 2) DEFAULT 0' }
    ];

    for (const column of salesColumns) {
      try {
        const exists = await columnExists('sales', column.name);
        if (!exists) {
          await runSQL(`ALTER TABLE sales ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✓ Added ${column.name} to sales table`);
        } else {
          console.log(`✓ ${column.name} already exists in sales table`);
        }
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`✓ ${column.name} already exists in sales table`);
        } else {
          console.error(`✗ Error adding ${column.name} to sales:`, error.message);
        }
      }
    }

    // Purchases table columns
    const purchasesColumns = [
      { name: 'supplier_address', type: 'TEXT DEFAULT NULL' },
      { name: 'description', type: 'TEXT DEFAULT NULL' },
      { name: 'discount', type: 'DECIMAL(10, 2) DEFAULT 0' },
      { name: 'transport_fee', type: 'DECIMAL(10, 2) DEFAULT 0' },
      { name: 'labour_fee', type: 'DECIMAL(10, 2) DEFAULT 0' }
    ];

    for (const column of purchasesColumns) {
      try {
        const exists = await columnExists('purchases', column.name);
        if (!exists) {
          await runSQL(`ALTER TABLE purchases ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✓ Added ${column.name} to purchases table`);
        } else {
          console.log(`✓ ${column.name} already exists in purchases table`);
        }
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`✓ ${column.name} already exists in purchases table`);
        } else {
          console.error(`✗ Error adding ${column.name} to purchases:`, error.message);
        }
      }
    }

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n=== Migration completed successfully ===\n');
      }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
