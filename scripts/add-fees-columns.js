/**
 * Migration script to add transport_fee and labour_fee columns to sales and purchases tables
 * Run this once after updating the code
 */

const db = require('../server/database/db');

async function migrate() {
  try {
    console.log('Starting migration...');

    // Add columns to sales table
    console.log('Checking sales table...');
    try {
      await db.run(`ALTER TABLE sales ADD COLUMN transport_fee DECIMAL(10, 2) DEFAULT 0`);
      console.log('✓ transport_fee column added to sales');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('✓ transport_fee column already exists in sales');
      } else {
        throw e;
      }
    }

    try {
      await db.run(`ALTER TABLE sales ADD COLUMN labour_fee DECIMAL(10, 2) DEFAULT 0`);
      console.log('✓ labour_fee column added to sales');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('✓ labour_fee column already exists in sales');
      } else {
        throw e;
      }
    }

    // Add columns to purchases table
    console.log('Checking purchases table...');
    try {
      await db.run(`ALTER TABLE purchases ADD COLUMN transport_fee DECIMAL(10, 2) DEFAULT 0`);
      console.log('✓ transport_fee column added to purchases');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('✓ transport_fee column already exists in purchases');
      } else {
        throw e;
      }
    }

    try {
      await db.run(`ALTER TABLE purchases ADD COLUMN labour_fee DECIMAL(10, 2) DEFAULT 0`);
      console.log('✓ labour_fee column added to purchases');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('✓ labour_fee column already exists in purchases');
      } else {
        throw e;
      }
    }

    console.log('\n✓ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
