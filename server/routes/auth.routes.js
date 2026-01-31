const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
router.get('/verify-token', authMiddleware.verifyToken, authController.verifyToken);
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);
router.put('/change-password', authMiddleware.verifyToken, authController.changePassword);
router.get('/users', authMiddleware.verifyToken, authMiddleware.isAdmin, authController.getAllUsers);

module.exports = router;
