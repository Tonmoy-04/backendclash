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

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  try {
    console.log('Checking if supplier_name column exists in purchases table...');
    
    const columns = await all("PRAGMA table_info('purchases')");
    const hasSupplierName = columns.some(col => col.name === 'supplier_name');
    
    if (!hasSupplierName) {
      console.log('Adding supplier_name column to purchases table...');
      await run("ALTER TABLE purchases ADD COLUMN supplier_name TEXT");
      console.log('✓ supplier_name column added to purchases table');
    } else {
      console.log('✓ supplier_name column already exists in purchases table');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    db.close();
  }
})();
