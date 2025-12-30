const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getRow(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAllRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function testNoAutoTransactions() {
  const db = new sqlite3.Database(INVENTORY_DB);

  try {
    console.log('\n🧪 VERIFY: Purchases/Sales DO NOT Create Transactions\n');
    console.log('='.repeat(70));

    // Get current state
    const initialCustomerTxns = await getRow(db, 'SELECT COUNT(*) as count FROM customer_transactions');
    const initialSupplierTxns = await getRow(db, 'SELECT COUNT(*) as count FROM supplier_transactions');
    const initialSales = await getRow(db, 'SELECT COUNT(*) as count FROM sales');
    const initialPurchases = await getRow(db, 'SELECT COUNT(*) as count FROM purchases');
    
    console.log('Initial State:');
    console.log(`  Customer Transactions: ${initialCustomerTxns.count}`);
    console.log(`  Supplier Transactions: ${initialSupplierTxns.count}`);
    console.log(`  Sales: ${initialSales.count}`);
    console.log(`  Purchases: ${initialPurchases.count}`);

    // Create a test sale
    console.log('\n📝 Creating a test SALE...');
    const saleResult = await runQuery(db, `
      INSERT INTO sales (customer_name, payment_method, subtotal, tax, total)
      VALUES (?, ?, ?, ?, ?)
    `, ['Test Customer For Transaction Check', 'cash', 10000, 0, 10000]);
    
    const saleId = saleResult.lastID;
    console.log(`  Sale ID: ${saleId} created`);

    // Create test sale item
    await runQuery(db, `
      INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [saleId, 1, 'Test Product', 10, 1000, 10000]);

    // Create a test purchase
    console.log('\n📝 Creating a test PURCHASE...');
    const purchaseResult = await runQuery(db, `
      INSERT INTO purchases (supplier_id, supplier_name, payment_method, total)
      VALUES (?, ?, ?, ?)
    `, [null, 'Test Supplier For Transaction Check', 'cash', 5000]);
    
    const purchaseId = purchaseResult.lastID;
    console.log(`  Purchase ID: ${purchaseId} created`);

    // Create test purchase item
    await runQuery(db, `
      INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, cost, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [purchaseId, 1, 'Test Product', 5, 1000, 5000]);

    // Check if transactions were created
    console.log('\n🔍 Checking for auto-created transactions...');
    
    const finalCustomerTxns = await getRow(db, 'SELECT COUNT(*) as count FROM customer_transactions');
    const finalSupplierTxns = await getRow(db, 'SELECT COUNT(*) as count FROM supplier_transactions');
    const finalSales = await getRow(db, 'SELECT COUNT(*) as count FROM sales');
    const finalPurchases = await getRow(db, 'SELECT COUNT(*) as count FROM purchases');

    console.log('\nFinal State:');
    console.log(`  Customer Transactions: ${finalCustomerTxns.count} (was ${initialCustomerTxns.count})`);
    console.log(`  Supplier Transactions: ${finalSupplierTxns.count} (was ${initialSupplierTxns.count})`);
    console.log(`  Sales: ${finalSales.count} (was ${initialSales.count})`);
    console.log(`  Purchases: ${finalPurchases.count} (was ${initialPurchases.count})`);

    // Verify no transactions were created
    const customerTxnChange = finalCustomerTxns.count - initialCustomerTxns.count;
    const supplierTxnChange = finalSupplierTxns.count - initialSupplierTxns.count;
    const salesChange = finalSales.count - initialSales.count;
    const purchasesChange = finalPurchases.count - initialPurchases.count;

    console.log('\n📊 Changes:');
    console.log(`  Customer Transactions: ${customerTxnChange > 0 ? '❌ ' + customerTxnChange + ' CREATED' : '✅ None created'}`);
    console.log(`  Supplier Transactions: ${supplierTxnChange > 0 ? '❌ ' + supplierTxnChange + ' CREATED' : '✅ None created'}`);
    console.log(`  Sales: ${salesChange > 0 ? '✅ ' + salesChange + ' created (correct)' : '❌ None created'}`);
    console.log(`  Purchases: ${purchasesChange > 0 ? '✅ ' + purchasesChange + ' created (correct)' : '❌ None created'}`);

    console.log('\n' + '='.repeat(70));

    if (customerTxnChange === 0 && supplierTxnChange === 0) {
      console.log('✅ CORRECT: No transactions auto-created for purchases/sales\n');
    } else {
      console.log('❌ ERROR: Transactions were auto-created!\n');
      console.log('Customer transactions created:', customerTxnChange);
      console.log('Supplier transactions created:', supplierTxnChange);
      
      // Show which transactions were created
      if (customerTxnChange > 0) {
        const newCustomerTxns = await getAllRows(db, `
          SELECT * FROM customer_transactions 
          WHERE created_at >= datetime('now', '-1 minute')
          ORDER BY id DESC LIMIT ?
        `, [customerTxnChange]);
        console.log('\nNew customer transactions:');
        newCustomerTxns.forEach(t => {
          console.log(`  - ${t.type}: ${t.amount} (${t.description})`);
        });
      }

      if (supplierTxnChange > 0) {
        const newSupplierTxns = await getAllRows(db, `
          SELECT * FROM supplier_transactions 
          WHERE created_at >= datetime('now', '-1 minute')
          ORDER BY id DESC LIMIT ?
        `, [supplierTxnChange]);
        console.log('\nNew supplier transactions:');
        newSupplierTxns.forEach(t => {
          console.log(`  - ${t.type}: ${t.amount} (${t.description})`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

testNoAutoTransactions();
