const db = require('../database/db');
const stockDb = require('../database/stockDb');
const { generateBill } = require('../utils/billGenerator');
const { ensureItemTransactionsTable, insertItemTransaction } = require('../utils/itemTransactions');
const { touchProduct, touchCustomer } = require('../utils/activity');
const { parseDDMMYYYY } = require('../utils/dateConverter');

async function getSalesColumnSet() {
  try {
    const cols = await db.all("PRAGMA table_info('sales')");
    return new Set((cols || []).map(c => c.name));
  } catch {
    return new Set();
  }
}

exports.getAllSales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT s.*, 
             json_group_array(
               json_object(
                 'product_id', si.product_id,
                 'product_name', si.product_name,
                 'quantity', si.quantity,
                 'price', si.price,
                 'subtotal', si.subtotal
               )
             ) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND DATE(s.sale_date) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(s.sale_date) <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY s.id ORDER BY s.sale_date DESC, s.created_at DESC';
    
    const sales = await db.all(query, params) || [];
    
    // Parse JSON items with error handling
    sales.forEach(sale => {
      try {
        sale.items = sale.items ? JSON.parse(sale.items) : [];
      } catch (err) {
        console.warn(`Failed to parse items for sale ${sale.id}:`, err.message);
        sale.items = [];
      }
      
      // Sanitize sale_date to ensure it's in ISO format
      if (sale.sale_date) {
        try {
          const dateObj = new Date(sale.sale_date);
          if (isNaN(dateObj.getTime())) {
            console.warn(`[getAllSales] Invalid sale_date for sale ${sale.id}:`, sale.sale_date);
            sale.sale_date = new Date().toISOString(); // Fallback to now
          } else {
            // Ensure it's in ISO format
            sale.sale_date = dateObj.toISOString();
          }
        } catch (err) {
          console.warn(`[getAllSales] Error parsing sale_date for sale ${sale.id}:`, err.message);
          sale.sale_date = new Date().toISOString();
        }
      }
    });

    res.json(sales);
  } catch (error) {
    next(error);
  }
};

exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const items = await db.all(
      `SELECT si.*, COALESCE(si.product_name, '') as product_name 
       FROM sale_items si 
       WHERE si.sale_id = ?`,
      [req.params.id]
    );

    sale.items = items;
    
    // Sanitize sale_date to ensure it's in ISO format
    if (sale.sale_date) {
      try {
        const dateObj = new Date(sale.sale_date);
        if (isNaN(dateObj.getTime())) {
          console.warn(`[getSaleById] Invalid sale_date for sale ${sale.id}:`, sale.sale_date);
          sale.sale_date = new Date().toISOString();
        } else {
          sale.sale_date = dateObj.toISOString();
        }
      } catch (err) {
        console.warn(`[getSaleById] Error parsing sale_date:`, err.message);
        sale.sale_date = new Date().toISOString();
      }
    }
    
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

