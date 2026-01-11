#!/usr/bin/env node
/**
 * Production Build Verification Script
 * Confirms all critical files are present and current in the production build
 */

const fs = require('fs');
const path = require('path');

const CRITICAL_FILES = [
  'server/dist/utils/billGenerator.js',
  'server/dist/database/db.js',
  'server/dist/controllers/dashboard.controller.js',
  'server/dist/controllers/sales.controller.js',
  'server/dist/routes/dashboard.routes.js',
  'server/dist/routes/sales.routes.js',
  'server/dist/database/inventory.schema.sql',
  'server/dist/database/stock.schema.sql',
  'server/dist/app.js',
  'client/build/index.html',
  'dist/Setup.exe'
];

const MIGRATION_CHECKS = [
  {
    file: 'server/dist/database/db.js',
    checks: [
      { pattern: 'transport_fee', name: 'transport_fee migration' },
      { pattern: 'labour_fee', name: 'labour_fee migration' },
      { pattern: 'ensureSalesTables', name: 'Sales table migration function' }
    ]
  },
  {
    file: 'server/dist/controllers/dashboard.controller.js',
    checks: [
      { pattern: 'getCustomersDebtAlerts', name: 'Customer debt alert function' },
      { pattern: '100000', name: 'Threshold constant' }
    ]
  },
  {
    file: 'server/dist/utils/billGenerator.js',
    checks: [
      { pattern: 'মেসার্স দিদার ট্রেডিং', name: 'Bengali company name' },
      { pattern: 'generateBill', name: 'Bill generation function' },
      { pattern: 'transport_fee', name: 'Transport fee parameter' }
    ]
  }
];

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   PRODUCTION BUILD VERIFICATION                            ║');
console.log('║   Inventory Manager Desktop Application                    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const projectRoot = path.resolve(__dirname);
let allPass = true;

// Check critical files exist
console.log('📁 Checking critical files...\n');
for (const file of CRITICAL_FILES) {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  const fileSize = exists ? `(${(fs.statSync(filePath).size / 1024).toFixed(2)} KB)` : '';
  console.log(`${status} ${file} ${fileSize}`);
  if (!exists) allPass = false;
}

console.log('\n📝 Checking critical code patterns...\n');

// Check code patterns
for (const { file, checks } of MIGRATION_CHECKS) {
  const filePath = path.join(projectRoot, file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${file} - FILE NOT FOUND\n`);
    allPass = false;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const { pattern, name } of checks) {
    const found = content.includes(pattern);
    const status = found ? '✅' : '❌';
    console.log(`${status} ${file.split('/').pop()}: ${name}`);
    if (!found) allPass = false;
  }
  console.log();
}

// Check installer
console.log('📦 Checking Electron installer...\n');
const installerPath = path.join(projectRoot, 'dist/Setup.exe');
if (fs.existsSync(installerPath)) {
  const stat = fs.statSync(installerPath);
  const sizeGB = (stat.size / (1024 * 1024)).toFixed(2);
  const mtime = new Date(stat.mtime).toLocaleString();
  console.log(`✅ Setup.exe exists`);
  console.log(`   Size: ${sizeGB} MB`);
  console.log(`   Modified: ${mtime}\n`);
} else {
  console.log(`❌ Setup.exe NOT FOUND\n`);
  allPass = false;
}

// Final status
console.log('═'.repeat(60));
if (allPass) {
  console.log('✅ ALL CHECKS PASSED - Production build is ready for deployment');
} else {
  console.log('❌ SOME CHECKS FAILED - Do not deploy, rebuild required');
  process.exit(1);
}
console.log('═'.repeat(60));
console.log();
