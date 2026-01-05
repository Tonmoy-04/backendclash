const db = require('../database/db');

exports.getAllCustomers = async (req, res, next) => {
  try {
    const { filter } = req.query;
    
    let query = 'SELECT * FROM customers';
    const conditions = [];
    
    // Apply balance filter
    if (filter === 'debt') {
      conditions.push('balance > 0');
    } else if (filter === 'owe') {
      conditions.push('balance < 0');
    } else if (filter === 'clear') {
      conditions.push('balance = 0');
    }
    // filter === 'all' or undefined shows all customers
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const customers = await db.all(query);
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await db.get(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    next(error);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, previous_due } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Use previous_due as initial balance, default to 0
    const initialBalance = previous_due ? parseFloat(previous_due) : 0;

    const result = await db.run(
      `INSERT INTO customers (name, phone, email, address, balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [name, phone || null, email || null, address || null, initialBalance]
    );

    const customerId = result.lastID;

    // If previous_due is provided, record it as an initial transaction
    if (initialBalance !== 0) {
      const absAmount = Math.abs(initialBalance);
      const transactionType = initialBalance > 0 ? 'charge' : 'payment';
      const description = initialBalance > 0 ? 'Initial Due' : 'Initial Credit';
      
      await db.run(
        `INSERT INTO customer_transactions (customer_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [customerId, transactionType, absAmount, 0, initialBalance, description, new Date().toISOString().split('T')[0]]
      );
    }

    res.status(201).json({
      id: customerId,
      name,
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

exports.updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Only require name, allow other fields to be cleared
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await db.run(
      `UPDATE customers SET name=?, phone=?, email=?, address=?, updated_at=datetime('now')
       WHERE id = ?`,
      [name, phone || null, email || null, address || null, id]
    );

    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    res.json(updatedCustomer);
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.run('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Update customer balance (add payment or record receivable)
exports.updateCustomerBalance = async (req, res, next) => {
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

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get all transactions up to the transaction date to calculate balance_before
    // Include transactions from the same date (they were created before this one)
    const previousTransactions = await db.all(
      `SELECT type, amount FROM customer_transactions 
       WHERE customer_id = ? AND DATE(created_at) <= ?
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
      // Customer bought something on credit - they owe you more
      balanceAfter = balanceBefore + parsedAmount;
    } else {
      // Customer made a payment - they owe you less
      balanceAfter = balanceBefore - parsedAmount;
    }

    // Save transaction history with calculated balances
    const result = await db.run(
      `INSERT INTO customer_transactions (customer_id, type, amount, balance_before, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, parsedAmount, balanceBefore, balanceAfter, description || null, transactionDate]
    );

    // Recalculate all transactions after this date to update their balances
    const laterTransactions = await db.all(
      `SELECT id, type, amount FROM customer_transactions 
       WHERE customer_id = ? AND DATE(created_at) > ?
       ORDER BY created_at ASC`,
      [id, transactionDate]
    );

    let runningBalance = balanceAfter;
    for (const tx of laterTransactions) {
      let newBalance;
      if (tx.type === 'charge') {
        newBalance = runningBalance + parseFloat(tx.amount);
      } else {
        newBalance = runningBalance - parseFloat(tx.amount);
      }

      await db.run(
        `UPDATE customer_transactions SET balance_before = ?, balance_after = ? WHERE id = ?`,
        [runningBalance, newBalance, tx.id]
      );
      runningBalance = newBalance;
    }

    // Update customer's current balance to the final running balance
    await db.run(
      'UPDATE customers SET balance = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [runningBalance, id]
    );

    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    
    res.json({
      ...updatedCustomer,
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

// Get customer transaction history
exports.getCustomerTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let query = 'SELECT * FROM customer_transactions WHERE customer_id = ?';
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
      customer: {
        id: customer.id,
        name: customer.name,
        currentBalance: customer.balance
      },
      transactions
    });
  } catch (error) {
    next(error);
  }
};

// Get customer daily ledger: row-wise transaction details
exports.getCustomerLedger = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const rows = await db.all(
      `SELECT 
         id,
         DATE(created_at) AS date,
         type,
         amount,
         description,
         created_at
       FROM customer_transactions
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({ 
      customer: { 
        id: customer.id, 
        name: customer.name,
        currentBalance: customer.balance
      }, 
      ledger: rows 
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing customer transaction and recalculate balances
exports.updateCustomerTransaction = async (req, res, next) => {
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

    // Ensure customer exists
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Ensure transaction exists and belongs to the customer
    const existingTx = await db.get(
      'SELECT * FROM customer_transactions WHERE id = ? AND customer_id = ?',
      [transactionId, id]
    );
    if (!existingTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Build the updated transaction object (use provided date or existing date)
    const updatedTx = {
      ...existingTx,
      type,
      amount: parsedAmount,
      description: description || null,
      created_at: transactionDate ? transactionDate : existingTx.created_at,
    };

    // Fetch all other transactions for this customer
    const otherTransactions = await db.all(
      `SELECT * FROM customer_transactions 
       WHERE customer_id = ? AND id != ?
       ORDER BY datetime(created_at) ASC, id ASC`,
      [id, transactionId]
    );

    // Rebuild ordered list including updated transaction (keep stable ordering)
    const allTransactions = [...otherTransactions, updatedTx].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateA === dateB) return (a.id || 0) - (b.id || 0);
      return dateA - dateB;
    });

    // Recalculate balances in a transaction-safe manner
    await db.run('BEGIN TRANSACTION');

    let runningBalance = 0;
    for (const tx of allTransactions) {
      const balanceBefore = runningBalance;
      const newBalanceAfter = tx.type === 'charge'
        ? balanceBefore + parseFloat(tx.amount)
        : balanceBefore - parseFloat(tx.amount);

      if (tx.id === parseInt(transactionId, 10)) {
        // Update the edited transaction with new values
        await db.run(
          `UPDATE customer_transactions 
             SET type = ?, amount = ?, description = ?, created_at = ?, 
                 balance_before = ?, balance_after = ?
           WHERE id = ?`,
          [updatedTx.type, updatedTx.amount, updatedTx.description, updatedTx.created_at, balanceBefore, newBalanceAfter, tx.id]
        );
      } else {
        // Only refresh balances for untouched transactions
        await db.run(
          `UPDATE customer_transactions 
             SET balance_before = ?, balance_after = ? 
           WHERE id = ?`,
          [balanceBefore, newBalanceAfter, tx.id]
        );
      }

      runningBalance = newBalanceAfter;
    }

    // Persist customer balance to final running balance
    await db.run(
      'UPDATE customers SET balance = ?, updated_at = datetime("now") WHERE id = ?',
      [runningBalance, id]
    );

    await db.run('COMMIT');

    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);

    res.json({
      ...updatedCustomer,
      transaction: {
        id: parseInt(transactionId, 10),
        type,
        amount: parsedAmount,
        description: updatedTx.description,
        transaction_date: updatedTx.created_at,
        balanceBefore: null, // not needed on update response
        balanceAfter: runningBalance
      }
    });
  } catch (error) {
    try { await db.run('ROLLBACK'); } catch (_) {}
    next(error);
  }
};
