/**
 * Migration script to add Cashbox tables to existing database
 * Run this script once to add the cashbox feature to an existing installation
 */

const db = require('../database/db');

async function migrate() {
  try {
    console.log('Starting Cashbox migration...');

    // Create cashbox table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cashbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_initialized INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created cashbox table');

    // Create cashbox_transactions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cashbox_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbox_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amount DECIMAL(10, 2) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        balance_after DECIMAL(10, 2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashbox_id) REFERENCES cashbox(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created cashbox_transactions table');

    console.log('\n✅ Cashbox migration completed successfully!\n');
    console.log('You can now use the Cashbox feature in your Dashboard.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
