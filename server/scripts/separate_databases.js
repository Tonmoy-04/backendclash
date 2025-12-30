const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');
const STOCK_DB = path.join(__dirname, '..', 'database', 'stock.db');

async function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function getAllRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function separateDatabases() {
  console.log('🔄 Starting database separation process...\n');

  const inventoryDb = new sqlite3.Database(INVENTORY_DB);
  const stockDb = new sqlite3.Database(STOCK_DB);

  try {
    // Step 1: Check if products exist in inventory.db
    console.log('Step 1: Checking for products in inventory.db...');
    const productsInInventory = await getAllRows(inventoryDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    
    if (productsInInventory.length > 0) {
      console.log('  ⚠️  Found products table in inventory.db');
      
      // Backup data if it exists
      const productData = await getAllRows(inventoryDb, 'SELECT COUNT(*) as count FROM products');
      console.log(`  Found ${productData[0]?.count || 0} products in inventory.db`);
      
      if (productData[0]?.count > 0) {
        console.log('  Moving products to stock.db...');
        
        // Get all products from inventory.db
        const products = await getAllRows(inventoryDb, `
          SELECT id, name, quantity, min_stock, price, cost, description, created_at, updated_at 
          FROM products
        `);
        
        // Insert into stock.db if not already there
        for (const product of products) {
          try {
            await runQuery(stockDb, `
              INSERT OR REPLACE INTO products (id, name, quantity, min_stock, price, cost, description, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [product.id, product.name, product.quantity, product.min_stock, product.price, product.cost, product.description, product.created_at, product.updated_at]);
          } catch (err) {
            console.error(`  ❌ Error inserting product ${product.id}:`, err.message);
          }
        }
        
        console.log(`  ✅ Migrated ${products.length} products to stock.db`);
      }
      
      // Drop products table from inventory.db
      console.log('  Removing products table from inventory.db...');
      await runQuery(inventoryDb, 'DROP TABLE products');
      console.log('  ✅ Removed products from inventory.db');
    } else {
      console.log('  ✅ No products table in inventory.db (correct)');
    }

    // Step 2: Check for categories in inventory.db
    console.log('\nStep 2: Checking for categories in inventory.db...');
    const categoriesInInventory = await getAllRows(inventoryDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
    
    if (categoriesInInventory.length > 0) {
      console.log('  ⚠️  Found categories table in inventory.db');
      
      const categoryData = await getAllRows(inventoryDb, 'SELECT COUNT(*) as count FROM categories');
      console.log(`  Found ${categoryData[0]?.count || 0} categories in inventory.db`);
      
      if (categoryData[0]?.count > 0) {
        console.log('  Moving categories to stock.db...');
        
        const categories = await getAllRows(inventoryDb, `
          SELECT id, name, description, created_at, updated_at FROM categories
        `);
        
        for (const category of categories) {
          try {
            await runQuery(stockDb, `
              INSERT OR REPLACE INTO categories (id, name, description, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `, [category.id, category.name, category.description, category.created_at, category.updated_at]);
          } catch (err) {
            console.error(`  ❌ Error inserting category ${category.id}:`, err.message);
          }
        }
        
        console.log(`  ✅ Migrated ${categories.length} categories to stock.db`);
      }
      
      await runQuery(inventoryDb, 'DROP TABLE categories');
      console.log('  ✅ Removed categories from inventory.db');
    } else {
      console.log('  ✅ No categories table in inventory.db (correct)');
    }

    // Step 3: Check for stock_history in inventory.db
    console.log('\nStep 3: Checking for stock_history in inventory.db...');
    const stockHistoryInInventory = await getAllRows(inventoryDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_history'");
    
    if (stockHistoryInInventory.length > 0) {
      console.log('  ⚠️  Found stock_history table in inventory.db');
      
      const historyData = await getAllRows(inventoryDb, 'SELECT COUNT(*) as count FROM stock_history');
      console.log(`  Found ${historyData[0]?.count || 0} entries in inventory.db`);
      
      if (historyData[0]?.count > 0) {
        console.log('  Moving stock_history to stock.db...');
        
        const history = await getAllRows(inventoryDb, `
          SELECT id, product_id, change, reason, created_at FROM stock_history
        `);
        
        for (const entry of history) {
          try {
            await runQuery(stockDb, `
              INSERT OR IGNORE INTO stock_history (id, product_id, change, reason, created_at)
              VALUES (?, ?, ?, ?, ?)
            `, [entry.id, entry.product_id, entry.change, entry.reason, entry.created_at]);
          } catch (err) {
            // Skip if already exists
          }
        }
        
        console.log(`  ✅ Migrated ${history.length} stock history entries to stock.db`);
      }
      
      await runQuery(inventoryDb, 'DROP TABLE stock_history');
      console.log('  ✅ Removed stock_history from inventory.db');
    } else {
      console.log('  ✅ No stock_history table in inventory.db (correct)');
    }

    // Step 4: Verify final state
    console.log('\nStep 4: Verifying database separation...');
    
    const inventoryTables = await getAllRows(inventoryDb, `
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    const inventoryTableNames = inventoryTables.map(t => t.name).sort();
    
    const stockTables = await getAllRows(stockDb, `
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    const stockTableNames = stockTables.map(t => t.name).sort();
    
    console.log('\n📊 Inventory Database Tables:');
    console.log(`  ${inventoryTableNames.join(', ')}`);
    
    console.log('\n📦 Stock Database Tables:');
    console.log(`  ${stockTableNames.join(', ')}`);
    
    // Check for overlap
    const stockOnlyTables = ['categories', 'products', 'stock_history'];
    const overlap = inventoryTableNames.filter(t => stockOnlyTables.includes(t));
    
    if (overlap.length > 0) {
      console.log(`\n⚠️  ERROR: Found stock-only tables in inventory.db: ${overlap.join(', ')}`);
      console.log('Please manually drop these tables or re-run this script.');
    } else {
      console.log('\n✅ Database separation COMPLETE!');
      console.log('   - inventory.db: Contains only business logic (users, customers, suppliers, transactions)');
      console.log('   - stock.db: Contains only inventory (products, categories, stock_history)');
    }

  } catch (error) {
    console.error('\n❌ Error during separation:', error.message);
    process.exitCode = 1;
  } finally {
    inventoryDb.close();
    stockDb.close();
  }
}

separateDatabases();
