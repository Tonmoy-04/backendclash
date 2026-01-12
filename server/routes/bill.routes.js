const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { generateBill } = require('../utils/billGenerator');

// Generate a temporary bill without touching the database
router.post('/temporary', async (req, res, next) => {
  try {
    const { party = 'N/A', date, payment_method = 'N/A', items = [], currencySymbol, adjustment = 0, transport_fee = 0, labour_fee = 0, address = '', description = '' } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Normalize items
    const normalized = items.map((it) => {
      const name = it?.product_name ?? it?.name ?? 'Item';
      const qty = Number(it?.quantity) || 0;
      const unit = Number(it?.price ?? it?.cost ?? 0) || 0;
      const subtotal = Number(it?.subtotal);
      const calcSub = Number.isFinite(subtotal) ? subtotal : unit * qty;
      return {
        product_name: String(name),
        quantity: qty,
        price: unit,
        subtotal: calcSub
      };
    });

    const subtotal = normalized.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    const tax = 0;
    const total = subtotal + tax;

    const transaction = {
      id: 0, // Temporary id
      date: date || new Date().toISOString(),
      party,
      payment_method,
      subtotal,
      tax,
      total
    };

    const filePath = await generateBill({ type: 'sale', transaction, items: normalized, currencySymbol, adjustment, transport_fee: Number(transport_fee) || 0, labour_fee: Number(labour_fee) || 0, address, description });
    return res.json({ message: 'Temporary bill generated', path: filePath });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// Open an existing bill PDF in the system viewer (Windows)
router.post('/open', async (req, res, next) => {
  try {
    const filePath = req.body?.path;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Valid file path is required' });
    }

    // Basic validation: must point to a PDF under user's Documents/InventoryApp/Bills
    const homeBillsDir = path.join(require('os').homedir(), 'Documents', 'InventoryApp', 'Bills');
    const normalized = path.normalize(filePath);
    const isWithinBills = normalized.startsWith(path.normalize(homeBillsDir));
    const isPdf = normalized.toLowerCase().endsWith('.pdf');

    if (!isWithinBills || !isPdf || !fs.existsSync(normalized)) {
      return res.status(400).json({ error: 'File path is not a valid bill PDF' });
    }

    // Use Windows 'start' to open with default viewer
    spawn('cmd', ['/c', 'start', '', normalized], { detached: true, stdio: 'ignore' });
    return res.json({ message: 'Opening bill', path: normalized });
  } catch (error) {
    next(error);
  }
});
