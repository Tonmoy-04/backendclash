const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All routes are protected
router.use(authMiddleware.verifyToken);

// Dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);
router.get('/recent-sales', dashboardController.getRecentSales);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/sales-chart', dashboardController.getSalesChartData);
router.get('/low-stock-alerts', dashboardController.getLowStockAlerts);
router.get('/customers-debt', dashboardController.getCustomersDebt);
router.get('/suppliers-debt', dashboardController.getSuppliersDebt);

module.exports = router;
