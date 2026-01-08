const db = require('../database/stockDb');
const { ensureItemTransactionsTable, insertItemTransaction } = require('../utils/itemTransactions');

// Ensure stock_history table exists (idempotent)
let stockHistoryInitialized = false;
async function ensureStockHistoryTable() {
  if (stockHistoryInitialized) return;
  await db.run(`CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    change INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);
  stockHistoryInitialized = true;
}

// Helper: Calculate average rate for a product from all movements
async function calculateAverageRate(productId) {
  try {
    await ensureItemTransactionsTable();
    const result = await db.get(
      `SELECT AVG(CASE WHEN quantity > 0 THEN price / quantity ELSE 0 END) as avg_rate
       FROM inventory_item_transactions
       WHERE item_id = ? AND price IS NOT NULL AND price > 0 AND quantity > 0`,
      [productId]
    );
    const avgRate = result?.avg_rate;
    return avgRate ? parseFloat(avgRate.toFixed(3)) : 0;
  } catch (error) {
    console.error('Error calculating average rate:', error);
    return 0;
  }
}

// Helper: Calculate separate rates for purchase and sell
async function calculateSeparateRates(productId) {
  try {
    await ensureItemTransactionsTable();
    
    // Calculate purchase rate (PURCHASE transactions only)
    const purchaseResult = await db.get(
      `SELECT AVG(CASE WHEN quantity > 0 THEN price / quantity ELSE 0 END) as purchase_rate
       FROM inventory_item_transactions
       WHERE item_id = ? AND type = 'PURCHASE' AND price IS NOT NULL AND price > 0 AND quantity > 0`,
      [productId]
    );
    
    // Calculate selling rate (SELL transactions only)
    const sellResult = await db.get(
      `SELECT AVG(CASE WHEN quantity > 0 THEN price / quantity ELSE 0 END) as selling_rate
       FROM inventory_item_transactions
       WHERE item_id = ? AND type = 'SELL' AND price IS NOT NULL AND price > 0 AND quantity > 0`,
      [productId]
    );
    
    return {
      purchase_rate: purchaseResult?.purchase_rate ? parseFloat(purchaseResult.purchase_rate.toFixed(3)) : 0,
      selling_rate: sellResult?.selling_rate ? parseFloat(sellResult.selling_rate.toFixed(3)) : 0
    };
  } catch (error) {
    console.error('Error calculating separate rates:', error);
    return { purchase_rate: 0, selling_rate: 0 };
  }
}

exports.getAllProducts = async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT * FROM products ORDER BY updated_at DESC, created_at DESC`
    );

    // Add separate purchase and selling rates to each product
    const productsWithRates = await Promise.all(
      products.map(async (p) => {
        const rates = await calculateSeparateRates(p.id);
        return {
          ...p,
          purchase_rate: rates.purchase_rate,
          selling_rate: rates.selling_rate
        };
      })
    );

    res.json(productsWithRates);
  } catch (error) {
    next(error);
  }
};

exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT * FROM products
       WHERE quantity <= min_stock
       ORDER BY quantity ASC`
    );

    // Add separate purchase and selling rates to each product
    const productsWithRates = await Promise.all(
      products.map(async (p) => {
        const rates = await calculateSeparateRates(p.id);
        return {
          ...p,
          purchase_rate: rates.purchase_rate,
          selling_rate: rates.selling_rate
        };
      })
    );

    res.json(productsWithRates);
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await db.get(
      `SELECT * FROM products WHERE id = ?`,
      [req.params.id]
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Add separate purchase and selling rates to product
    const rates = await calculateSeparateRates(product.id);
    res.json({ ...product, purchase_rate: rates.purchase_rate, selling_rate: rates.selling_rate });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    console.log('createProduct called with body:', req.body);
    const {
      name,
      description = null,
      price = null,
      cost = null,
      quantity = null,
      min_stock = null,
    } = req.body;

    // Only name is required
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    // Check if product with same name already exists (case-insensitive)
    const trimmedName = name.trim();
    console.log('Checking for existing product with name:', trimmedName);
    const existingProduct = await db.get(
      'SELECT * FROM products WHERE LOWER(name) = LOWER(?)',
      [trimmedName]
    );

    if (existingProduct) {
      // Merge: Update existing product by adding quantities and updating other fields if provided
      const newQuantity = (existingProduct.quantity || 0) + (Number(quantity) || 0);
      const updatedPrice = price !== null && price !== undefined ? price : existingProduct.price;
      const updatedCost = cost !== null && cost !== undefined ? cost : existingProduct.cost;
      const updatedDescription = description || existingProduct.description;
      const updatedMinStock = min_stock !== null && min_stock !== undefined ? min_stock : existingProduct.min_stock;

      await db.run(
        `UPDATE products 
         SET quantity = ?, price = ?, cost = ?, description = ?, min_stock = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newQuantity, updatedPrice, updatedCost, updatedDescription, updatedMinStock, existingProduct.id]
      );

      const updated = await db.get('SELECT * FROM products WHERE id = ?', [existingProduct.id]);
      return res.status(200).json({ 
        message: 'Product merged with existing item',
        product: updated,
        merged: true
      });
    }

    // Create new product if name doesn't exist - only name is required, all else optional
    const finalPrice = price !== null && price !== undefined ? price : 0;
    const finalCost = cost !== null && cost !== undefined ? cost : 0;
    const finalQty = quantity !== null && quantity !== undefined ? quantity : 0;
    const finalMinStock = min_stock !== null && min_stock !== undefined ? min_stock : 0;

    const result = await db.run(
      `INSERT INTO products (name, description, price, cost, quantity, min_stock)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), description, finalPrice, finalCost, finalQty, finalMinStock]
    );

    const product = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.status(201).json({ product, merged: false });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      cost,
      quantity,
      min_stock,
    } = req.body;

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.run(
      `UPDATE products
       SET name = ?, description = ?, price = ?, cost = ?, quantity = ?, min_stock = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name ?? existing.name,
        description ?? existing.description,
        price ?? existing.price,
        cost ?? existing.cost,
        quantity ?? existing.quantity,
        min_stock ?? existing.min_stock,
        req.params.id,
      ]
    );

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, reason = 'manual adjustment' } = req.body;
    const delta = Number(quantity);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: 'Quantity change must be a non-zero number' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [delta, req.params.id]);

    await ensureStockHistoryTable();
    await db.run(
      'INSERT INTO stock_history (product_id, change, reason) VALUES (?, ?, ?)',
      [req.params.id, delta, reason]
    );

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Stock adjusted successfully', product: updated });
  } catch (error) {
    next(error);
  }
};

