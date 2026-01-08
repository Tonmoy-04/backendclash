const invDb = require('../database/db');
const stockDb = require('../database/stockDb');

// Centralized helpers to mark records as recently active
async function touchCustomer(customerId) {
  if (!customerId) return;
  try {
    await invDb.run("UPDATE customers SET updated_at = datetime('now') WHERE id = ?", [customerId]);
  } catch (e) {
    // best-effort; ignore errors to avoid breaking main flow
  }
}

async function touchSupplier(supplierId) {
  if (!supplierId) return;
  try {
    await invDb.run("UPDATE suppliers SET updated_at = datetime('now') WHERE id = ?", [supplierId]);
  } catch (e) {
    // best-effort
  }
}

async function touchProduct(productId) {
  if (!productId) return;
  try {
    await stockDb.run('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [productId]);
  } catch (e) {
    // best-effort
  }
}

module.exports = { touchCustomer, touchSupplier, touchProduct };
