const express = require('express');
const router = express.Router();
const cashboxController = require('../controllers/cashbox.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All routes are protected
router.use(authMiddleware.verifyToken);

// Initialize cashbox (first-time setup)
router.post('/init', cashboxController.initializeCashbox);

// Get current cashbox status
router.get('/', cashboxController.getCashbox);

// Add transaction (deposit or withdrawal)
router.post('/transaction', cashboxController.addTransaction);

// Get transaction history
router.get('/transactions', cashboxController.getTransactions);

// Get transaction summary/statistics
router.get('/summary', cashboxController.getTransactionSummary);

// Reset cashbox (destructive - requires confirmation)
router.post('/reset', cashboxController.resetCashbox);

module.exports = router;
