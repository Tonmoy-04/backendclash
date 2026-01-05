const db = require('../database/db');

exports.getAllSuppliers = async (req, res, next) => {
  try {
    const { filter } = req.query;
    
    let query = 'SELECT * FROM suppliers';
    const conditions = [];
    
    // Apply balance filter
    if (filter === 'debt') {
      conditions.push('balance > 0');
    } else if (filter === 'owe') {
      conditions.push('balance < 0');
    } else if (filter === 'clear') {
      conditions.push('balance = 0');
    }
    // filter === 'all' or undefined shows all suppliers
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const suppliers = await db.all(query);
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
};

exports.getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await db.get(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const { name, contact_person, phone, email, address, previous_due } = req.body;
    
    if (!contact_person) {
      return res.status(400).json({ error: 'Contact person is required' });
    }

    // Use previous_due as initial balance, default to 0
    const initialBalance = previous_due ? parseFloat(previous_due) : 0;

    const result = await db.run(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [name || null, contact_person, phone || null, email || null, address || null, initialBalance]
    );

    const supplierId = result.lastID;

    // If previous_due is provided, record it as an initial transaction
    if (initialBalance !== 0) {
      const absAmount = Math.abs(initialBalance);
      const transactionType = initialBalance > 0 ? 'charge' : 'payment';
      const description = initialBalance > 0 ? 'Initial Due' : 'Initial Credit';
      
      await db.run(
        `INSERT INTO supplier_transactions (supplier_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [supplierId, transactionType, absAmount, 0, initialBalance, description, new Date().toISOString().split('T')[0]]
      );
    }

    res.status(201).json({
      id: supplierId,
      name,
      contact_person,
      phone,
      email,
      address,
      balance: initialBalance,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address } = req.body;

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Require contact_person instead of name
    if (!contact_person) {
      return res.status(400).json({ error: 'Contact person is required' });
    }

    await db.run(
      `UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, updated_at=datetime('now')
       WHERE id = ?`,
      [name || null, contact_person, phone || null, email || null, address || null, id]
    );

    const updatedSupplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json(updatedSupplier);
  } catch (error) {
    next(error);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    await db.run('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Update supplier balance (add payment or record payable)
exports.updateSupplierBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, type, description } = req.body;
    const transactionDate = req.body.transaction_date || new Date().toISOString().split('T')[0];

    // Validate and parse amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    if (!type || !['payment', 'charge'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "payment" or "charge"' });
    }

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get all transactions up to the transaction date to calculate balance_before
    // Include transactions from the same date (they were created before this one)
    const previousTransactions = await db.all(
      `SELECT type, amount FROM supplier_transactions 
       WHERE supplier_id = ? AND DATE(created_at) <= ?
       ORDER BY created_at ASC`,
      [id, transactionDate]
    ) || [];

    let balanceBefore = 0;
    if (previousTransactions && Array.isArray(previousTransactions)) {
      for (const tx of previousTransactions) {
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'charge') {
          balanceBefore += txAmount;
        } else {
          balanceBefore -= txAmount;
        }
      }
    }

    let balanceAfter;
    if (type === 'charge') {
      // You purchased something on credit - you owe supplier more
      balanceAfter = balanceBefore + parsedAmount;
    } else {
      // You made a payment - you owe supplier less
      balanceAfter = balanceBefore - parsedAmount;
    }

    // Save transaction history with calculated balances
    const result = await db.run(
      `INSERT INTO supplier_transactions (supplier_id, type, amount, balance_before, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, parsedAmount, balanceBefore, balanceAfter, description || null, transactionDate]
    );

    // Recalculate all transactions after this date to update their balances
    const laterTransactions = await db.all(
      `SELECT id, type, amount FROM supplier_transactions 
       WHERE supplier_id = ? AND DATE(created_at) > ?
       ORDER BY created_at ASC`,
      [id, transactionDate]
    ) || [];

    let runningBalance = balanceAfter;
    if (laterTransactions && Array.isArray(laterTransactions)) {
      for (const tx of laterTransactions) {
        let newBalance;
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'charge') {
          newBalance = runningBalance + txAmount;
        } else {
          newBalance = runningBalance - txAmount;
        }

        await db.run(
          `UPDATE supplier_transactions SET balance_before = ?, balance_after = ? WHERE id = ?`,
          [runningBalance, newBalance, tx.id]
        );
        runningBalance = newBalance;
      }
    }

    // Update supplier's current balance to the final running balance
    await db.run(
      'UPDATE suppliers SET balance = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [runningBalance, id]
    );

    const updatedSupplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    
    res.json({
      ...updatedSupplier,
      transaction: {
        type,
        amount: parseFloat(amount),
        description,
        previousBalance: balanceBefore,
        newBalance: balanceAfter
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier transaction history
exports.getSupplierTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    let query = 'SELECT * FROM supplier_transactions WHERE supplier_id = ?';
    const params = [id];

    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    const transactions = await db.all(query, params);

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        currentBalance: supplier.balance
      },
      transactions
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier daily ledger: row-wise transaction details
exports.getSupplierLedger = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const rows = await db.all(
      `SELECT 
         id,
         DATE(created_at) AS date,
         type,
         amount,
         description,
         created_at
       FROM supplier_transactions
       WHERE supplier_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({ 
      supplier: { 
        id: supplier.id, 
        name: supplier.name,
        currentBalance: supplier.balance
      }, 
      ledger: rows 
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing supplier transaction and recalculate balances
exports.updateSupplierTransaction = async (req, res, next) => {
  try {
    const { id, transactionId } = req.params;
    const { amount, type, description } = req.body;
    const transactionDate = req.body.transaction_date || null;

    // Validate inputs
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    if (!type || !['payment', 'charge'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "payment" or "charge"' });
    }

    // Ensure supplier exists
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Ensure transaction exists and belongs to supplier
    const existingTx = await db.get(
      'SELECT * FROM supplier_transactions WHERE id = ? AND supplier_id = ?',
      [transactionId, id]
    );
    if (!existingTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updatedTx = {
      ...existingTx,
      type,
      amount: parsedAmount,
      description: description || null,
      created_at: transactionDate ? transactionDate : existingTx.created_at,
    };

    // Gather all other transactions
    const otherTransactions = await db.all(
      `SELECT * FROM supplier_transactions 
       WHERE supplier_id = ? AND id != ?
       ORDER BY datetime(created_at) ASC, id ASC`,
      [id, transactionId]
    );

    // Rebuild ordered list including updated transaction
    const allTransactions = [...otherTransactions, updatedTx].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateA === dateB) return (a.id || 0) - (b.id || 0);
      return dateA - dateB;
    });

    await db.run('BEGIN TRANSACTION');

    let runningBalance = 0;
    for (const tx of allTransactions) {
      const balanceBefore = runningBalance;
      const balanceAfter = tx.type === 'charge'
        ? balanceBefore + parseFloat(tx.amount)
        : balanceBefore - parseFloat(tx.amount);

      if (tx.id === parseInt(transactionId, 10)) {
        await db.run(
          `UPDATE supplier_transactions
             SET type = ?, amount = ?, description = ?, created_at = ?,
                 balance_before = ?, balance_after = ?
           WHERE id = ?`,
          [updatedTx.type, updatedTx.amount, updatedTx.description, updatedTx.created_at, balanceBefore, balanceAfter, tx.id]
        );
      } else {
        await db.run(
          `UPDATE supplier_transactions
             SET balance_before = ?, balance_after = ?
           WHERE id = ?`,
          [balanceBefore, balanceAfter, tx.id]
        );
      }

      runningBalance = balanceAfter;
    }

    await db.run(
      'UPDATE suppliers SET balance = ?, updated_at = datetime("now") WHERE id = ?',
      [runningBalance, id]
    );

    await db.run('COMMIT');

    const updatedSupplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);

    res.json({
      ...updatedSupplier,
      transaction: {
        id: parseInt(transactionId, 10),
        type,
        amount: parsedAmount,
        description: updatedTx.description,
        transaction_date: updatedTx.created_at,
        balanceAfter: runningBalance
      }
    });
  } catch (error) {
    try { await db.run('ROLLBACK'); } catch (_) {}
    next(error);
  }
};
