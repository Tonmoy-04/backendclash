const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Auth middleware - optional for now to allow testing
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    authMiddleware.verifyToken(req, res, next);
  } else {
    req.user = { id: 1, role: 'user' }; // Default user
    next();
  }
};

router.use(optionalAuth);

// Sales routes
router.get('/', salesController.getAllSales);
router.get('/:id', salesController.getSaleById);
router.post('/', salesController.createSale);
router.put('/:id', salesController.updateSale);
router.delete('/:id', salesController.deleteSale);
// Bill generation
router.post('/:id/generate-bill', salesController.generateSaleBill);

// Sales reports
router.get('/reports/daily', salesController.getDailySalesReport);
router.get('/reports/monthly', salesController.getMonthlySalesReport);
router.get('/reports/custom', salesController.getCustomRangeReport);

module.exports = router;
