const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');
const STOCK_DB = path.join(__dirname, '..', 'database', 'stock.db');

// Test results container
const testResults = {
  startTime: new Date(),
  totalTests: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  precisionTests: [],
  balanceTests: [],
  calculationTests: []
};

// Helper functions
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
      else resolve(rows);
    });
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Precision checker - ensures no floating point errors
function checkPrecision(value, expected, tolerance = 0.01) {
  const diff = Math.abs(value - expected);
  return diff < tolerance;
}

// Generate test data
function generateTestData(count) {
  const data = {
    customers: [],
    suppliers: [],
    categories: [],
    products: [],
    sales: [],
    purchases: []
  };

  // Generate categories
  const categoryNames = ['Electronics', 'Clothing', 'Food', 'Books', 'Furniture'];
  for (let i = 0; i < 5; i++) {
    data.categories.push({
      name: `${categoryNames[i]}_${i}`,
      description: `Category ${i}`
    });
  }

  // Generate products
  const productBases = ['Phone', 'Shirt', 'Rice', 'Novel', 'Chair'];
  for (let i = 0; i < Math.min(200, Math.floor(count / 5)); i++) {
    data.products.push({
      name: `${productBases[i % 5]}_${i}`,
      category_id: (i % 5) + 1,
      quantity: Math.floor(Math.random() * 1000),
      min_stock: Math.floor(Math.random() * 100),
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      cost: parseFloat((Math.random() * 500).toFixed(2)),
      description: `Product ${i}`
    });
  }

  // Generate customers
  for (let i = 0; i < Math.min(100, Math.floor(count / 10)); i++) {
    data.customers.push({
      name: `Customer_${i}`,
      email: `customer${i}@test.com`,
      phone: `555000${String(i).padStart(4, '0')}`,
      address: `Address ${i}`,
      balance: parseFloat((Math.random() * 50000).toFixed(2))
    });
  }

  // Generate suppliers
  for (let i = 0; i < Math.min(50, Math.floor(count / 20)); i++) {
    data.suppliers.push({
      name: `Supplier_${i}`,
      email: `supplier${i}@test.com`,
      phone: `555100${String(i).padStart(4, '0')}`,
      address: `Supplier Address ${i}`,
      contact_person: `Contact ${i}`,
      balance: parseFloat((Math.random() * 100000).toFixed(2))
    });
  }

  // Generate sales transactions
  for (let i = 0; i < Math.floor(count * 0.3); i++) {
    const items = [];
    const itemCount = Math.floor(Math.random() * 5) + 1;
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const qty = Math.floor(Math.random() * 20) + 1;
      const price = parseFloat((Math.random() * 500).toFixed(2));
      const itemSub = Math.round(qty * price * 100) / 100;
      items.push({
        product_name: `Product_Sale_${i}_${j}`,
        quantity: qty,
        price: price,
        subtotal: itemSub
      });
      subtotal = Math.round((subtotal + itemSub) * 100) / 100;
    }

    const discount = parseFloat((Math.random() * 1000).toFixed(2));
    const transport = parseFloat((Math.random() * 500).toFixed(2));
    const labour = parseFloat((Math.random() * 300).toFixed(2));
    const total = Math.round((subtotal - discount + transport + labour) * 100) / 100;

    data.sales.push({
      customer_name: `Customer_${i % 100}`,
      customer_address: `Address ${i}`,
      description: `Sale ${i}`,
      items: items,
      payment_method: ['cash', 'card', 'bank_transfer', 'due'][Math.floor(Math.random() * 4)],
      notes: `Note ${i}`,
      subtotal: subtotal,
      discount: discount,
      tax: 0,
      transport_fee: transport,
      labour_fee: labour,
      total: total
    });
  }

  // Generate purchase transactions
  for (let i = 0; i < Math.floor(count * 0.3); i++) {
    const items = [];
    const itemCount = Math.floor(Math.random() * 5) + 1;
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const qty = Math.floor(Math.random() * 30) + 1;
      const cost = parseFloat((Math.random() * 300).toFixed(2));
      const itemSub = Math.round(qty * cost * 100) / 100;
      items.push({
        product_name: `Product_Purchase_${i}_${j}`,
        quantity: qty,
        cost: cost,
        subtotal: itemSub
      });
      subtotal = Math.round((subtotal + itemSub) * 100) / 100;
    }

    const discount = parseFloat((Math.random() * 2000).toFixed(2));
    const transport = parseFloat((Math.random() * 1000).toFixed(2));
    const labour = parseFloat((Math.random() * 500).toFixed(2));
    const total = Math.round((subtotal - discount + transport + labour) * 100) / 100;

    data.purchases.push({
      supplier_name: `Supplier_${i % 50}`,
      supplier_address: `Supplier Address ${i}`,
      description: `Purchase ${i}`,
      items: items,
      payment_method: ['cash', 'card', 'bank_transfer', 'due'][Math.floor(Math.random() * 4)],
      notes: `Note ${i}`,
      subtotal: subtotal,
      discount: discount,
      tax: 0,
      transport_fee: transport,
      labour_fee: labour,
      total: total
    });
  }

  return data;
}

