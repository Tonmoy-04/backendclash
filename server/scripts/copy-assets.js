/**
 * Cross-platform asset copying script for build process
 * Replaces batch commands that don't work in all PowerShell environments
 */

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
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

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

try {
  // Copy database files
  console.log('Copying database files...');
  ensureDir('dist/database');
  copyDir('database', 'dist/database');
  
  // Remove .db files (shouldn't be packaged)
  const dbFiles = fs.readdirSync('dist/database').filter(f => f.endsWith('.db') || f.endsWith('.db-journal'));
  for (const file of dbFiles) {
    fs.unlinkSync(path.join('dist/database', file));
  }

  // Copy controllers
  console.log('Copying controllers...');
  copyDir('controllers', 'dist/controllers');

  // Copy routes
  console.log('Copying routes...');
  copyDir('routes', 'dist/routes');

  // Copy middlewares
  console.log('Copying middlewares...');
  copyDir('middlewares', 'dist/middlewares');

  // Copy utils (CRITICAL - was missing in production!)
  console.log('Copying utils...');
  copyDir('utils', 'dist/utils');

  // Copy config/fonts
  console.log('Copying fonts...');
  ensureDir('dist/config/fonts');
  if (fs.existsSync('config/fonts')) {
    copyDir('config/fonts', 'dist/config/fonts');
  }

  // Copy backup config
  console.log('Copying backup config...');
  if (fs.existsSync('backup.config.json')) {
    copyFile('backup.config.json', 'dist/backup.config.json');
  }

  console.log('✓ All assets copied successfully');
} catch (error) {
  console.error('✗ Asset copy failed:', error.message);
  process.exit(1);
}
