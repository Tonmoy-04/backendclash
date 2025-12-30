const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
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

// GET all suppliers
router.get('/', supplierController.getAllSuppliers);

// UPDATE supplier balance (add payment or charge) - MUST come before /:id routes
router.post('/:id/balance', supplierController.updateSupplierBalance);

// GET supplier transaction history
router.get('/:id/transactions', supplierController.getSupplierTransactions);

// GET supplier daily ledger (date, deposit, spend, balance, status)
router.get('/:id/ledger', supplierController.getSupplierLedger);

// GET supplier by ID
router.get('/:id', supplierController.getSupplierById);

// CREATE new supplier
router.post('/', supplierController.createSupplier);

// UPDATE supplier
router.put('/:id', supplierController.updateSupplier);

// DELETE supplier
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;
