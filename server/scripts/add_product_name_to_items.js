const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration: Add product_name column to sale_items and purchase_items tables...');

db.serialize(() => {
  // Add product_name to sale_items table
  db.run(`
    ALTER TABLE sale_items ADD COLUMN product_name TEXT;
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ sale_items.product_name column already exists');
      } else {
        console.error('Error adding product_name to sale_items:', err.message);
      }
    } else {
      console.log('✓ Added product_name column to sale_items');
    }
  });

  // Add product_name to purchase_items table
  db.run(`
    ALTER TABLE purchase_items ADD COLUMN product_name TEXT;
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ purchase_items.product_name column already exists');
      } else {
        console.error('Error adding product_name to purchase_items:', err.message);
      }
    } else {
      console.log('✓ Added product_name column to purchase_items');
    }
  });

  // Populate product_name for existing sale_items from products table
  db.run(`
    UPDATE sale_items
    SET product_name = (
      SELECT name FROM products WHERE products.id = sale_items.product_id
    )
    WHERE product_id IS NOT NULL AND product_name IS NULL;
  `, (err) => {
    if (err) {
      console.error('Error populating sale_items.product_name:', err.message);
    } else {
      console.log('✓ Populated product_name for existing sale_items');
    }
  });

  // Populate product_name for existing purchase_items from products table
  db.run(`
    UPDATE purchase_items
    SET product_name = (
      SELECT name FROM products WHERE products.id = purchase_items.product_id
    )
    WHERE product_id IS NOT NULL AND product_name IS NULL;
  `, (err) => {
    if (err) {
      console.error('Error populating purchase_items.product_name:', err.message);
    } else {
      console.log('✓ Populated product_name for existing purchase_items');
    }
    
    // Close database after all operations
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n✓ Migration completed successfully!');
        console.log('Database closed.');
      }
    });
  });
});
