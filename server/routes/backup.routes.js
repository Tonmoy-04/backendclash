const express = require('express');
const router = express.Router();
const backupManager = require('../utils/backup');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    backupManager.ensureBackupDir();
    cb(null, backupManager.backupDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename or add timestamp
    const timestamp = Date.now();
    const originalName = file.originalname;
    const fileName = `uploaded-${timestamp}-${originalName}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept legacy .db and new .zip backup archives
    if (file.originalname.endsWith('.db') || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .db or .zip files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Get backup location
router.get('/location', (req, res) => {
  res.json({ backupDir: backupManager.backupDir });
});

// Get backup version info
router.get('/version', (req, res) => {
  res.json({ 
    currentVersion: '2.0.0',
    supportedVersions: ['1.0.0', '2.0.0'],
    features: {
      cashbox: true,
      customerTransactions: true,
      supplierTransactions: true,
      stockHistory: true,
      separatedDatabases: true,
      backupMetadata: true,
      backwardCompatibility: true
    }
  });
});

// Get backup file information
router.get('/info/:fileName', async (req, res, next) => {
  try {
    const { fileName } = req.params;
    const backupPath = path.join(backupManager.backupDir, fileName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    const stats = fs.statSync(backupPath);
    let metadata = null;
    let hasMetadata = false;

    // Try to extract metadata from zip files
    if (fileName.toLowerCase().endsWith('.zip')) {
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(backupPath);
        const metadataEntry = zip.getEntry('backup-metadata.json');
        if (metadataEntry) {
          metadata = JSON.parse(metadataEntry.getData().toString('utf8'));
          hasMetadata = true;
        }
      } catch (err) {
        // Ignore
      }
    }

    res.json({
      fileName,
      size: stats.size,
      created: stats.mtime,
      backupVersion: metadata?.backupVersion || '1.0.0',
      hasMetadata,
      features: metadata?.features || {},
      databases: metadata?.databases || {},
      isLegacy: !hasMetadata,
      compatible: true // All backups are compatible due to migration support
    });
  } catch (error) {
    next(error);
  }
});

// Get default backup location
router.get('/location/default', (req, res) => {
  res.json({ defaultBackupDir: backupManager.getDefaultDir() });
});

// Set backup location
router.post('/location', (req, res, next) => {
  try {
    const { backupDir } = req.body;
    const result = backupManager.setBackupDir(backupDir);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reset backup location to default
router.post('/location/reset', (req, res, next) => {
  try {
    const result = backupManager.resetBackupDir();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create a new backup
router.post('/create', async (req, res, next) => {
  try {
    const result = await backupManager.createBackup();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List all backups
router.get('/list', async (req, res, next) => {
  try {
    const backups = backupManager.listBackups();
    res.json(backups);
  } catch (error) {
    next(error);
  }
});

// Download a specific backup
router.get('/download/:fileName', async (req, res, next) => {
  try {
    const { fileName } = req.params;
    const backupPath = path.join(backupManager.backupDir, fileName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(backupPath, fileName);
  } catch (error) {
    next(error);
  }
});

// Restore from backup
router.post('/restore', async (req, res, next) => {
  try {
    const { fileName } = req.body;
    const result = await backupManager.restoreBackup(fileName);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Delete a backup
router.delete('/delete/:fileName', (req, res, next) => {
  try {
    const { fileName } = req.params;
    const result = backupManager.deleteBackup(fileName);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Delete a backup (body-based for clients that cannot send DELETE params)
router.post('/delete', (req, res, next) => {
  try {
    const { fileName } = req.body;
    const result = backupManager.deleteBackup(fileName);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Upload and restore backup
router.post('/upload', upload.single('backup'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFileName = req.file.filename;
    
    // Optionally auto-restore after upload
    const autoRestore = req.body.autoRestore === 'true';
    
    if (autoRestore) {
      await backupManager.restoreBackup(uploadedFileName);
      res.json({ 
        message: 'Backup uploaded and restored successfully',
        fileName: uploadedFileName
      });
    } else {
      res.json({ 
        message: 'Backup uploaded successfully',
        fileName: uploadedFileName
      });
    }
  } catch (error) {
    next(error);
  }
});

// Export database as JSON
router.get('/export-json', async (req, res, next) => {
  try {
    const db = require('../database/db');
    const stockDb = require('../database/stockDb');
    
    // Get all data from inventory database tables
    const products = await stockDb.all('SELECT * FROM products');
    const categories = await stockDb.all('SELECT * FROM categories');
    const stockHistory = await stockDb.all('SELECT * FROM stock_history');
    
    const sales = await db.all('SELECT * FROM sales');
    const saleItems = await db.all('SELECT * FROM sale_items');
    const purchases = await db.all('SELECT * FROM purchases');
    const purchaseItems = await db.all('SELECT * FROM purchase_items');
    const customers = await db.all('SELECT * FROM customers');
    const suppliers = await db.all('SELECT * FROM suppliers');
    const users = await db.all('SELECT * FROM users');
    
    // Get new tables (cashbox and transaction tracking)
    const cashbox = await db.all('SELECT * FROM cashbox');
    const cashboxTransactions = await db.all('SELECT * FROM cashbox_transactions');
    const customerTransactions = await db.all('SELECT * FROM customer_transactions');
    const supplierTransactions = await db.all('SELECT * FROM supplier_transactions');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',  // Updated version to reflect new schema
      backupVersion: '2.0.0',
      features: {
        cashbox: true,
        customerTransactions: true,
        supplierTransactions: true,
        stockHistory: true,
        separatedDatabases: true
      },
      data: {
        // Inventory database tables
        sales,
        saleItems,
        purchases,
        purchaseItems,
        customers,
        suppliers,
        users,
        cashbox,
        cashboxTransactions,
        customerTransactions,
        supplierTransactions,
        // Stock database tables
        products,
        categories,
        stockHistory
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup-${Date.now()}.json`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
