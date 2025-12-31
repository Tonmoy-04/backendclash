const fs = require('fs');
const os = require('os');
const path = require('path');

function loadSqlite3() {
  try {
    // Prefer normal resolution (works when run from repo with deps installed)
    // eslint-disable-next-line import/no-extraneous-dependencies
    return require('sqlite3').verbose();
  } catch {
    // Fallback: load sqlite3 from server/node_modules
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(__dirname, '..', 'server', 'node_modules', 'sqlite3')).verbose();
  }
}

function pickDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

  const candidates = [
    path.join(appData, 'Inventory Manager', 'database', 'inventory.db'),
    path.join(appData, 'InventoryManager', 'database', 'inventory.db'),
    path.join(appData, 'Inventory Manager', 'inventory.db'),
    path.join(appData, 'InventoryManager', 'inventory.db')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function main() {
  const sqlite3 = loadSqlite3();
  const dbPath = pickDbPath();

  console.log(`[fix-suppliers-balance] Using DB: ${dbPath}`);

  const db = new sqlite3.Database(dbPath);
  try {
    const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'");
    if (!tables.length) {
      throw new Error('Table suppliers does not exist in this database. Is this the correct inventory.db?');
    }

    const cols = await all(db, "PRAGMA table_info('suppliers')");
    const hasBalance = cols.some((c) => c && c.name === 'balance');

    if (hasBalance) {
      console.log('[fix-suppliers-balance] OK: suppliers.balance already exists.');
      return;
    }

    console.log('[fix-suppliers-balance] Adding suppliers.balance ...');
    await run(db, 'ALTER TABLE suppliers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0');
    console.log('[fix-suppliers-balance] Done: suppliers.balance added.');
  } finally {
    await new Promise((resolve) => db.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error('[fix-suppliers-balance] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
