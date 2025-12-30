const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');
const STOCK_DB = path.join(__dirname, '..', 'database', 'stock.db');

// Expected tables for each database
const expectedInventoryTables = [
  'users',
  'customers',
  'suppliers',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'customer_transactions',
  'supplier_transactions'
];

const expectedStockTables = [
  'categories',
  'products',
  'stock_history'
];

const expectedViews = [
  'customer_daily_ledger',
  'supplier_daily_ledger'
];

async function checkDatabase(dbPath, expectedTables, dbName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`❌ Failed to open ${dbName}:`, err.message);
        reject(err);
        return;
      }
    });

    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
      if (err) {
        console.error(`❌ Error reading tables from ${dbName}:`, err.message);
        db.close();
        reject(err);
        return;
      }

      const actualTables = rows.map(r => r.name).filter(n => n !== 'sqlite_sequence');
      const missingTables = expectedTables.filter(t => !actualTables.includes(t));
      const extraTables = actualTables.filter(t => !expectedTables.includes(t) && !t.startsWith('sqlite_'));

      console.log(`\n📊 ${dbName} Database:`);
      console.log(`  Found ${actualTables.length} tables`);
      
      if (missingTables.length > 0) {
        console.log(`  ⚠️  Missing tables: ${missingTables.join(', ')}`);
      } else {
        console.log(`  ✅ All required tables present`);
      }

      if (extraTables.length > 0) {
        console.log(`  ℹ️  Extra tables: ${extraTables.join(', ')}`);
      }

      db.close(() => {
        resolve({ actualTables, missingTables, extraTables });
      });
    });
  });
}

async function checkViews(dbPath, expectedViews, dbName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.all("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name", [], (err, rows) => {
      if (err) {
        console.error(`❌ Error reading views from ${dbName}:`, err.message);
        db.close();
        reject(err);
        return;
      }

      const actualViews = rows.map(r => r.name);
      const missingViews = expectedViews.filter(v => !actualViews.includes(v));

      console.log(`\n📋 ${dbName} Views:`);
      console.log(`  Found ${actualViews.length} views`);
      
      if (missingViews.length > 0) {
        console.log(`  ⚠️  Missing views: ${missingViews.join(', ')}`);
      } else if (actualViews.length > 0) {
        console.log(`  ✅ All expected views present: ${actualViews.join(', ')}`);
      }

      db.close(() => {
        resolve({ actualViews, missingViews });
      });
    });
  });
}

async function verifySampleData(dbPath, dbName) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);

    const queries = {
      customers: "SELECT COUNT(*) as count FROM customers",
      suppliers: "SELECT COUNT(*) as count FROM suppliers",
      sales: "SELECT COUNT(*) as count FROM sales",
      purchases: "SELECT COUNT(*) as count FROM purchases"
    };

    const results = {};
    let completed = 0;

    console.log(`\n📈 ${dbName} Data Counts:`);

    Object.entries(queries).forEach(([table, query]) => {
      db.get(query, [], (err, row) => {
        if (!err && row) {
          results[table] = row.count;
          console.log(`  ${table}: ${row.count} records`);
        } else if (err) {
          console.log(`  ${table}: ⚠️  Unable to query (${err.message})`);
        }
        
        completed++;
        if (completed === Object.keys(queries).length) {
          db.close(() => resolve(results));
        }
      });
    });
  });
}

async function verifyStockData() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(STOCK_DB);

    db.get("SELECT COUNT(*) as count FROM products", [], (err, row) => {
      console.log(`\n📦 Stock Database:`);
      if (!err && row) {
        console.log(`  products: ${row.count} records`);
        resolve({ products: row.count });
      } else {
        console.log(`  products: ⚠️  Unable to query`);
        resolve({ products: 0 });
      }
      db.close();
    });
  });
}

(async () => {
  console.log('🔍 Database Integrity Verification\n');
  console.log('='.repeat(50));

  try {
    // Check inventory.db structure
    const inventoryResult = await checkDatabase(INVENTORY_DB, expectedInventoryTables, 'inventory.db');
    
    // Check stock.db structure
    const stockResult = await checkDatabase(STOCK_DB, expectedStockTables, 'stock.db');
    
    // Check views in inventory.db
    await checkViews(INVENTORY_DB, expectedViews, 'inventory.db');
    
    // Check data counts
    await verifySampleData(INVENTORY_DB, 'inventory.db');
    await verifyStockData();

    console.log('\n' + '='.repeat(50));
    
    const allGood = 
      inventoryResult.missingTables.length === 0 && 
      stockResult.missingTables.length === 0;

    if (allGood) {
      console.log('✅ Database integrity check PASSED');
    } else {
      console.log('⚠️  Database integrity check FAILED - missing tables detected');
      console.log('\nTo fix, run: node scripts/reinit_schema.js');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exitCode = 1;
  }
})();
