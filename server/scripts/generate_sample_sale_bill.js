const { run, get } = require('../database/db');
const { generateBill } = require('../utils/billGenerator');

(async () => {
  try {
    const customerName = 'Test Customer';
    const productName = 'Test Product';
    const quantity = 2;
    const price = 50;
    const subtotal = quantity * price;
    const tax = 0;
    const total = subtotal + tax;
    const saleDate = new Date().toISOString();
    const userId = 1;

    // Ensure product exists
    let product = await get('SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [productName]);
    let productId;
    if (!product) {
      const created = await run('INSERT INTO products (name, quantity, price) VALUES (?, ?, ?)', [productName, 0, price]);
      productId = created.lastID;
    } else {
      productId = product.id;
    }

    // Create sale
    const saleRes = await run(
      `INSERT INTO sales (customer_name, payment_method, notes, subtotal, tax, total, sale_date, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerName, 'cash', '', subtotal, tax, total, saleDate, userId]
    );
    const saleId = saleRes.lastID;

    // Create sale item
    await run(
      'INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
      [saleId, productId, quantity, price, subtotal]
    );

    // Build bill data
    const transaction = {
      id: saleId,
      date: saleDate,
      party: customerName,
      payment_method: 'cash',
      subtotal,
      tax,
      total,
    };
    const items = [{ product_name: productName, quantity, price, subtotal }];

    const filePath = await generateBill({ type: 'sale', transaction, items });
    console.log('Generated sample sale bill at:', filePath);
  } catch (err) {
    console.error('Error generating sample sale bill:', err);
    process.exitCode = 1;
  }
})();