exports.createSale = async (req, res, next) => {
  try {
    const { customer_name, customer_address, description, items, payment_method = 'due', notes = '', discount = 0, transport_fee = 0, labour_fee = 0 } = req.body;

    console.log('Creating sale with payload:', JSON.stringify(req.body, null, 2));

    // Only customer_name and items are required
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Process items - quantity defaults to 1, price is optional
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      console.log('Processing item:', JSON.stringify(item, null, 2));
      const productId = item.product_id || null;
      const productName = item.product_name && item.product_name.trim() ? item.product_name.trim() : null;
      const quantity = Number(item.quantity) || 1;
      const unitPrice = (item.price !== undefined && item.price !== null)
        ? Number(item.price)
        : 0;

      // Calculate item subtotal with precision rounding
      const itemSubtotal = Math.round(quantity * unitPrice * 100) / 100;

      processedItems.push({
        product_name: productName,
        product_id: productId,
        quantity,
        price: unitPrice,
        subtotal: itemSubtotal
      });

      subtotal = Math.round((subtotal + itemSubtotal) * 100) / 100;
    }

    // Parse and validate sale date - NO FALLBACKS
    console.log('[Sales Controller] Incoming sale_date:', req.body.sale_date);
    console.log('[Sales Controller] sale_date type:', typeof req.body.sale_date);
    
    if (!req.body.sale_date) {
      return res.status(400).json({ 
        error: 'sale_date is required', 
        details: 'Please provide a valid date in dd/mm/yyyy format' 
      });
    }
    
    const saleDate = parseDDMMYYYY(req.body.sale_date);
    console.log('[Sales Controller] Parsed date:', saleDate);
    console.log('[Sales Controller] Is valid date?', saleDate instanceof Date && !isNaN(saleDate.getTime()));
    
    if (!saleDate || isNaN(saleDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid sale_date format', 
        details: 'Expected dd/mm/yyyy format. Received: ' + req.body.sale_date,
        received: req.body.sale_date
      });
    }
    
    console.log('[Sales Controller] Final ISO date to store:', saleDate.toISOString());
    // Respect client-entered totals (we derive unit price client-side)
    // No automatic tax so that total matches input
    const tax = 0;
    const discountVal = Math.round((Number(discount) || 0) * 100) / 100;
    const transportVal = Math.round((Number(transport_fee) || 0) * 100) / 100;
    const labourVal = Math.round((Number(labour_fee) || 0) * 100) / 100;
    const total = Math.round((req.body.total || (subtotal - discountVal) + transportVal + labourVal) * 100) / 100;

    // Create sale with minimal required data
    const userId = req.user?.id || 1;
    const salesCols = await getSalesColumnSet();
    const hasTotal = salesCols.has('total');
    const hasTotalAmount = salesCols.has('total_amount');

    const fields = ['customer_name', 'customer_address', 'description', 'payment_method', 'notes', 'subtotal', 'discount', 'tax', 'transport_fee', 'labour_fee'];
    const values = [customer_name.trim(), customer_address || '', description || '', payment_method, notes, subtotal, discountVal, tax, transportVal, labourVal];
    if (hasTotal) {
      fields.push('total');
      values.push(total);
    }
    if (hasTotalAmount) {
      fields.push('total_amount');
      values.push(total);
    }
    fields.push('sale_date', 'user_id');
    values.push(saleDate.toISOString(), userId);

    const placeholders = fields.map(() => '?').join(', ');
    const saleResult = await db.run(
      `INSERT INTO sales (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const saleId = saleResult.lastID;

    await ensureItemTransactionsTable();

    // Create sale items and decrement stock (allow negative stock)
    for (const item of processedItems) {
      const quantity = item.quantity || 0;
      const unitPrice = item.price || 0;
      const subtotalItem = item.subtotal || 0;
      
      // Persist sale item (in inventory.db)
      await db.run(
        'INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, subtotal, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.product_id || null, item.product_name || null, quantity, unitPrice, subtotalItem, subtotalItem, unitPrice]
      );

      // Stock updates disabled - transactions and inventory are completely separated
      // Mark product as recently active
      if (item.product_id) {
        await touchProduct(item.product_id);
      }
    }

    // If a customer_id is ever provided, mark it as active (non-breaking, optional)
    if (req.body?.customer_id) {
      await touchCustomer(req.body.customer_id);
    }

    // Note: Bill generation is now manual via the bill generator endpoint

    res.status(201).json({ 
      message: 'Sale created successfully', 
      saleId,
      total 
    });
  } catch (error) {
    next(error);
  }
};

// Generate bill for a specific sale
exports.generateSaleBill = async (req, res, next) => {
  try {
    const id = req.params.id;
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = await db.all(
      `SELECT si.quantity, si.price, si.subtotal, 
              COALESCE(si.product_name, 'N/A') as product_name
       FROM sale_items si
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`,
      [id]
    );
    const adjustment = Number(req.body?.adjustment ?? req.query?.adjustment ?? sale.discount ?? 0) || 0;
    const transportFee = Number(req.body?.transport_fee ?? sale.transport_fee ?? 0) || 0;
    const labourFee = Number(req.body?.labour_fee ?? sale.labour_fee ?? 0) || 0;
    const billTx = {
      id: sale.id,
      date: sale.sale_date || sale.created_at,
      party: sale.customer_name || 'N/A',
      payment_method: sale.payment_method || 'N/A',
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.subtotal, // Use subtotal here so bill generator can apply discount correctly
    };
    const address = sale.customer_address || '';
    const description = sale.description || '';
    const filePath = await generateBill({ type: 'sale', transaction: billTx, items, adjustment, transport_fee: transportFee, labour_fee: labourFee, address, description });
    res.json({ message: 'Bill generated', path: filePath });
  } catch (error) {
    next(error);
  }
};

exports.updateSale = async (req, res, next) => {
  try {
    const { customer_name, customer_phone, customer_address, description, payment_method, notes, total, items, discount = 0, transport_fee = 0, labour_fee = 0 } = req.body;

    console.log('Updating sale with payload:', JSON.stringify(req.body, null, 2));

    // ===== STEP 1: Fetch OLD sale data to reverse effects =====
    const oldSale = await db.get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    
    if (!oldSale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const oldItems = await db.all(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [req.params.id]
    );

    // ===== STEP 2: Calculate NEW sale totals =====
    let calculatedTotal = 0;
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const quantity = Number(item.quantity) || 1;
        const price = (item.price !== undefined && item.price !== null) ? Number(item.price) : 0;
        const itemSubtotal = Math.round(quantity * price * 100) / 100;
        calculatedTotal = Math.round((calculatedTotal + itemSubtotal) * 100) / 100;
      }
    } else if (total !== undefined && total !== null) {
      calculatedTotal = Math.round(Number(total) * 100) / 100 || 0;
    }

    const finalTotal = req.body.total ? Math.round(Number(req.body.total) * 100) / 100 : calculatedTotal;
    const discountVal = Math.round((Number(discount) || 0) * 100) / 100;
    const transportVal = Math.round((Number(transport_fee) || 0) * 100) / 100;
    const labourVal = Math.round((Number(labour_fee) || 0) * 100) / 100;
    const tax = 0;

    // ===== STEP 3: Begin transaction to ensure atomicity =====
    await db.run('BEGIN TRANSACTION');

    try {
      // ===== STEP 4: Reverse OLD sale effects =====
      // Note: Currently sales/purchases don't auto-update inventory or customer balances
      // They only update when explicitly creating customer_transactions or inventory adjustments
      // This matches the current architecture where transactions and inventory are separated
      // If future implementation adds auto-balance updates, reverse logic would go here

      // ===== STEP 5: Update sale header with NEW values =====
      // Update both `total` and `total_amount` for legacy compatibility
      const salesCols = await getSalesColumnSet();
      const hasTotal = salesCols.has('total');
      const hasTotalAmount = salesCols.has('total_amount');

      let updateQuery = `UPDATE sales 
         SET customer_name = ?, customer_phone = ?, customer_address = ?, description = ?, payment_method = ?, notes = ?, subtotal = ?, discount = ?, tax = ?, transport_fee = ?, labour_fee = ?`;
      let updateParams = [customer_name, customer_phone || null, customer_address || '', description || '', payment_method, notes || '', calculatedTotal, discountVal, tax, transportVal, labourVal];
      
      if (hasTotal) {
        updateQuery += `, total = ?`;
        updateParams.push(finalTotal);
      }
      if (hasTotalAmount) {
        updateQuery += `, total_amount = ?`;
        updateParams.push(finalTotal);
      }
      
      updateQuery += `, updated_at = datetime('now') WHERE id = ?`;
      updateParams.push(req.params.id);

      await db.run(updateQuery, updateParams);

      // ===== STEP 6: Update sale items (delete old + insert new) =====
      if (items && Array.isArray(items) && items.length > 0) {
        // Delete existing sale items
        await db.run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);

        // Insert new items
        for (const item of items) {
          const productId = item.product_id || null;
          const productName = item.product_name && item.product_name.trim() ? item.product_name.trim() : null;
          const quantity = item.quantity || 1;
          const unitPrice = (item.price !== undefined && item.price !== null) ? Number(item.price) : 0;
          const itemSubtotal = quantity * unitPrice;

          await db.run(
            `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal, unit_price, total_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, productId, productName, quantity, unitPrice, itemSubtotal, unitPrice, itemSubtotal]
          );

          // Touch product last activity for updated sales
          if (productId) {
            await touchProduct(productId);
          }
        }
      }

      // ===== STEP 7: Apply NEW sale effects =====
      // Note: Currently sales/purchases don't auto-update inventory or customer balances
      // They only update when explicitly creating customer_transactions or inventory adjustments
      // This matches the current architecture where transactions and inventory are separated
      // If future implementation adds auto-balance updates, apply logic would go here

      // ===== STEP 8: Commit transaction =====
      await db.run('COMMIT');

      res.json({ message: 'Sale updated successfully' });
    } catch (error) {
      // Rollback on any error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating sale:', error);
    next(error);
  }
};

