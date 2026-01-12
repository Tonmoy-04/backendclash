/**
 * Test Script: Verify Movement Edit Updates Dashboard Total Product Price
 * 
 * This test verifies that when you edit a stock movement (buy/sell),
 * the product's cost field is properly updated, which affects the
 * dashboard's "Total Product Price" statcard.
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Helper to make API calls
async function get(path) {
  const res = await axios.get(`${API_BASE}${path}`);
  return res.data;
}

async function post(path, data) {
  const res = await axios.post(`${API_BASE}${path}`, data);
  return res.data;
}

async function put(path, data) {
  const res = await axios.put(`${API_BASE}${path}`, data);
  return res.data;
}

async function deleteReq(path) {
  const res = await axios.delete(`${API_BASE}${path}`);
  return res.data;
}

async function runTest() {
  console.log('🧪 MOVEMENT EDIT TEST - Dashboard Total Product Price Update\n');
  console.log('='.repeat(70));

  try {
    // STEP 1: Get initial dashboard stats
    console.log('\n📊 STEP 1: Get initial dashboard stats');
    const initialStats = await get('/dashboard/stats');
    const initialTotalProductPrice = initialStats.totalProductPrice || 0;
    console.log(`   Initial Total Product Price: ৳${initialTotalProductPrice.toFixed(2)}`);

    // STEP 2: Create a test product
    console.log('\n📦 STEP 2: Create test product');
    const product = await post('/products', {
      name: `TEST-MOVEMENT-${Date.now()}`,
      description: 'Test product for movement editing',
      price: 100,
      cost: 0,
      quantity: 0,
      min_stock: 5
    });
    const productId = product.id;
    console.log(`   Created product ID: ${productId}`);

    // STEP 3: Create a PURCHASE movement (buy stock)
    console.log('\n🛒 STEP 3: Create PURCHASE movement (Buy 10 units @ ৳5000)');
    await post(`/products/${productId}/movements`, {
      type: 'PURCHASE',
      quantity: 10,
      price: 5000,
      transaction_date: new Date().toISOString()
    });

    // Get dashboard stats after purchase
    const statsAfterPurchase = await get('/dashboard/stats');
    const totalAfterPurchase = statsAfterPurchase.totalProductPrice || 0;
    const purchaseIncrease = totalAfterPurchase - initialTotalProductPrice;
    console.log(`   Total Product Price: ৳${totalAfterPurchase.toFixed(2)}`);
    console.log(`   Increase: ৳${purchaseIncrease.toFixed(2)} (Expected: ৳5000)`);
    
    if (Math.abs(purchaseIncrease - 5000) < 0.01) {
      console.log('   ✅ PASS: Purchase correctly increased Total Product Price');
    } else {
      console.log('   ❌ FAIL: Purchase did not increase Total Product Price by ৳5000');
      throw new Error('Purchase movement did not update dashboard');
    }

    // STEP 4: Get movement ID
    console.log('\n🔍 STEP 4: Get movement ID');
    const movements = await get(`/products/${productId}/movements`);
    const movementId = movements.movements[0].id;
    console.log(`   Movement ID: ${movementId}`);

    // STEP 5: Edit the movement (change from ৳5000 to ৳6000)
    console.log('\n✏️ STEP 5: Edit movement (change price from ৳5000 to ৳6000)');
    await put(`/products/${productId}/movements/${movementId}`, {
      type: 'PURCHASE',
      quantity: 10,
      price: 6000,
      transaction_date: new Date().toISOString()
    });

    // STEP 6: Verify dashboard updated
    console.log('\n📊 STEP 6: Verify dashboard Total Product Price updated');
    const statsAfterEdit = await get('/dashboard/stats');
    const totalAfterEdit = statsAfterEdit.totalProductPrice || 0;
    const expectedAfterEdit = initialTotalProductPrice + 6000;
    const actualIncrease = totalAfterEdit - initialTotalProductPrice;
    
    console.log(`   Total Product Price: ৳${totalAfterEdit.toFixed(2)}`);
    console.log(`   Expected: ৳${expectedAfterEdit.toFixed(2)}`);
    console.log(`   Actual increase from initial: ৳${actualIncrease.toFixed(2)}`);

    if (Math.abs(totalAfterEdit - expectedAfterEdit) < 0.01) {
      console.log('   ✅ PASS: Movement edit correctly updated Total Product Price!');
    } else {
      console.log('   ❌ FAIL: Movement edit did NOT update Total Product Price');
      throw new Error('Movement edit did not update dashboard');
    }

    // STEP 7: Edit again (change from PURCHASE to SELL)
    console.log('\n✏️ STEP 7: Edit movement again (change from PURCHASE to SELL @ ৳3000)');
    await put(`/products/${productId}/movements/${movementId}`, {
      type: 'SELL',
      quantity: 5,
      price: 3000,
      transaction_date: new Date().toISOString()
    });

    // STEP 8: Verify dashboard updated again
    console.log('\n📊 STEP 8: Verify dashboard updated after type change');
    const statsAfterTypeChange = await get('/dashboard/stats');
    const totalAfterTypeChange = statsAfterTypeChange.totalProductPrice || 0;
    const expectedAfterTypeChange = initialTotalProductPrice - 3000; // SELL reduces cost
    
    console.log(`   Total Product Price: ৳${totalAfterTypeChange.toFixed(2)}`);
    console.log(`   Expected: ৳${expectedAfterTypeChange.toFixed(2)}`);

    if (Math.abs(totalAfterTypeChange - expectedAfterTypeChange) < 0.01) {
      console.log('   ✅ PASS: Type change correctly updated Total Product Price!');
    } else {
      console.log('   ❌ FAIL: Type change did NOT update Total Product Price correctly');
      throw new Error('Type change did not update dashboard correctly');
    }

    // STEP 9: Cleanup
    console.log('\n🧹 STEP 9: Cleanup test product');
    await deleteReq(`/products/${productId}`);
    console.log('   Test product deleted');

    // Final verification
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ Movement editing now correctly updates Dashboard Total Product Price');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    console.error('='.repeat(70));
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n✨ Test completed successfully!\n');
  process.exit(0);
}).catch(err => {
  console.error('\n💥 Test script error:', err);
  process.exit(1);
});
