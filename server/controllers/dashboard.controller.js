const db = require('../database/db');
const stockDb = require('../database/stockDb');

exports.getDashboardStats = async (req, res, next) => {
  try {
    // Total products (exclude transaction-created AUTO-*-* placeholders)
    const totalProducts = await stockDb.get(
      `SELECT COUNT(*) as count 
       FROM products 
       WHERE name NOT LIKE 'Transaction-%'`
    );
    
    // Low stock count (exclude transaction placeholders)
    const lowStock = await stockDb.get(
      `SELECT COUNT(*) as count 
       FROM products 
       WHERE quantity <= min_stock 
         AND name NOT LIKE 'Transaction-%'`
    );
    
    // Today's sales
    const todaySales = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
       FROM sales 
       WHERE DATE(sale_date) = DATE('now')
         AND (payment_method IS NULL OR payment_method != 'due')`
    );
    
    // This month's sales
    const monthSales = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
       FROM sales 
       WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')
         AND (payment_method IS NULL OR payment_method != 'due')`
    );
    
    // Total revenue (all time)
    const totalRevenue = await db.get(
      `SELECT COALESCE(SUM(total), 0) as total 
       FROM sales 
       WHERE (payment_method IS NULL OR payment_method != 'due')`
    );
    
    // Total inventory value (exclude transaction placeholders)
    const inventoryValue = await stockDb.get(
      `SELECT COALESCE(SUM(price * quantity), 0) as value 
       FROM products 
       WHERE name NOT LIKE 'Transaction-%'`
    );

    res.json({
      totalProducts: totalProducts.count,
      lowStockCount: lowStock.count,
      todaySales: {
        count: todaySales.count,
        total: todaySales.total
      },
      monthSales: {
        count: monthSales.count,
        total: monthSales.total
      },
      totalRevenue: totalRevenue.total,
      inventoryValue: inventoryValue.value
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecentSales = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const sales = await db.all(
      `SELECT s.*, u.username 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       ORDER BY s.created_at DESC 
       LIMIT ?`,
      [limit]
    );
    res.json(sales);
  } catch (error) {
    next(error);
  }
};

exports.getTopProducts = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const products = await db.all(
      `SELECT p.name, SUM(si.quantity) as total_sold, SUM(si.subtotal) as revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       JOIN sales s ON si.sale_id = s.id
       WHERE s.sale_date >= DATE('now', '-30 days')
       GROUP BY si.product_id
       ORDER BY total_sold DESC
       LIMIT ?`,
      [limit]
    );
    res.json(products);
  } catch (error) {
    next(error);
  }
};

exports.getSalesChartData = async (req, res, next) => {
  try {
    const days = req.query.days || 30;
    const chartData = await db.all(
      `SELECT DATE(sale_date) as date, 
              COUNT(*) as sales_count, 
              SUM(total) as total_sales 
       FROM sales 
       WHERE sale_date >= DATE('now', '-' || ? || ' days')
         AND (payment_method IS NULL OR payment_method != 'due')
       GROUP BY DATE(sale_date) 
       ORDER BY date ASC`,
      [days]
    );
    res.json(chartData);
  } catch (error) {
    next(error);
  }
};

exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const products = await stockDb.all(
      `SELECT * FROM products 
       WHERE quantity <= min_stock 
         AND name NOT LIKE 'Transaction-%'
       ORDER BY quantity ASC 
       LIMIT 20`
    );
    res.json(products);
  } catch (error) {
    next(error);
  }
};

exports.getCustomersDebt = async (req, res, next) => {
  try {
    // Total amount owed to/by customers (positive = they owe us, negative = we owe them/advance)
    const result = await db.get(
      `SELECT COALESCE(SUM(balance), 0) as total_debt 
       FROM customers`
    );
    res.json({ totalCustomersDebt: result.total_debt || 0 });
  } catch (error) {
    next(error);
  }
};

exports.getSuppliersDebt = async (req, res, next) => {
  try {
    // Total amount owed to/by suppliers (positive = we owe them, negative = they owe us/advance)
    const result = await db.get(
      `SELECT COALESCE(SUM(balance), 0) as total_debt 
       FROM suppliers`
    );
    res.json({ totalSuppliersDebt: result.total_debt || 0 });
  } catch (error) {
    // Backward compatibility for older DBs that don't have suppliers.balance.
    const msg = String(error?.message || error);
    if (msg.includes('no such column: balance')) {
      return res.json({ totalSuppliersDebt: 0 });
    }
    next(error);
  }
};
