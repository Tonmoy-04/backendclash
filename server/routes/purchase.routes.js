const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');
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

// Purchase routes
router.get('/', purchaseController.getAllPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);
router.put('/:id', purchaseController.updatePurchase);
router.delete('/:id', purchaseController.deletePurchase);
// Bill generation
router.post('/:id/generate-bill', purchaseController.generatePurchaseBill);

// Supplier purchases
router.get('/supplier/:supplierId', purchaseController.getPurchasesBySupplier);

module.exports = router;
