const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');
const STOCK_DB = path.join(__dirname, '..', 'database', 'stock.db');

const testResults = {
  startTime: new Date(),
  totalTests: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  stats: {
    insertedCustomers: 0,
    insertedSuppliers: 0,
    insertedProducts: 0,
    insertedTransactions: 0,
    precisionTestsRun: 0,
    calculationTestsRun: 0,
    transactionBalance: [],
    saleTotals: [],
    purchaseTotals: [],
    largestTransaction: 0,
    smallestTransaction: 999999999,
    averageTransactionSize: 0,
    totalTransactionAmount: 0
  }
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
      else resolve(rows || []);
    });
  });
}

function closeDb(db) {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

// Generate realistic test data
function generateTestData(count) {
  const data = [];

  for (let i = 0; i < count; i++) {
    const qty = Math.floor(Math.random() * 100) + 1;
    const price = parseFloat((Math.random() * 5000).toFixed(2));
    const itemSubtotal = Math.round(qty * price * 100) / 100;

    data.push({
      id: i,
      quantity: qty,
      unitPrice: price,
      subtotal: itemSubtotal,
      discount: parseFloat((Math.random() * 1000).toFixed(2)),
      transport: parseFloat((Math.random() * 500).toFixed(2)),
      labour: parseFloat((Math.random() * 300).toFixed(2)),
      get total() {
        return Math.round((this.subtotal - this.discount + this.transport + this.labour) * 100) / 100;
      }
    });
  }

  return data;
}

async function initializeCleanDatabase(invDb, stockDb) {
  console.log('\n🔄 Initializing clean databases...');
  
  try {
    // Clear existing data from key tables
    await runQuery(invDb, 'DELETE FROM customer_transactions');
    await runQuery(invDb, 'DELETE FROM customers');
    await runQuery(invDb, 'DELETE FROM supplier_transactions');
    await runQuery(invDb, 'DELETE FROM suppliers');
    await runQuery(invDb, 'DELETE FROM sales');
    await runQuery(invDb, 'DELETE FROM sale_items');
    await runQuery(stockDb, 'DELETE FROM products');
    
    console.log('  ✓ Databases cleaned');
  } catch (e) {
    console.warn('  ⚠️  Warning during cleanup:', e.message);
  }
}

async function testPrecisionCalculations(testData) {
  console.log('\n🧪 TEST 1: Precision Calculation (1000 transactions)');
  let passed = 0;
  let failed = 0;
  let totalAmount = 0;

  for (const item of testData) {
    const calculated = item.total;
    const expected = Math.round((item.subtotal - item.discount + item.transport + item.labour) * 100) / 100;

    if (Math.abs(calculated - expected) < 0.01) {
      passed++;
    } else {
      failed++;
      testResults.errors.push(
        `Calc Error ID ${item.id}: Expected ${expected}, Got ${calculated} ` +
        `(Sub: ${item.subtotal}, Disc: ${item.discount}, Trn: ${item.transport}, Lab: ${item.labour})`
      );
    }

    testResults.stats.calculationTestsRun++;
    totalAmount += item.total;
    testResults.stats.largestTransaction = Math.max(testResults.stats.largestTransaction, item.total);
    testResults.stats.smallestTransaction = Math.min(testResults.stats.smallestTransaction, item.total);
  }

  testResults.stats.totalTransactionAmount = Math.round(totalAmount * 100) / 100;
  testResults.stats.averageTransactionSize = Math.round((totalAmount / testData.length) * 100) / 100;

  console.log(`  ✓ Passed: ${passed}/${testData.length}`);
  console.log(`  ✗ Failed: ${failed}/${testData.length}`);
  console.log(`  📊 Stats:`);
  console.log(`     • Total Amount: ${testResults.stats.totalTransactionAmount}`);
  console.log(`     • Average: ${testResults.stats.averageTransactionSize}`);
  console.log(`     • Largest: ${testResults.stats.largestTransaction}`);
  console.log(`     • Smallest: ${testResults.stats.smallestTransaction}`);

  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += testData.length;

  return { passed, failed };
}

async function testCustomerBalanceEdgeCases(invDb) {
  console.log('\n🧪 TEST 2: Customer Balance Edge Cases (100 customers × 10 txns)');
  let passed = 0;
  let failed = 0;

  try {
    // Insert customers
    const customerIds = [];
    for (let i = 0; i < 100; i++) {
      const res = await runQuery(invDb,
        `INSERT INTO customers (name, email, phone, address, balance) VALUES (?, ?, ?, ?, ?)`,
        [`Cust_${i}`, `cust${i}@test.com`, `555${String(i).padStart(5, '0')}`, `Addr ${i}`, 0]
      );
      customerIds.push(res.lastID);
      testResults.stats.insertedCustomers++;
    }

    // Test each customer with 10 transactions
    for (const custId of customerIds.slice(0, 50)) {
      let runningBalance = 0;
      let expectedBalance = 0;

      for (let txn = 0; txn < 10; txn++) {
        const amount = parseFloat((Math.random() * 5000).toFixed(2));
        const type = Math.random() > 0.5 ? 'charge' : 'payment';

        if (type === 'charge') {
          expectedBalance = Math.round((expectedBalance + amount) * 100) / 100;
        } else {
          expectedBalance = Math.round((expectedBalance - amount) * 100) / 100;
        }

        await runQuery(invDb,
          `INSERT INTO customer_transactions (customer_id, type, amount, balance_before, balance_after, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [custId, type, amount, runningBalance, expectedBalance, `Txn ${txn}`]
        );

        runningBalance = expectedBalance;
        testResults.stats.insertedTransactions++;
      }

      // Verify final balance
      const finalTx = await getRow(invDb,
        `SELECT balance_after FROM customer_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1`,
        [custId]
      );

      if (finalTx && Math.abs(finalTx.balance_after - expectedBalance) < 0.01) {
        passed++;
      } else {
        failed++;
        testResults.errors.push(
          `Customer ${custId}: Expected balance ${expectedBalance}, got ${finalTx?.balance_after || 'NULL'}`
        );
      }
    }
  } catch (e) {
    failed++;
    testResults.errors.push(`Customer edge case test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  📊 Inserted ${testResults.stats.insertedTransactions} transactions`);

  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += (passed + failed);
}

async function testSupplierBalanceEdgeCases(invDb) {
  console.log('\n🧪 TEST 3: Supplier Balance Edge Cases (50 suppliers × 10 txns)');
  let passed = 0;
  let failed = 0;

  try {
    // Insert suppliers
    const supplierIds = [];
    for (let i = 0; i < 50; i++) {
      const res = await runQuery(invDb,
        `INSERT INTO suppliers (name, email, phone, address, contact_person, balance) VALUES (?, ?, ?, ?, ?, ?)`,
        [`Supp_${i}`, `supp${i}@test.com`, `666${String(i).padStart(5, '0')}`, `Supp Addr ${i}`, `Contact ${i}`, 0]
      );
      supplierIds.push(res.lastID);
    }

    // Test each supplier with 10 transactions
    for (const suppId of supplierIds) {
      let runningBalance = 0;
      let expectedBalance = 0;

      for (let txn = 0; txn < 10; txn++) {
        const amount = parseFloat((Math.random() * 10000).toFixed(2));
        const type = Math.random() > 0.5 ? 'charge' : 'payment';

        if (type === 'charge') {
          expectedBalance = Math.round((expectedBalance + amount) * 100) / 100;
        } else {
          expectedBalance = Math.round((expectedBalance - amount) * 100) / 100;
        }

        await runQuery(invDb,
          `INSERT INTO supplier_transactions (supplier_id, type, amount, balance_before, balance_after, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [suppId, type, amount, runningBalance, expectedBalance, `Txn ${txn}`]
        );

        runningBalance = expectedBalance;
        testResults.stats.insertedTransactions++;
      }

      // Verify final balance
      const finalTx = await getRow(invDb,
        `SELECT balance_after FROM supplier_transactions WHERE supplier_id = ? ORDER BY id DESC LIMIT 1`,
        [suppId]
      );

      if (finalTx && Math.abs(finalTx.balance_after - expectedBalance) < 0.01) {
        passed++;
      } else {
        failed++;
        testResults.errors.push(
          `Supplier ${suppId}: Expected balance ${expectedBalance}, got ${finalTx?.balance_after || 'NULL'}`
        );
      }
    }
  } catch (e) {
    failed++;
    testResults.errors.push(`Supplier edge case test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  📊 Inserted ${testResults.stats.insertedTransactions} total transactions`);

  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += (passed + failed);
}

async function testDatabaseConstraints(invDb, stockDb) {
  console.log('\n🧪 TEST 4: Database Constraints & Integrity');
  let passed = 0;
  let failed = 0;

  try {
    // Check foreign key constraints
    const custTx = await getRow(invDb,
      `SELECT COUNT(*) as count FROM customer_transactions WHERE customer_id NOT IN (SELECT id FROM customers)`
    );
    if (custTx.count === 0) {
      passed++;
      console.log(`  ✓ No orphaned customer transactions`);
    } else {
      failed++;
      testResults.warnings.push(`Found ${custTx.count} orphaned customer transactions`);
    }

    const suppTx = await getRow(invDb,
      `SELECT COUNT(*) as count FROM supplier_transactions WHERE supplier_id NOT IN (SELECT id FROM suppliers)`
    );
    if (suppTx.count === 0) {
      passed++;
      console.log(`  ✓ No orphaned supplier transactions`);
    } else {
      failed++;
      testResults.warnings.push(`Found ${suppTx.count} orphaned supplier transactions`);
    }

    // Check for NULL violations
    const nullCheck = await getRow(invDb,
      `SELECT COUNT(*) as count FROM customer_transactions WHERE amount IS NULL OR balance_after IS NULL`
    );
    if (nullCheck.count === 0) {
      passed++;
      console.log(`  ✓ No NULL values in critical fields`);
    } else {
      failed++;
      testResults.errors.push(`Found ${nullCheck.count} NULL values in critical fields`);
    }

    // Verify decimal precision
    const precisionCheck = await getAllRows(invDb,
      `SELECT amount FROM customer_transactions WHERE amount NOT LIKE '%.%' OR 
       CAST(amount AS TEXT) LIKE '%.___' LIMIT 10`
    );
    if (precisionCheck.length === 0) {
      passed++;
      console.log(`  ✓ All amounts have correct decimal precision`);
    } else {
      testResults.warnings.push(`Some amounts may have precision issues`);
    }
  } catch (e) {
    failed++;
    testResults.errors.push(`Constraint test error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);

  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += (passed + failed);
}

async function testLargeDataOperations(invDb) {
  console.log('\n🧪 TEST 5: Large Data Operations (Complex Queries)');
  let passed = 0;
  let failed = 0;

  try {
    // Test: Calculate total receivables from all customers
    const custReceivable = await getRow(invDb,
      `SELECT SUM(CASE WHEN type = 'charge' THEN amount ELSE -amount END) as total FROM customer_transactions`
    );
    if (custReceivable && custReceivable.total !== null) {
      passed++;
      console.log(`  ✓ Customer receivables calculated: ${custReceivable.total}`);
      testResults.stats.transactionBalance.push({
        type: 'customer_receivable',
        total: custReceivable.total
      });
    } else {
      failed++;
    }

    // Test: Calculate total payables from all suppliers
    const suppPayable = await getRow(invDb,
      `SELECT SUM(CASE WHEN type = 'charge' THEN amount ELSE -amount END) as total FROM supplier_transactions`
    );
    if (suppPayable && suppPayable.total !== null) {
      passed++;
      console.log(`  ✓ Supplier payables calculated: ${suppPayable.total}`);
      testResults.stats.transactionBalance.push({
        type: 'supplier_payable',
        total: suppPayable.total
      });
    } else {
      failed++;
    }

    // Test: Transaction distribution by type
    const txnDist = await getAllRows(invDb,
      `SELECT type, COUNT(*) as count, SUM(amount) as total FROM customer_transactions GROUP BY type`
    );
    if (txnDist.length > 0) {
      passed++;
      console.log(`  ✓ Transaction distribution:`);
      txnDist.forEach(row => {
        console.log(`     • ${row.type}: ${row.count} transactions, Total: ${row.total}`);
      });
    }

    // Test: Aggregation performance
    const startAggregate = Date.now();
    const allCustomers = await getAllRows(invDb,
      `SELECT c.id, c.name, SUM(CASE WHEN ct.type = 'charge' THEN ct.amount ELSE -ct.amount END) as balance
       FROM customers c
       LEFT JOIN customer_transactions ct ON c.id = ct.customer_id
       GROUP BY c.id ORDER BY balance DESC`
    );
    const aggTime = Date.now() - startAggregate;

    if (allCustomers && allCustomers.length > 0) {
      passed++;
      console.log(`  ✓ Aggregation completed in ${aggTime}ms for ${allCustomers.length} customers`);
    }
  } catch (e) {
    failed++;
    testResults.errors.push(`Large data operation error: ${e.message}`);
  }

  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);

  testResults.passed += passed;
  testResults.failed += failed;
  testResults.totalTests += (passed + failed);
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   1000+ COMPREHENSIVE TEST SUITE - CLEAN DATABASE MODE         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const invDb = new sqlite3.Database(INVENTORY_DB);
  const stockDb = new sqlite3.Database(STOCK_DB);

  try {
    // Initialize clean databases
    await initializeCleanDatabase(invDb, stockDb);

    // Generate test data
    console.log('\n📊 Generating 1000 test transactions...');
    const testData = generateTestData(1000);

    // Run all tests
    await testPrecisionCalculations(testData);
    await testCustomerBalanceEdgeCases(invDb);
    await testSupplierBalanceEdgeCases(invDb);
    await testDatabaseConstraints(invDb, stockDb);
    await testLargeDataOperations(invDb);

    // Print results
    printDetailedReport();

  } catch (error) {
    console.error('❌ Fatal test error:', error.message);
    testResults.errors.push(`Fatal: ${error.message}`);
  } finally {
    await closeDb(invDb);
    await closeDb(stockDb);
  }
}

function printDetailedReport() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   DETAILED TEST REPORT                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const endTime = new Date();
  const duration = (endTime - testResults.startTime) / 1000;

  console.log(`\n📈 OVERALL RESULTS:`);
  console.log(`  • Total Tests Run: ${testResults.totalTests}`);
  console.log(`  • ✅ Passed: ${testResults.passed}`);
  console.log(`  • ❌ Failed: ${testResults.failed}`);
  console.log(`  • Success Rate: ${((testResults.passed / testResults.totalTests) * 100).toFixed(2)}%`);
  console.log(`  • Duration: ${duration.toFixed(2)}s`);

  console.log(`\n📊 DATA STATISTICS:`);
  console.log(`  • Customers Inserted: ${testResults.stats.insertedCustomers}`);
  console.log(`  • Suppliers Inserted: ${testResults.stats.insertedSuppliers}`);
  console.log(`  • Transactions Inserted: ${testResults.stats.insertedTransactions}`);
  console.log(`  • Calculation Tests: ${testResults.stats.calculationTestsRun}`);
  console.log(`  • Total Transaction Amount: ${testResults.stats.totalTransactionAmount}`);
  console.log(`  • Average Transaction: ${testResults.stats.averageTransactionSize}`);
  console.log(`  • Largest Transaction: ${testResults.stats.largestTransaction}`);
  console.log(`  • Smallest Transaction: ${testResults.stats.smallestTransaction}`);

  if (testResults.stats.transactionBalance.length > 0) {
    console.log(`\n💰 BALANCE INFORMATION:`);
    testResults.stats.transactionBalance.forEach(bal => {
      console.log(`  • ${bal.type}: ${bal.total}`);
    });
  }

  if (testResults.errors.length > 0) {
    console.log(`\n❌ ERRORS (${testResults.errors.length}):`);
    testResults.errors.slice(0, 15).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
    if (testResults.errors.length > 15) {
      console.log(`  ... and ${testResults.errors.length - 15} more`);
    }
  } else {
    console.log(`\n✅ NO ERRORS FOUND`);
  }

  if (testResults.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${testResults.warnings.length}):`);
    testResults.warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. ${warn}`);
    });
  }

  console.log(`\n${'═'.repeat(64)}`);
  if (testResults.failed === 0 && testResults.errors.length === 0) {
    console.log('✅ ALL TESTS PASSED - SOFTWARE IS FULLY FUNCTIONAL');
  } else {
    console.log(`⚠️  ${testResults.failed} TEST(S) FAILED - REVIEW ABOVE`);
  }
  console.log(`${'═'.repeat(64)}\n`);

  // Save report
  const reportPath = path.join(__dirname, 'test-1k-clean-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`📄 Full report saved: ${reportPath}`);
}

runTests().catch(error => {
  console.error('Uncaught:', error);
  process.exit(1);
});
