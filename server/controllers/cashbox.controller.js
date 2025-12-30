const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Initialize cashbox with opening balance
 * Can only be done once
 */
exports.initializeCashbox = async (req, res, next) => {
  try {
    const { opening_balance } = req.body;

    // Validate opening balance
    if (opening_balance === undefined || opening_balance === null) {
      return res.status(400).json({ message: 'Opening balance is required' });
    }

    if (isNaN(opening_balance) || opening_balance < 0) {
      return res.status(400).json({ message: 'Opening balance must be a positive number' });
    }

    // Check if cashbox is already initialized
    const existing = await db.get('SELECT * FROM cashbox WHERE is_initialized = 1');
    
    if (existing) {
      return res.status(400).json({ 
        message: 'Cashbox is already initialized',
        cashbox: existing
      });
    }

    // Initialize cashbox
    const result = await db.run(
      `INSERT INTO cashbox (opening_balance, current_balance, is_initialized) 
       VALUES (?, ?, 1)`,
      [opening_balance, opening_balance]
    );

    const cashbox = await db.get('SELECT * FROM cashbox WHERE id = ?', [result.lastID]);

    res.status(201).json({
      message: 'Cashbox initialized successfully',
      cashbox
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current cashbox status
 */
exports.getCashbox = async (req, res, next) => {
  try {
    const cashbox = await db.get('SELECT * FROM cashbox WHERE is_initialized = 1');

    if (!cashbox) {
      return res.json({
        initialized: false,
        cashbox: null
      });
    }

    res.json({
      initialized: true,
      cashbox
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a transaction (deposit or withdrawal)
 */
exports.addTransaction = async (req, res, next) => {
  try {
    const { type, amount, date, note } = req.body;

    // Validation
    if (!type || !['deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either "deposit" or "withdrawal"' });
    }

    if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    // Get current cashbox
    const cashbox = await db.get('SELECT * FROM cashbox WHERE is_initialized = 1');

    if (!cashbox) {
      return res.status(400).json({ message: 'Cashbox is not initialized. Please initialize first.' });
    }

    let newBalance;

    if (type === 'deposit') {
      newBalance = parseFloat(cashbox.current_balance) + parseFloat(amount);
    } else {
      // Withdrawal - check if sufficient balance
      if (parseFloat(cashbox.current_balance) < parseFloat(amount)) {
        return res.status(400).json({ 
          message: 'Insufficient balance for withdrawal',
          currentBalance: cashbox.current_balance,
          requestedAmount: amount
        });
      }
      newBalance = parseFloat(cashbox.current_balance) - parseFloat(amount);
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Validate and parse balance values
      const currentBalance = parseFloat(cashbox.current_balance) || 0;
      const parsedAmount = parseFloat(amount) || 0;
      const finalNewBalance = parseFloat(newBalance) || 0;

      // Update cashbox balance
      await db.run(
        'UPDATE cashbox SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [finalNewBalance, cashbox.id]
      );

      // Insert transaction record
      const transactionDate = date || new Date().toISOString();
      const result = await db.run(
        `INSERT INTO cashbox_transactions (cashbox_id, type, amount, date, note, balance_after) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cashbox.id, type, parsedAmount, transactionDate, note || '', finalNewBalance]
      );

      await db.run('COMMIT');

      const transaction = await db.get(
        'SELECT * FROM cashbox_transactions WHERE id = ?',
        [result.lastID]
      );

      if (!transaction) {
        return res.status(500).json({ error: 'Failed to retrieve transaction record' });
      }

      const updatedCashbox = await db.get('SELECT * FROM cashbox WHERE id = ?', [cashbox.id]);

      res.status(201).json({
        message: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful`,
        transaction,
        cashbox: updatedCashbox
      });
    } catch (error) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(`Failed to rollback transaction: ${rollbackErr.message}`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get all cashbox transactions with pagination
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.get('SELECT COUNT(*) as total FROM cashbox_transactions');
    const total = countResult.total;

    // Get transactions
    const transactions = await db.all(
      `SELECT * FROM cashbox_transactions 
       ORDER BY date DESC, created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction summary/statistics
 */
exports.getTransactionSummary = async (req, res, next) => {
  try {
    const cashbox = await db.get('SELECT * FROM cashbox WHERE is_initialized = 1');

    if (!cashbox) {
      return res.json({
        initialized: false,
        summary: null
      });
    }

    // Get total deposits
    const deposits = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
       FROM cashbox_transactions 
       WHERE type = 'deposit'`
    );

    // Get total withdrawals
    const withdrawals = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
       FROM cashbox_transactions 
       WHERE type = 'withdrawal'`
    );

    // Get today's transactions
    const todayTransactions = await db.all(
      `SELECT * FROM cashbox_transactions 
       WHERE DATE(date) = DATE('now') 
       ORDER BY date DESC, created_at DESC`
    );

    res.json({
      initialized: true,
      cashbox,
      summary: {
        totalDeposits: deposits.total,
        depositCount: deposits.count,
        totalWithdrawals: withdrawals.total,
        withdrawalCount: withdrawals.count,
        netChange: deposits.total - withdrawals.total,
        todayTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
