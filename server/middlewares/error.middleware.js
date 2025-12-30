const logger = require('../utils/logger');

exports.errorHandler = (err, req, res, next) => {
  // Ensure error object exists and has required properties
  if (!err) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  const message = err.message || 'Internal server error';
  const stack = err.stack || 'No stack trace available';

  // Log error
  logger.error({
    message,
    stack,
    url: req?.url || 'unknown',
    method: req?.method || 'unknown',
    ip: req?.ip || 'unknown',
    timestamp: new Date().toISOString()
  });

  // If response already sent, don't try to send again
  if (res.headersSent) {
    return;
  }

  // SQLite errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ 
      error: 'Database constraint violation',
      details: message 
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      details: message 
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack })
  });
};

exports.notFound = (req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
};