// Test functions
async function testInsertCustomers(invDb, testData) {
  console.log('\n🧪 TEST: Customer Insertion (100 customers)');
  let passed = 0;
  let failed = 0;

  try {
    for (const customer of testData.customers) {
      try {
        await runQuery(invDb, 
          `INSERT INTO customers (name, email, phone, address, balance) VALUES (?, ?, ?, ?, ?)`,
          [customer.name, customer.email, customer.phone, customer.address, customer.balance]
        );
        passed++;
      } catch (e) {
        failed++;
        testResults.errors.push(`Customer insert failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Customer insertion test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.customers.length;
}

async function testInsertSuppliers(invDb, testData) {
  console.log('\n🧪 TEST: Supplier Insertion (50 suppliers)');
  let passed = 0;
  let failed = 0;

  try {
    for (const supplier of testData.suppliers) {
      try {
        await runQuery(invDb, 
          `INSERT INTO suppliers (name, email, phone, address, contact_person, balance) VALUES (?, ?, ?, ?, ?, ?)`,
          [supplier.name, supplier.email, supplier.phone, supplier.address, supplier.contact_person, supplier.balance]
        );
        passed++;
      } catch (e) {
        failed++;
        testResults.errors.push(`Supplier insert failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Supplier insertion test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.suppliers.length;
}

async function testInsertProducts(stockDb, testData) {
  console.log('\n🧪 TEST: Product Insertion (200 products)');
  let passed = 0;
  let failed = 0;

  try {
    for (const product of testData.products) {
      try {
        await runQuery(stockDb, 
          `INSERT INTO products (name, quantity, min_stock, price, cost, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [product.name, product.quantity, product.min_stock, product.price, product.cost, product.description]
        );
        passed++;
      } catch (e) {
        failed++;
        testResults.errors.push(`Product insert failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Product insertion test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.products.length;
}

async function testCustomerBalanceTransactions(invDb, testData) {
  console.log('\n🧪 TEST: Customer Balance Transactions (Precision Test)');
  let passed = 0;
  let failed = 0;

  try {
    const customers = await getAllRows(invDb, 'SELECT id FROM customers LIMIT 10');
    
    for (const customer of customers) {
      try {
        // Test charge
        const chargeAmount = parseFloat((Math.random() * 5000).toFixed(2));
        await runQuery(invDb,
          `INSERT INTO customer_transactions (customer_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [customer.id, 'charge', chargeAmount, 0, chargeAmount, 'Test charge']
        );

        // Test payment
        const paymentAmount = Math.round((chargeAmount * 0.5) * 100) / 100;
        const expectedBalance = Math.round((chargeAmount - paymentAmount) * 100) / 100;
        
        await runQuery(invDb,
          `INSERT INTO customer_transactions (customer_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [customer.id, 'payment', paymentAmount, chargeAmount, expectedBalance, 'Test payment']
        );

        // Verify precision
        const finalTx = await getRow(invDb,
          `SELECT balance_after FROM customer_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1`,
          [customer.id]
        );

        if (checkPrecision(finalTx.balance_after, expectedBalance)) {
          passed++;
          testResults.precisionTests.push({
            type: 'customer_balance',
            expected: expectedBalance,
            actual: finalTx.balance_after,
            status: 'PASS'
          });
        } else {
          failed++;
          testResults.errors.push(`Precision error: Expected ${expectedBalance}, got ${finalTx.balance_after}`);
          testResults.precisionTests.push({
            type: 'customer_balance',
            expected: expectedBalance,
            actual: finalTx.balance_after,
            status: 'FAIL'
          });
        }
      } catch (e) {
        failed++;
        testResults.errors.push(`Customer balance transaction failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Customer balance test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += passed + failed;
}

async function testSupplierBalanceTransactions(invDb, testData) {
  console.log('\n🧪 TEST: Supplier Balance Transactions (Precision Test)');
  let passed = 0;
  let failed = 0;

  try {
    const suppliers = await getAllRows(invDb, 'SELECT id FROM suppliers LIMIT 10');
    
    for (const supplier of suppliers) {
      try {
        // Test charge (purchase on credit)
        const chargeAmount = parseFloat((Math.random() * 10000).toFixed(2));
        await runQuery(invDb,
          `INSERT INTO supplier_transactions (supplier_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [supplier.id, 'charge', chargeAmount, 0, chargeAmount, 'Test charge']
        );

        // Test payment
        const paymentAmount = Math.round((chargeAmount * 0.6) * 100) / 100;
        const expectedBalance = Math.round((chargeAmount - paymentAmount) * 100) / 100;
        
        await runQuery(invDb,
          `INSERT INTO supplier_transactions (supplier_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [supplier.id, 'payment', paymentAmount, chargeAmount, expectedBalance, 'Test payment']
        );

        // Verify precision
        const finalTx = await getRow(invDb,
          `SELECT balance_after FROM supplier_transactions WHERE supplier_id = ? ORDER BY id DESC LIMIT 1`,
          [supplier.id]
        );

        if (checkPrecision(finalTx.balance_after, expectedBalance)) {
          passed++;
          testResults.precisionTests.push({
            type: 'supplier_balance',
            expected: expectedBalance,
            actual: finalTx.balance_after,
            status: 'PASS'
          });
        } else {
          failed++;
          testResults.errors.push(`Precision error: Expected ${expectedBalance}, got ${finalTx.balance_after}`);
          testResults.precisionTests.push({
            type: 'supplier_balance',
            expected: expectedBalance,
            actual: finalTx.balance_after,
            status: 'FAIL'
          });
        }
      } catch (e) {
        failed++;
        testResults.errors.push(`Supplier balance transaction failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Supplier balance test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += passed + failed;
}

async function testSaleCalculations(invDb, testData) {
  console.log('\n🧪 TEST: Sale Calculations (300 sales)');
  let passed = 0;
  let failed = 0;

  try {
    for (const sale of testData.sales) {
      try {
        // Calculate expected total
        let expectedTotal = sale.subtotal - sale.discount + sale.transport_fee + sale.labour_fee;
        expectedTotal = Math.round(expectedTotal * 100) / 100;

        if (Math.abs(sale.total - expectedTotal) < 0.01) {
          passed++;
          testResults.calculationTests.push({
            type: 'sale',
            expected: expectedTotal,
            actual: sale.total,
            status: 'PASS'
          });
        } else {
          failed++;
          testResults.errors.push(
            `Sale calculation error: Expected ${expectedTotal}, got ${sale.total} ` +
            `(Subtotal: ${sale.subtotal}, Discount: ${sale.discount}, Transport: ${sale.transport_fee}, Labour: ${sale.labour_fee})`
          );
          testResults.calculationTests.push({
            type: 'sale',
            expected: expectedTotal,
            actual: sale.total,
            status: 'FAIL'
          });
        }
      } catch (e) {
        failed++;
        testResults.errors.push(`Sale calculation test failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Sale calculation test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.sales.length;
}

async function testPurchaseCalculations(invDb, testData) {
  console.log('\n🧪 TEST: Purchase Calculations (300 purchases)');
  let passed = 0;
  let failed = 0;

  try {
    for (const purchase of testData.purchases) {
      try {
        // Calculate expected total
        let expectedTotal = purchase.subtotal - purchase.discount + purchase.transport_fee + purchase.labour_fee;
        expectedTotal = Math.round(expectedTotal * 100) / 100;

        if (Math.abs(purchase.total - expectedTotal) < 0.01) {
          passed++;
          testResults.calculationTests.push({
            type: 'purchase',
            expected: expectedTotal,
            actual: purchase.total,
            status: 'PASS'
          });
        } else {
          failed++;
          testResults.errors.push(
            `Purchase calculation error: Expected ${expectedTotal}, got ${purchase.total} ` +
            `(Subtotal: ${purchase.subtotal}, Discount: ${purchase.discount}, Transport: ${purchase.transport_fee}, Labour: ${purchase.labour_fee})`
          );
          testResults.calculationTests.push({
            type: 'purchase',
            expected: expectedTotal,
            actual: purchase.total,
            status: 'FAIL'
          });
        }
      } catch (e) {
        failed++;
        testResults.errors.push(`Purchase calculation test failed: ${e.message}`);
      }
    }
  } catch (e) {
    testResults.errors.push(`Purchase calculation test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.purchases.length;
}

async function testDatabaseIntegrity(invDb, stockDb) {
  console.log('\n🧪 TEST: Database Integrity Checks');
  let passed = 0;
  let failed = 0;

  try {
    // Check customer count
    const customerCount = await getRow(invDb, 'SELECT COUNT(*) as count FROM customers');
    if (customerCount.count === 100) {
      passed++;
      console.log(`  ✓ Customer count correct: ${customerCount.count}`);
    } else {
      failed++;
      testResults.warnings.push(`Customer count mismatch: expected 100, got ${customerCount.count}`);
    }

    // Check supplier count
    const supplierCount = await getRow(invDb, 'SELECT COUNT(*) as count FROM suppliers');
    if (supplierCount.count === 50) {
      passed++;
      console.log(`  ✓ Supplier count correct: ${supplierCount.count}`);
    } else {
      failed++;
      testResults.warnings.push(`Supplier count mismatch: expected 50, got ${supplierCount.count}`);
    }

    // Check product count
    const productCount = await getRow(stockDb, 'SELECT COUNT(*) as count FROM products');
    if (productCount.count === 200) {
      passed++;
      console.log(`  ✓ Product count correct: ${productCount.count}`);
    } else {
      failed++;
      testResults.warnings.push(`Product count mismatch: expected 200, got ${productCount.count}`);
    }

    // Check for orphaned transactions
    const orphanedCustTx = await getRow(invDb, 
      `SELECT COUNT(*) as count FROM customer_transactions WHERE customer_id NOT IN (SELECT id FROM customers)`
    );
    if (orphanedCustTx.count === 0) {
      passed++;
      console.log(`  ✓ No orphaned customer transactions`);
    } else {
      failed++;
      testResults.warnings.push(`Found ${orphanedCustTx.count} orphaned customer transactions`);
    }

    // Check for orphaned transactions
    const orphanedSupTx = await getRow(invDb, 
      `SELECT COUNT(*) as count FROM supplier_transactions WHERE supplier_id NOT IN (SELECT id FROM suppliers)`
    );
    if (orphanedSupTx.count === 0) {
      passed++;
      console.log(`  ✓ No orphaned supplier transactions`);
    } else {
      failed++;
      testResults.warnings.push(`Found ${orphanedSupTx.count} orphaned supplier transactions`);
    }
  } catch (e) {
    testResults.errors.push(`Database integrity test error: ${e.message}`);
    failed++;
  }

  console.log(`  ✓ Passed: ${passed}, ✗ Failed: ${failed}`);
  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += passed + failed;
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     1000 TEST DATA COMPREHENSIVE TEST SUITE - STARTING       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const invDb = new sqlite3.Database(INVENTORY_DB);
  const stockDb = new sqlite3.Database(STOCK_DB);

  try {
    console.log('\n📊 Generating 1000 test data entries...');
    const testData = generateTestData(1000);
    console.log(`  • Categories: ${testData.categories.length}`);
    console.log(`  • Products: ${testData.products.length}`);
    console.log(`  • Customers: ${testData.customers.length}`);
    console.log(`  • Suppliers: ${testData.suppliers.length}`);
    console.log(`  • Sales: ${testData.sales.length}`);
    console.log(`  • Purchases: ${testData.purchases.length}`);

    // Run all tests
    await testInsertCustomers(invDb, testData);
    await testInsertSuppliers(invDb, testData);
    await testInsertProducts(stockDb, testData);
    await testCustomerBalanceTransactions(invDb, testData);
    await testSupplierBalanceTransactions(invDb, testData);
    await testSaleCalculations(invDb, testData);
    await testPurchaseCalculations(invDb, testData);
    await testDatabaseIntegrity(invDb, stockDb);

    // Print summary
    printTestSummary();

  } catch (error) {
    console.error('❌ Fatal test error:', error.message);
    testResults.errors.push(`Fatal error: ${error.message}`);
  } finally {
    await closeDb(invDb);
    await closeDb(stockDb);
  }
}

function printTestSummary() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY REPORT                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const endTime = new Date();
  const duration = (endTime - testResults.startTime) / 1000;

  console.log(`\n📈 Overall Results:`);
  console.log(`  • Total Tests: ${testResults.totalTests}`);
  console.log(`  • ✅ Passed: ${testResults.passed}`);
  console.log(`  • ❌ Failed: ${testResults.failed}`);
  console.log(`  • Success Rate: ${((testResults.passed / testResults.totalTests) * 100).toFixed(2)}%`);
  console.log(`  • Duration: ${duration.toFixed(2)}s`);

  if (testResults.errors.length > 0) {
    console.log(`\n❌ ERRORS FOUND (${testResults.errors.length}):`);
    testResults.errors.slice(0, 20).forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    if (testResults.errors.length > 20) {
      console.log(`  ... and ${testResults.errors.length - 20} more errors`);
    }
  } else {
    console.log(`\n✅ NO ERRORS FOUND`);
  }

  if (testResults.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${testResults.warnings.length}):`);
    testResults.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }

  // Precision analysis
  const failedPrecision = testResults.precisionTests.filter(t => t.status === 'FAIL');
  if (failedPrecision.length > 0) {
    console.log(`\n🔍 PRECISION TEST FAILURES (${failedPrecision.length}):`);
    failedPrecision.slice(0, 10).forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.type}: Expected ${test.expected}, Got ${test.actual}`);
    });
  } else {
    console.log(`\n✅ ALL PRECISION TESTS PASSED (${testResults.precisionTests.length})`);
  }

  // Calculation analysis
  const failedCalc = testResults.calculationTests.filter(t => t.status === 'FAIL');
  if (failedCalc.length > 0) {
    console.log(`\n🔍 CALCULATION TEST FAILURES (${failedCalc.length}):`);
    failedCalc.slice(0, 10).forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.type}: Expected ${test.expected}, Got ${test.actual}`);
    });
  } else {
    console.log(`\n✅ ALL CALCULATION TESTS PASSED (${testResults.calculationTests.length})`);
  }

  // Final status
  console.log(`\n${'═'.repeat(64)}`);
  if (testResults.failed === 0) {
    console.log('✅ ALL TESTS PASSED - SOFTWARE IS READY FOR PRODUCTION');
  } else {
    console.log(`⚠️  ${testResults.failed} TEST(S) FAILED - PLEASE REVIEW ABOVE ERRORS`);
  }
  console.log(`${'═'.repeat(64)}\n`);

  // Write results to file
  const reportPath = path.join(__dirname, 'test-1k-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
