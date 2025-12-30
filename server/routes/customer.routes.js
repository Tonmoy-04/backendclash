const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// GET all customers
router.get('/', customerController.getAllCustomers);

// UPDATE customer balance (add payment or charge) - MUST come before /:id routes
router.post('/:id/balance', customerController.updateCustomerBalance);

// GET customer transaction history
router.get('/:id/transactions', customerController.getCustomerTransactions);

// GET customer daily ledger (date, deposit, spend, balance, status)
router.get('/:id/ledger', customerController.getCustomerLedger);

// GET customer by ID
router.get('/:id', customerController.getCustomerById);

// CREATE new customer
router.post('/', customerController.createCustomer);

// UPDATE customer
router.put('/:id', customerController.updateCustomer);

// DELETE customer
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