exports.getStockHistory = async (req, res, next) => {
  try {
    await ensureStockHistoryTable();
    const history = await db.all(
      `SELECT * FROM stock_history
       WHERE product_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
};

exports.getProductMovements = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const { startDate, endDate } = req.query;

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await ensureItemTransactionsTable();

    let query = `SELECT * FROM inventory_item_transactions WHERE item_id = ?`;
    const params = [productId];

    if (startDate) {
      query += ' AND DATE(transaction_date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(transaction_date) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY transaction_date DESC, created_at DESC, id DESC LIMIT 500';

    const movements = await db.all(query, params);

    // Add rate to each movement (price / quantity, with 3 decimal places)
    const movementsWithRates = movements.map((m) => ({
      ...m,
      rate: (m.price && m.quantity && m.quantity > 0) 
        ? parseFloat((m.price / m.quantity).toFixed(3))
        : 0
    }));

    // Add separate purchase and selling rates to product
    const rates = await calculateSeparateRates(productId);
    const productWithRate = { ...product, purchase_rate: rates.purchase_rate, selling_rate: rates.selling_rate };

    res.json({ product: productWithRate, movements: movementsWithRates });
  } catch (error) {
    next(error);
  }
};

exports.addProductMovement = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const { type, quantity, price = 0, reference_id = null, transaction_date = null } = req.body || {};

    if (!productId || !Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    if (!type || (type !== 'PURCHASE' && type !== 'SELL')) {
      return res.status(400).json({ error: 'type must be PURCHASE or SELL' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const delta = type === 'PURCHASE' ? qty : -qty;
    const priceNum = Number(price) || 0;
    
    if (type === 'PURCHASE') {
      // When purchasing: add the total cost to the accumulated cost
      await db.run(
        'UPDATE products SET quantity = quantity + ?, cost = COALESCE(cost, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [qty, priceNum, productId]
      );
    } else if (type === 'SELL') {
      // When selling: deduct the specified cost from accumulated cost
      await db.run(
        'UPDATE products SET quantity = quantity - ?, cost = COALESCE(cost, 0) - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [qty, priceNum, productId]
      );
    }

    await ensureItemTransactionsTable();

    await insertItemTransaction({
      item_id: productId,
      type,
      quantity: qty,
      price: priceNum,
      transaction_date: transaction_date || new Date().toISOString(),
      reference_type: null,
      reference_id
    });

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    const rates = await calculateSeparateRates(productId);
    res.json({ message: 'Movement recorded', product: { ...updated, purchase_rate: rates.purchase_rate, selling_rate: rates.selling_rate } });
  } catch (error) {
    console.error('Error adding product movement:', error);
    next(error);
  }
};
exports.updateProductMovement = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const movementId = Number(req.params.movementId);
    const { type, quantity, price = 0, transaction_date = null } = req.body || {};

    if (!productId || !Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    if (!movementId || !Number.isFinite(movementId)) {
      return res.status(400).json({ error: 'Invalid movement id' });
    }
    if (!type || (type !== 'PURCHASE' && type !== 'SELL')) {
      return res.status(400).json({ error: 'type must be PURCHASE or SELL' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await ensureItemTransactionsTable();

    // Get the old movement to calculate delta
    const oldMovement = await db.get(
      'SELECT * FROM inventory_item_transactions WHERE id = ? AND item_id = ?',
      [movementId, productId]
    );

    if (!oldMovement) {
      return res.status(404).json({ error: 'Movement not found' });
    }

    // Calculate old and new deltas
    const oldDelta = oldMovement.type === 'PURCHASE' ? oldMovement.quantity : -oldMovement.quantity;
    const newDelta = type === 'PURCHASE' ? qty : -qty;
    const quantityDifference = newDelta - oldDelta;

    // Update the movement
    await db.run(
      `UPDATE inventory_item_transactions 
       SET type = ?, quantity = ?, price = ?, transaction_date = ?
       WHERE id = ?`,
      [type, qty, Number(price), transaction_date || new Date().toISOString(), movementId]
    );

    // Update product quantity based on the difference
    await db.run(
      'UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quantityDifference, productId]
    );

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    const rates = await calculateSeparateRates(productId);
    res.json({ message: 'Movement updated', product: { ...updated, purchase_rate: rates.purchase_rate, selling_rate: rates.selling_rate } });
  } catch (error) {
    console.error('Error updating product movement:', error);
    next(error);
  }
};