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
const PORT = process.env.PORT || 5000;

// Middleware
// Allow React dev server and Electron renderer (file:// origin)
app.use(cors({
  origin: function (origin: any, callback: any) {
    // In dev, allow CRA server
    if (!origin) return callback(null, true);
    if (origin === 'http://localhost:3000') return callback(null, true);
    // Electron renderer loads from file:// and sends Origin 'null'
    if (origin === 'null' || origin.startsWith('file://')) return callback(null, true);
    // In packaged Electron, many requests appear without Origin; allow them
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging (suppress noisy HEAD/OPTIONS health checks)
app.use((req: any, res: any, next: any) => {
  const method = String(req.method || '').toUpperCase();
  if (method !== 'HEAD' && method !== 'OPTIONS') {
    logger.info(`${method} ${req.url}`);
  }
  next();
});

// API Routes
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

// Auto-detect and serve React build if it exists (production/packaged mode)
// Try multiple possible paths for client build
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/build'),     // From server/dist in packaged app
  path.resolve(__dirname, '../client/build'),        // Alternative structure
  path.resolve(__dirname, '../../app.asar.unpacked/client/build')  // Unpacked resources
];

let clientBuildPath: string | null = null;
for (const candidate of possibleClientPaths) {
  const indexPath = path.join(candidate, 'index.html');
  if (fs.existsSync(indexPath)) {
    clientBuildPath = candidate;
    logger.info(`Found client build at: ${clientBuildPath}`);
    break;
  }
}

if (clientBuildPath) {
  // Serve static files
  app.use(express.static(clientBuildPath));
  logger.info('Serving React app from Express');
  
  // SPA fallback for non-API routes
  app.get(/^(?!\/api\/).*/, (req: any, res: any) => {
    res.sendFile(path.join(clientBuildPath!, 'index.html'));
  });
} else {
  // Development fallback when no build exists
  logger.warn('Client build not found - running in API-only mode');
  app.get('/', (req: any, res: any) => {
    res.status(200).send('API running (development mode - no client build found)');
  });
  app.head('/', (req: any, res: any) => {
    res.status(200).end();
  });
}

// Health check
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Schedule automatic backups (every 24 hours)
backupManager.scheduleAutoBackup(24);

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    message: 'Unhandled Rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'No stack trace',
    timestamp: new Date().toISOString()
  });
});

process.on('uncaughtException', (error) => {
  logger.error({
    message: 'Uncaught Exception',
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  // Exit process after logging
  process.exit(1);
});

// Start server
const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : PORT;
  logger.info(`Server running on ${HOST}:${actualPort}`);
  console.log(`🚀 Server running on http://${HOST}:${actualPort}`);
  if (typeof process.send === 'function') {
    try {
      process.send({ type: 'listening', port: actualPort });
    } catch {}
  }
});

async function gracefulShutdown(signal: string) {
  try {
    logger.info(`Shutdown requested (${signal})`);
  } catch {}

  await new Promise<void>((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });

  // Close sqlite connections if available
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

