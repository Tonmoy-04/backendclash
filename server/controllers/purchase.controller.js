const db = require('../database/db');
const stockDb = require('../database/stockDb');
const { generateBill } = require('../utils/billGenerator');
const { ensureItemTransactionsTable, insertItemTransaction } = require('../utils/itemTransactions');

exports.getAllPurchases = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT p.*, 
             COALESCE(p.supplier_name, s.name) as supplier_name 
      FROM purchases p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND DATE(p.purchase_date) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(p.purchase_date) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY p.purchase_date DESC, p.created_at DESC';

    const purchases = await db.all(query, params);
    res.json(purchases);
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await db.get(
      `SELECT p.*, 
              COALESCE(p.supplier_name, s.name) as supplier_name, 
              s.contact_person, s.phone, s.email 
       FROM purchases p 
       LEFT JOIN suppliers s ON p.supplier_id = s.id 
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const items = await db.all(
      `SELECT pi.*, COALESCE(pi.product_name, '') as product_name 
       FROM purchase_items pi 
       WHERE pi.purchase_id = ?`,
      [req.params.id]
    );

    purchase.items = items;
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const { supplier_id = null, supplier_name, items, payment_method = 'due', notes = '' } = req.body;

    console.log('Creating purchase with payload:', JSON.stringify(req.body, null, 2));

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Process items - quantity defaults to 1, price is optional, product_name can be empty
    let total = 0;
    const processedItems = [];

    for (const item of items) {
      console.log('Processing item:', JSON.stringify(item, null, 2));
      const productId = item.product_id || null;
      const productName = item.product_name && item.product_name.trim() ? item.product_name.trim() : null;
      const quantity = item.quantity || 1;
      const unitCost = (item.cost !== undefined && item.cost !== null)
        ? Number(item.cost)
        : (item.price !== undefined && item.price !== null)
        ? Number(item.price)
        : 0;

      const itemSubtotal = quantity * unitCost;

      processedItems.push({
        product_name: productName,
        product_id: productId,
        quantity,
        cost: unitCost,
        subtotal: itemSubtotal
      });

      total += itemSubtotal;
    }

    // Use provided date or default to now
    const purchaseDate = req.body.purchase_date || new Date().toISOString();
    const discount = req.body.discount || 0;
    const finalTotal = req.body.total || (total - discount);

    // Create purchase with minimal required data
    const userId = req.user?.id || 1;
    const purchaseResult = await db.run(
      `INSERT INTO purchases (supplier_id, supplier_name, payment_method, notes, discount, total, purchase_date, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_id || null, supplier_name || null, payment_method, notes, discount, finalTotal, purchaseDate, userId]
    );

    const purchaseId = purchaseResult.lastID;

    await ensureItemTransactionsTable();

    // Create purchase items and update stock in stock database
    for (const item of processedItems) {
      const quantity = item.quantity || 0;
      const cost = item.cost || 0;
      const subtotalItem = item.subtotal || 0;

      // Persist purchase item (in inventory.db)
      await db.run(
        'INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, cost, subtotal, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [purchaseId, item.product_id || null, item.product_name || null, quantity, cost, subtotalItem, cost, subtotalItem]
      );

      // Stock updates disabled - transactions and inventory are completely separated
    }

    // Note: Bill generation is now manual via the bill generator endpoint

    res.status(201).json({ 
      message: 'Purchase created successfully', 
      purchaseId,
      total 
    });
  } catch (error) {
    next(error);
  }
};

// Generate bill for a specific purchase
  exports.generatePurchaseBill = async (req, res, next) => {
  try {
    const id = req.params.id;
    const purchase = await db.get(
      `SELECT p.*, s.name as supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [id]
    );
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    const items = await db.all(
      `SELECT pi.quantity, pi.cost, pi.subtotal, 
              COALESCE(pi.product_name, 'N/A') as product_name
       FROM purchase_items pi
       WHERE pi.purchase_id = ?
       ORDER BY pi.id ASC`,
      [id]
    );
    const adjustment = Number(req.body?.adjustment ?? req.query?.adjustment ?? purchase.discount ?? 0) || 0;
    
    // Calculate subtotal from items
    const itemsSubtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.cost) || 0;
      return sum + (qty * cost);
    }, 0);
    
    const billTx = {
      id: purchase.id,
      date: purchase.purchase_date || purchase.created_at,
      party: purchase.supplier_name || 'N/A',
      payment_method: purchase.payment_method || 'N/A',
      subtotal: itemsSubtotal,
      tax: 0,
      total: itemsSubtotal,
    };
    const filePath = await generateBill({ type: 'purchase', transaction: billTx, items, adjustment });
    res.json({ message: 'Bill generated', path: filePath });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchase = async (req, res, next) => {
  try {
    const { supplier_name, payment_method, notes, status, total, items } = req.body;

    console.log('Updating purchase with payload:', JSON.stringify(req.body, null, 2));

    // Calculate total from items if items array is provided
    let calculatedTotal = 0;
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const quantity = item.quantity || 1;
        const cost = (item.cost !== undefined && item.cost !== null) ? Number(item.cost) : 0;
        calculatedTotal += quantity * cost;
      }
    } else if (total !== undefined && total !== null) {
      calculatedTotal = Number(total) || 0;
    }

    const discount = req.body.discount || 0;
    const finalTotal = req.body.total || calculatedTotal;

    // Update purchase header
    await db.run(
      'UPDATE purchases SET supplier_name = ?, payment_method = ?, notes = ?, discount = ?, status = ?, total = ? WHERE id = ?',
      [supplier_name || null, payment_method, notes || '', discount, status || 'completed', finalTotal, req.params.id]
    );

    // If items are provided, update them
    if (items && Array.isArray(items) && items.length > 0) {
      // Delete existing purchase items
      await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [req.params.id]);

      // Insert new items
      for (const item of items) {
        const productId = item.product_id || null;
        const productName = item.product_name && item.product_name.trim() ? item.product_name.trim() : null;
        const quantity = item.quantity || 1;
        const unitCost = (item.cost !== undefined && item.cost !== null) ? Number(item.cost) : 0;
        const itemSubtotal = quantity * unitCost;

        await db.run(
          `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, cost, subtotal, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, productId, productName, quantity, unitCost, itemSubtotal, unitCost, itemSubtotal]
        );
      }
    }

    res.json({ message: 'Purchase updated successfully' });
  } catch (error) {
    console.error('Error updating purchase:', error);
    next(error);
  }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    // Delete purchase items
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [req.params.id]);

    // Delete purchase
    await db.run('DELETE FROM purchases WHERE id = ?', [req.params.id]);

    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getPurchasesBySupplier = async (req, res, next) => {
  try {
    const purchases = await db.all(
      `SELECT * FROM purchases WHERE supplier_id = ? ORDER BY purchase_date DESC`,
      [req.params.supplierId]
    );
    res.json(purchases);
  } catch (error) {
    next(error);
  }
};
