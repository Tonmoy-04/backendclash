const db = require('../database/db');
const stockDb = require('../database/stockDb');
const { generateBill } = require('../utils/billGenerator');
const { ensureItemTransactionsTable, insertItemTransaction } = require('../utils/itemTransactions');
const { touchSupplier, touchProduct } = require('../utils/activity');
const { parseDDMMYYYY } = require('../utils/dateConverter');

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
    
    // Sanitize purchase_date to ensure it's in ISO format
    purchases.forEach(purchase => {
      if (purchase.purchase_date) {
        try {
          const dateObj = new Date(purchase.purchase_date);
          if (isNaN(dateObj.getTime())) {
            console.warn(`[getAllPurchases] Invalid purchase_date for purchase ${purchase.id}:`, purchase.purchase_date);
            purchase.purchase_date = new Date().toISOString();
          } else {
            purchase.purchase_date = dateObj.toISOString();
          }
        } catch (err) {
          console.warn(`[getAllPurchases] Error parsing purchase_date:`, err.message);
          purchase.purchase_date = new Date().toISOString();
        }
      }
    });
    
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
    
    // Sanitize purchase_date to ensure it's in ISO format
    if (purchase.purchase_date) {
      try {
        const dateObj = new Date(purchase.purchase_date);
        if (isNaN(dateObj.getTime())) {
          console.warn(`[getPurchaseById] Invalid purchase_date for purchase ${purchase.id}:`, purchase.purchase_date);
          purchase.purchase_date = new Date().toISOString();
        } else {
          purchase.purchase_date = dateObj.toISOString();
        }
      } catch (err) {
        console.warn(`[getPurchaseById] Error parsing purchase_date:`, err.message);
        purchase.purchase_date = new Date().toISOString();
      }
    }
    
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const { supplier_id = null, supplier_name, supplier_address, description, items, payment_method = 'due', notes = '', discount = 0, transport_fee = 0, labour_fee = 0 } = req.body;

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
      const quantity = Number(item.quantity) || 1;
      const unitCost = (item.cost !== undefined && item.cost !== null)
        ? Number(item.cost)
        : (item.price !== undefined && item.price !== null)
        ? Number(item.price)
        : 0;

      // Calculate item subtotal with precision rounding
      const itemSubtotal = Math.round(quantity * unitCost * 100) / 100;

      processedItems.push({
        product_name: productName,
        product_id: productId,
        quantity,
        cost: unitCost,
        subtotal: itemSubtotal
      });

      total = Math.round((total + itemSubtotal) * 100) / 100;
    }

    // Parse and validate purchase date - NO FALLBACKS
    console.log('[Purchase Controller] Incoming purchase_date:', req.body.purchase_date);
    console.log('[Purchase Controller] purchase_date type:', typeof req.body.purchase_date);
    
    if (!req.body.purchase_date) {
      return res.status(400).json({ 
        error: 'purchase_date is required', 
        details: 'Please provide a valid date in dd/mm/yyyy format' 
      });
    }
    
    const purchaseDate = parseDDMMYYYY(req.body.purchase_date);
    console.log('[Purchase Controller] Parsed date:', purchaseDate);
    console.log('[Purchase Controller] Is valid date?', purchaseDate instanceof Date && !isNaN(purchaseDate.getTime()));
    
    if (!purchaseDate || isNaN(purchaseDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid purchase_date format', 
        details: 'Expected dd/mm/yyyy format. Received: ' + req.body.purchase_date,
        received: req.body.purchase_date
      });
    }
    
    console.log('[Purchase Controller] Final ISO date to store:', purchaseDate.toISOString());
    const discountVal = Math.round((Number(discount) || 0) * 100) / 100;
    const transportVal = Math.round((Number(transport_fee) || 0) * 100) / 100;
    const labourVal = Math.round((Number(labour_fee) || 0) * 100) / 100;
    const finalTotal = Math.round((req.body.total || (total - discountVal) + transportVal + labourVal) * 100) / 100;

    // Create purchase with minimal required data
    const userId = req.user?.id || 1;
    const purchaseResult = await db.run(
      `INSERT INTO purchases (supplier_id, supplier_name, supplier_address, description, payment_method, notes, discount, transport_fee, labour_fee, total, purchase_date, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_id || null, supplier_name || null, supplier_address || '', description || '', payment_method, notes, discountVal, transportVal, labourVal, finalTotal, purchaseDate.toISOString(), userId]
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
      // Mark product as recently active
      if (item.product_id) {
        await touchProduct(item.product_id);
      }
    }

    // Mark supplier as recently active if linked
    if (supplier_id) {
      await touchSupplier(supplier_id);
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
      `SELECT * FROM purchases WHERE id = ?`,
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
    const transportFee = Number(req.body?.transport_fee ?? purchase.transport_fee ?? 0) || 0;
    const labourFee = Number(req.body?.labour_fee ?? purchase.labour_fee ?? 0) || 0;
    
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
    const address = purchase.supplier_address || '';
    const description = purchase.description || '';
    const filePath = await generateBill({ type: 'purchase', transaction: billTx, items, adjustment, transport_fee: transportFee, labour_fee: labourFee, address, description });
    res.json({ message: 'Bill generated', path: filePath });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchase = async (req, res, next) => {
  try {
    const { supplier_name, supplier_address, description, payment_method, notes, status, total, items, discount = 0, transport_fee = 0, labour_fee = 0 } = req.body;

    console.log('Updating purchase with payload:', JSON.stringify(req.body, null, 2));

    // ===== STEP 1: Fetch OLD purchase data to reverse effects =====
    const oldPurchase = await db.get('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    
    if (!oldPurchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const oldItems = await db.all(
      'SELECT * FROM purchase_items WHERE purchase_id = ?',
      [req.params.id]
    );

    // ===== STEP 2: Calculate NEW purchase totals =====
    let calculatedTotal = 0;
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const quantity = Number(item.quantity) || 1;
        const cost = (item.cost !== undefined && item.cost !== null) ? Number(item.cost) : 0;
        const itemSubtotal = Math.round(quantity * cost * 100) / 100;
        calculatedTotal = Math.round((calculatedTotal + itemSubtotal) * 100) / 100;
      }
    } else if (total !== undefined && total !== null) {
      calculatedTotal = Math.round(Number(total) * 100) / 100 || 0;
    }

    const discountVal = Math.round((Number(discount) || 0) * 100) / 100;
    const transportVal = Math.round((Number(transport_fee) || 0) * 100) / 100;
    const labourVal = Math.round((Number(labour_fee) || 0) * 100) / 100;
    const finalTotal = req.body.total ? Math.round(Number(req.body.total) * 100) / 100 : calculatedTotal;

    // ===== STEP 3: Begin transaction to ensure atomicity =====
    await db.run('BEGIN TRANSACTION');

    try {
      // ===== STEP 4: Reverse OLD purchase effects =====
      // Note: Currently sales/purchases don't auto-update inventory or supplier balances
      // They only update when explicitly creating supplier_transactions or inventory adjustments
      // This matches the current architecture where transactions and inventory are separated
      // If future implementation adds auto-balance updates, reverse logic would go here

      // ===== STEP 5: Update purchase header with NEW values =====
      await db.run(
        'UPDATE purchases SET supplier_name = ?, supplier_address = ?, description = ?, payment_method = ?, notes = ?, discount = ?, transport_fee = ?, labour_fee = ?, status = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [supplier_name || null, supplier_address || '', description || '', payment_method, notes || '', discountVal, transportVal, labourVal, status || 'completed', finalTotal, req.params.id]
      );

      // ===== STEP 6: Update purchase items (delete old + insert new) =====
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

          // Touch product last activity for updated purchases
          if (productId) {
            await touchProduct(productId);
          }
        }
      }

      // ===== STEP 7: Apply NEW purchase effects =====
      // Note: Currently sales/purchases don't auto-update inventory or supplier balances
      // They only update when explicitly creating supplier_transactions or inventory adjustments
      // This matches the current architecture where transactions and inventory are separated
      // If future implementation adds auto-balance updates, apply logic would go here

      // ===== STEP 8: Commit transaction =====
      await db.run('COMMIT');

      res.json({ message: 'Purchase updated successfully' });
    } catch (error) {
      // Rollback on any error
      await db.run('ROLLBACK');
      throw error;
    }
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
