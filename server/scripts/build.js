#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname.replace(/\\/g, '/').replace(/\/scripts$/, '');
const distDir = path.join(root, 'dist');

console.log('[BUILD] Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('[BUILD] Running TypeScript compiler...');
try {
  execSync('tsc', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('[BUILD ERROR] TypeScript compilation failed');
  process.exit(1);
}

// Utility function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('[BUILD] Copying JavaScript files...');

// Copy database files
copyIfExists(path.join(root, 'database/db.js'), path.join(distDir, 'database/db.js'));
copyIfExists(path.join(root, 'database/stockDb.js'), path.join(distDir, 'database/stockDb.js'));

// Copy SQL files
copyDir(path.join(root, 'database'), path.join(distDir, 'database'));

// Copy controllers
const controllersDir = path.join(root, 'controllers');
if (fs.existsSync(controllersDir)) {
  const entries = fs.readdirSync(controllersDir);
  for (const file of entries) {
    if (file.endsWith('.js')) {
      const src = path.join(controllersDir, file);
      const dest = path.join(distDir, 'controllers', file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy routes
const routesDir = path.join(root, 'routes');
if (fs.existsSync(routesDir)) {
  const entries = fs.readdirSync(routesDir);
  for (const file of entries) {
    if (file.endsWith('.js')) {
      const src = path.join(routesDir, file);
      const dest = path.join(distDir, 'routes', file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy middlewares
const middlewaresDir = path.join(root, 'middlewares');
if (fs.existsSync(middlewaresDir)) {
  const entries = fs.readdirSync(middlewaresDir);
  for (const file of entries) {
    if (file.endsWith('.js')) {
      const src = path.join(middlewaresDir, file);
      const dest = path.join(distDir, 'middlewares', file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy utils
const utilsDir = path.join(root, 'utils');
if (fs.existsSync(utilsDir)) {
  const entries = fs.readdirSync(utilsDir);
  for (const file of entries) {
    if (file.endsWith('.js')) {
      const src = path.join(utilsDir, file);
      const dest = path.join(distDir, 'utils', file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy config/fonts
copyDir(path.join(root, 'config/fonts'), path.join(distDir, 'config/fonts'));

// Copy backup.config.json
copyIfExists(path.join(root, 'backup.config.json'), path.join(distDir, 'backup.config.json'));

// Clean up database files (.db)
const dbFiles = fs.readdirSync(path.join(distDir, 'database'), { recursive: true });
for (const file of dbFiles) {
  if (file.endsWith('.db') || file.endsWith('.db-wal') || file.endsWith('.db-shm')) {
    try {
      fs.unlinkSync(path.join(distDir, 'database', file));
    } catch (e) {
      // ignore
    }
  }
}

console.log('[BUILD] Build complete! Files copied to dist/');
