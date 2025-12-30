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

exports.getAllProducts = async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT * FROM products ORDER BY created_at DESC`
    );
    res.json(products);
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
    res.json(products);
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

    res.json(product);
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
       SET name = ?, description = ?, price = ?, cost = ?, quantity = ?, min_stock = ?
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

    res.json({ product, movements });
  } catch (error) {
    next(error);
  }
};

exports.addProductMovement = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const { type, quantity, price = null, reference_id = null, transaction_date = null } = req.body || {};

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
    await db.run('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [delta, productId]);

    await ensureItemTransactionsTable();

    await insertItemTransaction({
      item_id: productId,
      type,
      quantity: qty,
      price: price === undefined ? null : Number(price),
      transaction_date: transaction_date || new Date().toISOString(),
      reference_type: null,
      reference_id
    });

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    res.json({ message: 'Movement recorded', product: updated });
  } catch (error) {
    console.error('Error adding product movement:', error);
    next(error);
  }
};
