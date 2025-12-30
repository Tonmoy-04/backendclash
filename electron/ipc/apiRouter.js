const { matchRoute, normalizePath } = require('./routeMatcher');
const { invokeExpressHandler } = require('./expressAdapter');

function requireServerModule(distRelPath, srcRelPath) {
  try {
    return require(`../../server/dist/${distRelPath}`);
  } catch {
    return require(`../../server/${srcRelPath}`);
  }
}

// Reuse existing business logic from Express controllers.
const authController = requireServerModule('controllers/auth.controller', 'controllers/auth.controller');
const productController = requireServerModule('controllers/product.controller', 'controllers/product.controller');
const categoryController = requireServerModule('controllers/category.controller', 'controllers/category.controller');
const salesController = requireServerModule('controllers/sales.controller', 'controllers/sales.controller');
const purchaseController = requireServerModule('controllers/purchase.controller', 'controllers/purchase.controller');
const dashboardController = requireServerModule('controllers/dashboard.controller', 'controllers/dashboard.controller');
const customerController = requireServerModule('controllers/customer.controller', 'controllers/customer.controller');
const supplierController = requireServerModule('controllers/supplier.controller', 'controllers/supplier.controller');
const cashboxController = requireServerModule('controllers/cashbox.controller', 'controllers/cashbox.controller');

const authMiddleware = requireServerModule('middlewares/auth.middleware', 'middlewares/auth.middleware');

const backupManager = requireServerModule('utils/backup', 'utils/backup');
const { generateBill } = requireServerModule('utils/billGenerator', 'utils/billGenerator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function makeReq({ method, path, body, query, headers, params, user }) {
  return {
    method,
    url: path,
    params: params || {},
    query: query || {},
    body: body || {},
    headers: headers || {},
    user
  };
}

async function runAuth(mode, req) {
  if (mode === 'none') {
    if (!req.user) req.user = { id: 1, role: 'user' };
    return;
  }

  const token = req.headers?.authorization?.split(' ')[1];

  if (mode === 'optional') {
    if (!token) {
      req.user = { id: 1, role: 'user' };
      return;
    }
  }

  // required or optional-with-token
  const tokenResult = await invokeExpressHandler(authMiddleware.verifyToken, req);
  if (tokenResult.status >= 400) {
    const err = new Error(tokenResult?.data?.error || 'Unauthorized');
    err.status = tokenResult.status;
    err.data = tokenResult.data;
    throw err;
  }

  if (mode === 'admin') {
    const adminResult = await invokeExpressHandler(authMiddleware.isAdmin, req);
    if (adminResult.status >= 400) {
      const err = new Error(adminResult?.data?.error || 'Forbidden');
      err.status = adminResult.status;
      err.data = adminResult.data;
      throw err;
    }
  }

  if (mode === 'manager') {
    const managerResult = await invokeExpressHandler(authMiddleware.isManager, req);
    if (managerResult.status >= 400) {
      const err = new Error(managerResult?.data?.error || 'Forbidden');
      err.status = managerResult.status;
      err.data = managerResult.data;
      throw err;
    }
  }
}

function parseQueryFromPath(rawPath) {
  const idx = rawPath.indexOf('?');
  if (idx < 0) return { pathname: rawPath, query: {} };
  const pathname = rawPath.slice(0, idx);
  const search = rawPath.slice(idx + 1);
  const query = {};
  for (const part of search.split('&')) {
    if (!part) continue;
    const [k, v] = part.split('=');
    const key = decodeURIComponent(k || '');
    if (!key) continue;
    query[key] = decodeURIComponent(v || '');
  }
  return { pathname, query };
}

function validateRequest(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid request');
  const method = String(input.method || 'GET').toUpperCase();
  const path = normalizePath(input.path || '/');
  return { method, path };
}

