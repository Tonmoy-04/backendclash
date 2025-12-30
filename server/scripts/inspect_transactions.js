const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');

function getAllRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function inspectTransactions() {
  const db = new sqlite3.Database(INVENTORY_DB);

  try {
    console.log('🔍 Inspecting Transaction Data\n');
    console.log('='.repeat(60));

    // Get all customer transactions
    const customerTransactions = await getAllRows(db, `
      SELECT * FROM customer_transactions ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Customer Transactions:');
    if (customerTransactions.length === 0) {
      console.log('  ✅ No customer transactions (CORRECT - should only be created manually)');
    } else {
      console.log(`  Found ${customerTransactions.length} transactions:`);
      customerTransactions.forEach(t => {
        console.log(`    - ID: ${t.id}, Type: ${t.type}, Amount: ${t.amount}, Description: ${t.description}, Date: ${t.created_at}`);
      });
    }

    // Get all supplier transactions
    const supplierTransactions = await getAllRows(db, `
      SELECT * FROM supplier_transactions ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Supplier Transactions:');
    if (supplierTransactions.length === 0) {
      console.log('  ✅ No supplier transactions (CORRECT - should only be created manually)');
    } else {
      console.log(`  Found ${supplierTransactions.length} transactions:`);
      supplierTransactions.forEach(t => {
        console.log(`    - ID: ${t.id}, Type: ${t.type}, Amount: ${t.amount}, Description: ${t.description}, Date: ${t.created_at}`);
      });
    }

    // Get all purchases
    const purchases = await getAllRows(db, `
      SELECT id, supplier_id, supplier_name, total, created_at FROM purchases ORDER BY created_at DESC
    `);
    
    console.log('\n📦 Purchases:');
    if (purchases.length === 0) {
      console.log('  No purchases');
    } else {
      console.log(`  Found ${purchases.length} purchases:`);
      purchases.forEach(p => {
        console.log(`    - ID: ${p.id}, Supplier: ${p.supplier_name || p.supplier_id}, Amount: ${p.total}, Date: ${p.created_at}`);
      });
    }

    // Get all sales
    const sales = await getAllRows(db, `
      SELECT id, customer_name, total, created_at FROM sales ORDER BY created_at DESC
    `);
    
    console.log('\n💰 Sales:');
    if (sales.length === 0) {
      console.log('  No sales');
    } else {
      console.log(`  Found ${sales.length} sales:`);
      sales.forEach(s => {
        console.log(`    - ID: ${s.id}, Customer: ${s.customer_name}, Amount: ${s.total}, Date: ${s.created_at}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Inspection Complete');
    console.log('\n📌 Important Rules:');
    console.log('   - Purchases should NOT automatically create supplier transactions');
    console.log('   - Sales should NOT automatically create customer transactions');
    console.log('   - Transactions should only be created via explicit transaction endpoints');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    db.close();
  }
}

inspectTransactions();
