const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
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

// Product routes
router.get('/', productController.getAllProducts);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/:id/movements', productController.getProductMovements);
router.get('/:id', productController.getProductById);
router.post('/:id/movements', productController.addProductMovement);
router.put('/:id/movements/:movementId', productController.updateProductMovement);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

// Stock management
router.post('/:id/adjust-stock', productController.adjustStock);
router.get('/:id/history', productController.getStockHistory);

module.exports = router;