exports.deleteSale = async (req, res, next) => {
  try {
    // Delete sale items
    await db.run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);

    // Delete sale
    await db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);

    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getDailySalesReport = async (req, res, next) => {
  try {
    const report = await db.all(
      `SELECT DATE(sale_date) as date, 
              COUNT(*) as sales_count, 
              COALESCE(SUM(total), 0) as total_sales 
       FROM sales 
       WHERE sale_date >= DATE('now', '-30 days') 
       GROUP BY DATE(sale_date) 
       ORDER BY date DESC`
    );
    res.json(report || []);
  } catch (error) {
    next(error);
  }
};

exports.getMonthlySalesReport = async (req, res, next) => {
  try {
    const report = await db.all(
      `SELECT strftime('%Y-%m', sale_date) as month, 
              COUNT(*) as sales_count, 
              COALESCE(SUM(total), 0) as total_sales 
       FROM sales 
       WHERE sale_date >= DATE('now', '-12 months') 
       GROUP BY strftime('%Y-%m', sale_date) 
       ORDER BY month DESC`
    );
    res.json(report || []);
  } catch (error) {
    next(error);
  }
};

exports.getCustomRangeReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const report = await db.get(
      `SELECT COUNT(*) as sales_count, 
              COALESCE(SUM(total), 0) as total_sales,
              COALESCE(SUM(subtotal), 0) as total_subtotal,
              COALESCE(SUM(tax), 0) as total_tax
       FROM sales 
       WHERE sale_date BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    res.json(report || { sales_count: 0, total_sales: 0, total_subtotal: 0, total_tax: 0 });
  } catch (error) {
    next(error);
  }
};
