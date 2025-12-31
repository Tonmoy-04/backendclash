const db = require('../database/db');
const stockDb = require('../database/stockDb');
const { generateBill } = require('../utils/billGenerator');
const { ensureItemTransactionsTable, insertItemTransaction } = require('../utils/itemTransactions');

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
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

exports.createSale = async (req, res, next) => {
  try {
    const { customer_name, items, payment_method = 'due', notes = '' } = req.body;

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
      const quantity = item.quantity || 1;
      const unitPrice = (item.price !== undefined && item.price !== null)
        ? Number(item.price)
        : 0;

      const itemSubtotal = quantity * unitPrice;

      processedItems.push({
        product_name: productName,
        product_id: productId,
        quantity,
        price: unitPrice,
        subtotal: itemSubtotal
      });

      subtotal += itemSubtotal;
    }

    // Use provided date or default to now
    const saleDate = req.body.sale_date || new Date().toISOString();
    // Respect client-entered totals (we derive unit price client-side)
    // No automatic tax so that total matches input
    const tax = 0;
    const discount = req.body.discount || 0;
    const total = req.body.total || (subtotal - discount);

    // Create sale with minimal required data
    const userId = req.user?.id || 1;
    const salesCols = await getSalesColumnSet();
    const hasTotal = salesCols.has('total');
    const hasTotalAmount = salesCols.has('total_amount');

    const fields = ['customer_name', 'payment_method', 'notes', 'subtotal', 'discount', 'tax'];
    const values = [customer_name.trim(), payment_method, notes, subtotal, discount, tax];
    if (hasTotal) {
      fields.push('total');
      values.push(total);
    }
    if (hasTotalAmount) {
      fields.push('total_amount');
      values.push(total);
    }
    fields.push('sale_date', 'user_id');
    values.push(saleDate, userId);

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
    const billTx = {
      id: sale.id,
      date: sale.sale_date || sale.created_at,
      party: sale.customer_name || 'N/A',
      payment_method: sale.payment_method || 'N/A',
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.subtotal, // Use subtotal here so bill generator can apply discount correctly
    };
    const filePath = await generateBill({ type: 'sale', transaction: billTx, items, adjustment });
    res.json({ message: 'Bill generated', path: filePath });
  } catch (error) {
    next(error);
  }
};

exports.updateSale = async (req, res, next) => {
  try {
    const { customer_name, customer_phone, payment_method, notes, total, items } = req.body;

    console.log('Updating sale with payload:', JSON.stringify(req.body, null, 2));

    // Calculate total from items if items array is provided
    let calculatedTotal = 0;
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const quantity = item.quantity || 1;
        const price = (item.price !== undefined && item.price !== null) ? Number(item.price) : 0;
        calculatedTotal += quantity * price;
      }
    } else if (total !== undefined && total !== null) {
      calculatedTotal = Number(total) || 0;
    }

    const finalTotal = req.body.total || calculatedTotal;
    const discount = req.body.discount || 0;
    const tax = 0;

    // Update sale header
    await db.run(
      `UPDATE sales 
       SET customer_name = ?, customer_phone = ?, payment_method = ?, notes = ?, subtotal = ?, discount = ?, tax = ?, total = ?
       WHERE id = ?`,
      [customer_name, customer_phone || null, payment_method, notes || '', calculatedTotal, discount, tax, finalTotal, req.params.id]
    );

    // If items are provided, update them
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
      }
    }

    res.json({ message: 'Sale updated successfully' });
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
