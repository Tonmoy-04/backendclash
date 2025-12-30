const { run, get } = require('../database/db');
const { generateBill } = require('../utils/billGenerator');

(async () => {
  try {
    const supplierName = 'Test Supplier';
    const productName = 'Test Product P';
    const quantity = 3;
    const cost = 25;
    const subtotal = quantity * cost;
    const total = subtotal;
    const purchaseDate = new Date().toISOString();
    const userId = 1;

    // Ensure product exists
    let product = await get('SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [productName]);
    let productId;
    if (!product) {
      const created = await run('INSERT INTO products (name, quantity, cost, price) VALUES (?, ?, ?, ?)', [productName, 0, cost, 0]);
      productId = created.lastID;
    } else {
      productId = product.id;
    }

    // Create purchase
    const purchaseRes = await run(
      `INSERT INTO purchases (supplier_id, payment_method, notes, total, purchase_date, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [null, 'cash', '', total, purchaseDate, userId]
    );
    const purchaseId = purchaseRes.lastID;

    // Create purchase item
    await run(
      'INSERT INTO purchase_items (purchase_id, product_id, quantity, cost, subtotal) VALUES (?, ?, ?, ?, ?)',
      [purchaseId, productId, quantity, cost, subtotal]
    );

    // Build bill data
    const transaction = {
      id: purchaseId,
      date: purchaseDate,
      party: supplierName,
      payment_method: 'cash',
      subtotal,
      tax: 0,
      total,
    };
    const items = [{ product_name: productName, quantity, cost, subtotal }];

    const filePath = await generateBill({ type: 'purchase', transaction, items });
    console.log('Generated sample purchase bill at:', filePath);
  } catch (err) {
    console.error('Error generating sample purchase bill:', err);
    process.exitCode = 1;
  }
})();
