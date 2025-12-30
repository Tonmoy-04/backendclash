const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration: Make product_id nullable in sale_items and purchase_items...');

db.serialize(() => {
  // Start transaction
  db.run('BEGIN TRANSACTION;');

  // Rebuild sale_items table with nullable product_id
  console.log('Rebuilding sale_items table...');
  
  db.run(`
    CREATE TABLE sale_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      subtotal DECIMAL(10, 2) NOT NULL,
      price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
  `, (err) => {
    if (err) {
      console.error('Error creating sale_items_new:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Created sale_items_new table');
  });

  db.run(`
    INSERT INTO sale_items_new (id, sale_id, product_id, product_name, quantity, unit_price, total_price, subtotal, price, created_at)
    SELECT id, sale_id, product_id, product_name, quantity, unit_price, total_price, subtotal, price, created_at
    FROM sale_items;
  `, (err) => {
    if (err) {
      console.error('Error copying sale_items data:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Copied data to sale_items_new');
  });

  db.run('DROP TABLE sale_items;', (err) => {
    if (err) {
      console.error('Error dropping old sale_items:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Dropped old sale_items table');
  });

  db.run('ALTER TABLE sale_items_new RENAME TO sale_items;', (err) => {
    if (err) {
      console.error('Error renaming sale_items_new:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Renamed sale_items_new to sale_items');
  });

  // Rebuild purchase_items table with nullable product_id
  console.log('\nRebuilding purchase_items table...');
  
  db.run(`
    CREATE TABLE purchase_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      cost DECIMAL(10, 2) DEFAULT 0,
      subtotal DECIMAL(10, 2) DEFAULT 0,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
  `, (err) => {
    if (err) {
      console.error('Error creating purchase_items_new:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Created purchase_items_new table');
  });

  db.run(`
    INSERT INTO purchase_items_new (id, purchase_id, product_id, product_name, quantity, cost, subtotal, unit_price, total_price, created_at)
    SELECT id, purchase_id, product_id, product_name, quantity, cost, subtotal, unit_price, total_price, created_at
    FROM purchase_items;
  `, (err) => {
    if (err) {
      console.error('Error copying purchase_items data:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Copied data to purchase_items_new');
  });

  db.run('DROP TABLE purchase_items;', (err) => {
    if (err) {
      console.error('Error dropping old purchase_items:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Dropped old purchase_items table');
  });

  db.run('ALTER TABLE purchase_items_new RENAME TO purchase_items;', (err) => {
    if (err) {
      console.error('Error renaming purchase_items_new:', err.message);
      db.run('ROLLBACK;');
      return;
    }
    console.log('✓ Renamed purchase_items_new to purchase_items');
  });

  // Commit transaction
  db.run('COMMIT;', (err) => {
    if (err) {
      console.error('Error committing transaction:', err.message);
      db.run('ROLLBACK;');
    } else {
      console.log('\n✓ Migration completed successfully!');
      console.log('product_id is now nullable in both sale_items and purchase_items tables.');
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database closed.');
      }
    });
  });
});