// Route table in priority order (specific paths before :id matches)
const routes = [
  // Auth
  { method: 'POST', path: '/auth/register', auth: 'none', handler: authController.register },
  { method: 'POST', path: '/auth/login', auth: 'none', handler: authController.login },
  { method: 'POST', path: '/auth/logout', auth: 'none', handler: authController.logout },
  { method: 'GET', path: '/auth/me', auth: 'required', handler: authController.getCurrentUser },
  { method: 'PUT', path: '/auth/change-password', auth: 'required', handler: authController.changePassword },
  { method: 'GET', path: '/auth/users', auth: 'admin', handler: authController.getAllUsers },

  // Products
  { method: 'GET', path: '/products/low-stock', auth: 'optional', handler: productController.getLowStockProducts },
  { method: 'GET', path: '/products/:id/movements', auth: 'optional', handler: productController.getProductMovements },
  { method: 'POST', path: '/products/:id/movements', auth: 'optional', handler: productController.addProductMovement },
  { method: 'POST', path: '/products/:id/adjust-stock', auth: 'optional', handler: productController.adjustStock },
  { method: 'GET', path: '/products/:id/history', auth: 'optional', handler: productController.getStockHistory },
  { method: 'GET', path: '/products/:id', auth: 'optional', handler: productController.getProductById },
  { method: 'GET', path: '/products', auth: 'optional', handler: productController.getAllProducts },
  { method: 'POST', path: '/products', auth: 'optional', handler: productController.createProduct },
  { method: 'PUT', path: '/products/:id', auth: 'optional', handler: productController.updateProduct },
  { method: 'DELETE', path: '/products/:id', auth: 'optional', handler: productController.deleteProduct },

  // Categories
  { method: 'GET', path: '/categories', auth: 'required', handler: categoryController.getAllCategories },
  { method: 'GET', path: '/categories/:id', auth: 'required', handler: categoryController.getCategoryById },
  { method: 'POST', path: '/categories', auth: 'required', handler: categoryController.createCategory },
  { method: 'PUT', path: '/categories/:id', auth: 'required', handler: categoryController.updateCategory },
  { method: 'DELETE', path: '/categories/:id', auth: 'required', handler: categoryController.deleteCategory },

  // Customers
  { method: 'GET', path: '/customers', auth: 'required', handler: customerController.getAllCustomers },
  { method: 'POST', path: '/customers', auth: 'required', handler: customerController.createCustomer },
  { method: 'POST', path: '/customers/:id/balance', auth: 'required', handler: customerController.updateCustomerBalance },
  { method: 'GET', path: '/customers/:id/transactions', auth: 'required', handler: customerController.getCustomerTransactions },
  { method: 'GET', path: '/customers/:id/ledger', auth: 'required', handler: customerController.getCustomerLedger },
  { method: 'GET', path: '/customers/:id', auth: 'required', handler: customerController.getCustomerById },
  { method: 'PUT', path: '/customers/:id', auth: 'required', handler: customerController.updateCustomer },
  { method: 'DELETE', path: '/customers/:id', auth: 'required', handler: customerController.deleteCustomer },

  // Suppliers
  { method: 'GET', path: '/suppliers', auth: 'optional', handler: supplierController.getAllSuppliers },
  { method: 'POST', path: '/suppliers', auth: 'optional', handler: supplierController.createSupplier },
  { method: 'POST', path: '/suppliers/:id/balance', auth: 'optional', handler: supplierController.updateSupplierBalance },
  { method: 'GET', path: '/suppliers/:id/transactions', auth: 'optional', handler: supplierController.getSupplierTransactions },
  { method: 'GET', path: '/suppliers/:id/ledger', auth: 'optional', handler: supplierController.getSupplierLedger },
  { method: 'GET', path: '/suppliers/:id', auth: 'optional', handler: supplierController.getSupplierById },
  { method: 'PUT', path: '/suppliers/:id', auth: 'optional', handler: supplierController.updateSupplier },
  { method: 'DELETE', path: '/suppliers/:id', auth: 'optional', handler: supplierController.deleteSupplier },

  // Sales reports (must come before /sales/:id)
  { method: 'GET', path: '/sales/reports/daily', auth: 'optional', handler: salesController.getDailySalesReport },
  { method: 'GET', path: '/sales/reports/monthly', auth: 'optional', handler: salesController.getMonthlySalesReport },
  { method: 'GET', path: '/sales/reports/custom', auth: 'optional', handler: salesController.getCustomRangeReport },

  // Sales
  { method: 'GET', path: '/sales', auth: 'optional', handler: salesController.getAllSales },
  { method: 'POST', path: '/sales', auth: 'optional', handler: salesController.createSale },
  { method: 'GET', path: '/sales/:id', auth: 'optional', handler: salesController.getSaleById },
  { method: 'PUT', path: '/sales/:id', auth: 'optional', handler: salesController.updateSale },
  { method: 'DELETE', path: '/sales/:id', auth: 'optional', handler: salesController.deleteSale },
  { method: 'POST', path: '/sales/:id/generate-bill', auth: 'optional', handler: salesController.generateSaleBill },

  // Purchases supplier route before /:id
  { method: 'GET', path: '/purchases/supplier/:supplierId', auth: 'optional', handler: purchaseController.getPurchasesBySupplier },

  // Purchases
  { method: 'GET', path: '/purchases', auth: 'optional', handler: purchaseController.getAllPurchases },
  { method: 'POST', path: '/purchases', auth: 'optional', handler: purchaseController.createPurchase },
  { method: 'GET', path: '/purchases/:id', auth: 'optional', handler: purchaseController.getPurchaseById },
  { method: 'PUT', path: '/purchases/:id', auth: 'optional', handler: purchaseController.updatePurchase },
  { method: 'DELETE', path: '/purchases/:id', auth: 'optional', handler: purchaseController.deletePurchase },
  { method: 'POST', path: '/purchases/:id/generate-bill', auth: 'optional', handler: purchaseController.generatePurchaseBill },

  // Dashboard
  { method: 'GET', path: '/dashboard/stats', auth: 'required', handler: dashboardController.getDashboardStats },
  { method: 'GET', path: '/dashboard/recent-sales', auth: 'required', handler: dashboardController.getRecentSales },
  { method: 'GET', path: '/dashboard/top-products', auth: 'required', handler: dashboardController.getTopProducts },
  { method: 'GET', path: '/dashboard/sales-chart', auth: 'required', handler: dashboardController.getSalesChartData },
  { method: 'GET', path: '/dashboard/low-stock-alerts', auth: 'required', handler: dashboardController.getLowStockAlerts },
  { method: 'GET', path: '/dashboard/customers-debt', auth: 'required', handler: dashboardController.getCustomersDebt },
  { method: 'GET', path: '/dashboard/suppliers-debt', auth: 'required', handler: dashboardController.getSuppliersDebt },

  // Cashbox
  { method: 'POST', path: '/cashbox/init', auth: 'required', handler: cashboxController.initializeCashbox },
  { method: 'GET', path: '/cashbox', auth: 'required', handler: cashboxController.getCashbox },
  { method: 'POST', path: '/cashbox/transaction', auth: 'required', handler: cashboxController.addTransaction },
  { method: 'GET', path: '/cashbox/transactions', auth: 'required', handler: cashboxController.getTransactions },
  { method: 'GET', path: '/cashbox/summary', auth: 'required', handler: cashboxController.getTransactionSummary },

  // Backup
  { method: 'GET', path: '/backup/location', auth: 'optional', handler: async (req, res) => res.json({ backupDir: backupManager.backupDir }) },
  { method: 'GET', path: '/backup/location/default', auth: 'optional', handler: async (req, res) => res.json({ defaultBackupDir: backupManager.getDefaultDir() }) },
  { method: 'POST', path: '/backup/location', auth: 'optional', handler: async (req, res) => res.json(backupManager.setBackupDir(req.body?.backupDir)) },
  { method: 'POST', path: '/backup/location/reset', auth: 'optional', handler: async (req, res) => res.json(backupManager.resetBackupDir()) },
  { method: 'POST', path: '/backup/create', auth: 'optional', handler: async (req, res) => res.json(await backupManager.createBackup()) },
  { method: 'GET', path: '/backup/list', auth: 'optional', handler: async (req, res) => res.json(backupManager.listBackups()) },
  { method: 'POST', path: '/backup/restore', auth: 'optional', handler: async (req, res) => res.json(await backupManager.restoreBackup(req.body?.fileName)) },
  { method: 'POST', path: '/backup/delete', auth: 'optional', handler: async (req, res) => res.json(backupManager.deleteBackup(req.body?.fileName)) },

  // Bill
  { method: 'POST', path: '/bill/temporary', auth: 'optional', handler: async (req, res) => {
      const { party = 'N/A', date, payment_method = 'N/A', items = [], currencySymbol, adjustment = 0 } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }
      const normalized = items.map((it) => {
        const name = it?.product_name ?? it?.name ?? 'Item';
        const qty = Number(it?.quantity) || 0;
        const unit = Number(it?.price ?? it?.cost ?? 0) || 0;
        const subtotal = Number(it?.subtotal);
        const calcSub = Number.isFinite(subtotal) ? subtotal : unit * qty;
        return { product_name: String(name), quantity: qty, price: unit, subtotal: calcSub };
      });
      const subtotal = normalized.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
      const tax = 0;
      const total = subtotal + tax;
      const transaction = { id: 0, date: date || new Date().toISOString(), party, payment_method, subtotal, tax, total };
      const filePath = await generateBill({ type: 'sale', transaction, items: normalized, currencySymbol, adjustment });
      return res.json({ message: 'Temporary bill generated', path: filePath });
    }
  },
  { method: 'POST', path: '/bill/open', auth: 'optional', handler: async (req, res) => {
      const filePath = req.body?.path;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'Valid file path is required' });
      }
      const homeBillsDir = path.join(os.homedir(), 'Documents', 'InventoryApp', 'Bills');
      const normalized = path.normalize(filePath);
      const isWithinBills = normalized.startsWith(path.normalize(homeBillsDir));
      const isPdf = normalized.toLowerCase().endsWith('.pdf');
      if (!isWithinBills || !isPdf || !fs.existsSync(normalized)) {
        return res.status(400).json({ error: 'File path is not a valid bill PDF' });
      }
      spawn('cmd', ['/c', 'start', '', normalized], { detached: true, stdio: 'ignore' });
      return res.json({ message: 'Opening bill', path: normalized });
    }
  }
];

async function handleApiRequest(input) {
  const { method, path } = validateRequest(input);
  const parsed = parseQueryFromPath(path);
  const pathname = normalizePath(parsed.pathname);
  const query = { ...(parsed.query || {}), ...(input.query || {}) };

  const headers = input.headers || {};
  const body = input.data ?? input.body ?? {};

  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchRoute(route.path, pathname);
    if (!params) continue;

    const req = makeReq({ method, path: pathname, body, query, headers, params });

    try {
      await runAuth(route.auth || 'none', req);
      const result = await invokeExpressHandler(route.handler, req);
      return result;
    } catch (err) {
      const status = err?.statusCode || err?.status || 500;
      const message = err?.message || 'Internal error';
      // Never return Error objects over IPC (they serialize poorly).
      // Preserve {status,data} shape when auth/controller logic provided it.
      if (status >= 400 && typeof err === 'object' && err !== null && 'data' in err) {
        return { status, data: err.data };
      }
      return { status, data: { error: message } };
    }
  }

  return { status: 404, data: { error: `No IPC route for ${method} ${pathname}` } };
}

module.exports = {
  handleApiRequest
};
