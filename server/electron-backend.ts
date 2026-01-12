/**
 * Electron-specific backend entry point
 * Handles dynamic port allocation and Electron-specific initialization
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const backupManager = require('./utils/backup');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const salesRoutes = require('./routes/sales.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const customerRoutes = require('./routes/customer.routes');
const supplierRoutes = require('./routes/supplier.routes');
const backupRoutes = require('./routes/backup.routes');
const billRoutes = require('./routes/bill.routes');
const cashboxRoutes = require('./routes/cashbox.routes');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
let PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors({
  origin: function (origin: any, callback: any) {
    if (!origin) return callback(null, true);
    if (origin === 'http://localhost:3000') return callback(null, true);
    if (origin === 'null' || origin.startsWith('file://')) return callback(null, true);
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: any, res: any, next: any) => {
  const method = String(req.method || '').toUpperCase();
  if (method !== 'HEAD' && method !== 'OPTIONS') {
    logger.info(`${method} ${req.url}`);
  }
  next();
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/bill', billRoutes);
app.use('/api/cashbox', cashboxRoutes);

// Health check endpoint
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.APP_ENV || 'unknown' });
});

// Static file serving for production build
if (process.env.NODE_ENV === 'production' && process.env.APP_ENV === 'electron') {
  const clientBuildPath = path.join(__dirname, '../../client/build');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    app.get('*', (req: any, res: any) => {
      const indexPath = path.join(clientBuildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Client build not found');
      }
    });
  }
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// Global error handlers
process.on('unhandledRejection', (reason) => {
  logger.error({
    message: 'Unhandled Rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'No stack trace',
    timestamp: new Date().toISOString()
  });
});

// Attempt to start server with fallback ports
function tryStartServer(port: number, maxRetries: number = 10): void {
  const server = app.listen(port, HOST)
    .on('listening', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      logger.info(`Server running on ${HOST}:${actualPort}`);
      console.log(`🚀 Server running on http://${HOST}:${actualPort}`);
      if (typeof process.send === 'function') {
        try {
          process.send({ type: 'listening', port: actualPort });
        } catch {}
      }
    })
    .on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        if (maxRetries > 0) {
          const nextPort = port + 1;
          logger.info(`Port ${port} in use, trying ${nextPort}...`);
          console.log(`Port ${port} in use, trying ${nextPort}...`);
          tryStartServer(nextPort, maxRetries - 1);
        } else {
          logger.error({
            message: `Could not find available port after ${10 - maxRetries} attempts`,
            timestamp: new Date().toISOString()
          });
          console.error(`❌ Could not find available port. Please close other instances.`);
          process.exit(1);
        }
      } else {
        logger.error({
          message: 'Server startup error',
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        console.error('Server error:', error);
        process.exit(1);
      }
    });
}

// Start server
tryStartServer(PORT);

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  try {
    logger.info(`Shutdown requested (${signal})`);
  } catch {}

  try {
    const inv = require('./database/db');
    inv?.db?.close?.();
  } catch {}
  try {
    const stock = require('./database/stockDb');
    stock?.db?.close?.();
  } catch {}

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('message', (msg: unknown) => {
  const maybe = msg as { type?: unknown } | null;
  if (maybe && typeof maybe === 'object' && maybe.type === 'shutdown') {
    gracefulShutdown('message:shutdown');
  }
});
