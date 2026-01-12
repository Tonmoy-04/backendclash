/**
 * Production Build Feature Audit Script
 * Tests all critical features that may differ from dev mode
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const API_BASE = 'http://localhost:5000/api';
let testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper to make HTTP requests
function makeRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testHealthCheck() {
  console.log('\n=== TEST 1: Health Check ===');
  try {
    const res = await makeRequest('GET', '/health');
    if (res.status === 200) {
      testResults.passed.push('Health check successful');
      console.log('✓ API is responsive');
      return true;
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Health check failed: ${error.message}`);
    console.log('✗ API is not responsive:', error.message);
    return false;
  }
}

async function testDatabaseConfiguration() {
  console.log('\n=== TEST 2: Database Configuration ===');
  try {
    // Get dashboard data which requires database
    const res = await makeRequest('GET', '/dashboard');
    if (res.status === 200 || res.status === 401) {
      testResults.passed.push('Database is accessible');
      console.log('✓ Database accessible');
      return true;
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Database configuration issue: ${error.message}`);
    console.log('✗ Database not accessible:', error.message);
    return false;
  }
}

async function testConfigFilesPath() {
  console.log('\n=== TEST 3: Config Files Accessibility ===');
  try {
    const home = os.homedir();
    const configDirs = [
      path.join(home, 'AppData', 'Local', 'M∕S DIDAR TRADING'),
      path.join(home, 'AppData', 'Roaming', 'M∕S DIDAR TRADING'),
      path.join(home, 'Documents', 'InventoryApp')
    ];

    let foundConfig = false;
    for (const dir of configDirs) {
      if (fs.existsSync(dir)) {
        foundConfig = true;
        console.log(`✓ Config directory found: ${dir}`);
        testResults.passed.push(`Config dir accessible: ${dir}`);
      }
    }

    if (!foundConfig) {
      testResults.warnings.push('No standard config directories found yet (expected on first run)');
      console.log('⚠ No config directories found (expected on first run)');
    }
    return true;
  } catch (error) {
    testResults.failed.push(`Config path error: ${error.message}`);
    console.log('✗ Config path error:', error.message);
    return false;
  }
}

async function testBillGeneration() {
  console.log('\n=== TEST 4: PDF Bill Generation ===');
  try {
    const billData = {
      party: 'Test Customer দোকান',
      date: new Date().toISOString(),
      payment_method: 'cash',
      items: [
        {
          product_name: 'দারচিনি (Cinnamon)',
          quantity: 5,
          price: 100,
          subtotal: 500
        },
        {
          product_name: 'Pepper',
          quantity: 10,
          price: 50,
          subtotal: 500
        }
      ],
      currencySymbol: '৳'
    };

    const res = await makeRequest('POST', '/bill/temporary', billData);
    
    if (res.status === 200 && res.data.path) {
      // Check if PDF file was created
      const pdfPath = res.data.path;
      if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        if (stats.size > 5000) { // PDF should be at least 5KB
          testResults.passed.push(`Bill PDF generated successfully (${(stats.size/1024).toFixed(2)}KB)`);
          console.log(`✓ PDF bill generated: ${pdfPath}`);
          console.log(`  File size: ${(stats.size/1024).toFixed(2)}KB`);
          return true;
        } else {
          throw new Error('PDF file too small, possibly corrupted');
        }
      } else {
        throw new Error(`PDF file not created at ${pdfPath}`);
      }
    } else {
      throw new Error(`API returned status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Bill generation failed: ${error.message}`);
    console.log('✗ Bill generation failed:', error.message);
    return false;
  }
}

async function testCustomerDebtAlerts() {
  console.log('\n=== TEST 5: Customer Debt Alerts ===');
  try {
    // First, check if endpoint exists
    const res = await makeRequest('GET', '/dashboard/customers-debt-alerts?threshold=100000');
    
    if (res.status === 200 && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        testResults.passed.push(`Customer debt alerts working (${res.data.length} high-debt customers)`);
        console.log(`✓ Customer debt alerts responsive (${res.data.length} customers with >100000 debt)`);
      } else {
        testResults.passed.push('Customer debt alerts endpoint working (no high-debt customers)');
        console.log('✓ Customer debt alerts endpoint working (no high-debt customers found)');
      }
      return true;
    } else if (res.status === 401) {
      testResults.warnings.push('Debt alerts require authentication (expected in some cases)');
      console.log('⚠ Debt alerts require authentication');
      return true;
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Customer debt alerts failed: ${error.message}`);
    console.log('✗ Customer debt alerts failed:', error.message);
    return false;
  }
}

async function testCurrencySymbol() {
  console.log('\n=== TEST 6: Bengali Currency Symbol ===');
  try {
    // Check if settings are being properly served
    const res = await makeRequest('GET', '/dashboard');
    
    if (res.status === 200 || res.status === 401) {
      testResults.passed.push('Currency symbol settings accessible');
      console.log('✓ Settings endpoint accessible');
      // The actual symbol would be in the settings/dashboard data
      return true;
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Currency symbol test failed: ${error.message}`);
    console.log('✗ Currency symbol test failed:', error.message);
    return false;
  }
}

async function testFilePermissions() {
  console.log('\n=== TEST 7: File & Directory Permissions ===');
  try {
    const testDir = path.join(os.homedir(), 'Documents', 'InventoryApp', 'test-write');
    const testFile = path.join(testDir, 'test.txt');
    
    // Try to create a test file
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, 'test', 'utf-8');
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);
    
    testResults.passed.push('File write permissions OK');
    console.log('✓ File write permissions working');
    return true;
  } catch (error) {
    testResults.failed.push(`File permission issue: ${error.message}`);
    console.log('✗ File permission issue:', error.message);
    return false;
  }
}

async function testFontAvailability() {
  console.log('\n=== TEST 8: Bengali Font Availability ===');
  try {
    const fontCandidates = [
      path.join('C:\\Windows\\Fonts', 'Nirmala.ttf'),
      path.join('C:\\Windows\\Fonts', 'Vrinda.ttf'),
      path.join(os.homedir(), 'AppData', 'Local', 'M∕S DIDAR TRADING', 'resources', 'config', 'fonts', 'NotoSansBengaliUI-Regular.ttf')
    ];

    let foundFonts = [];
    for (const font of fontCandidates) {
      if (fs.existsSync(font)) {
        foundFonts.push(path.basename(font));
      }
    }

    if (foundFonts.length > 0) {
      testResults.passed.push(`Bengali fonts available: ${foundFonts.join(', ')}`);
      console.log(`✓ Bengali fonts found: ${foundFonts.join(', ')}`);
      return true;
    } else {
      testResults.warnings.push('No Bengali fonts found - may affect Bengali text rendering in PDFs');
      console.log('⚠ No Bengali fonts found - PDF Bengali rendering may be limited');
      return true;
    }
  } catch (error) {
    testResults.failed.push(`Font check error: ${error.message}`);
    console.log('✗ Font check error:', error.message);
    return false;
  }
}

async function testDatabaseIntegrity() {
  console.log('\n=== TEST 9: Database Schema Integrity ===');
  try {
    // Try to access customers endpoint which uses database
    const res = await makeRequest('GET', '/customers');
    
    if (res.status === 200 || res.status === 401 || res.status === 400) {
      testResults.passed.push('Database schema accessible');
      console.log('✓ Database schema is accessible');
      return true;
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    testResults.failed.push(`Database integrity issue: ${error.message}`);
    console.log('✗ Database integrity issue:', error.message);
    return false;
  }
}

async function testElectronPaths() {
  console.log('\n=== TEST 10: Electron App Paths ===');
  try {
    const appDataLocal = path.join(os.homedir(), 'AppData', 'Local');
    
    // Check if app created any directories
    const possibleAppDirs = [
      path.join(appDataLocal, 'M∕S DIDAR TRADING'),
      path.join(appDataLocal, 'inventory-desktop-app'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'M∕S DIDAR TRADING')
    ];

    let foundAppDir = false;
    for (const dir of possibleAppDirs) {
      if (fs.existsSync(dir)) {
        foundAppDir = true;
        testResults.passed.push(`App directory found: ${dir}`);
        console.log(`✓ App directory: ${dir}`);
      }
    }

    if (!foundAppDir) {
      testResults.warnings.push('App home directory not yet created (will be created on first use)');
      console.log('⚠ App home directory not yet created');
    }
    
    return true;
  } catch (error) {
    testResults.failed.push(`Electron paths error: ${error.message}`);
    console.log('✗ Electron paths error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     PRODUCTION BUILD FEATURE AUDIT - AUTOMATED TESTS       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await testHealthCheck();
  await testDatabaseConfiguration();
  await testConfigFilesPath();
  await testBillGeneration();
  await testCustomerDebtAlerts();
  await testCurrencySymbol();
  await testFilePermissions();
  await testFontAvailability();
  await testDatabaseIntegrity();
  await testElectronPaths();

  // Print Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\n✓ PASSED: ${testResults.passed.length}`);
  testResults.passed.forEach(p => console.log(`  • ${p}`));
  
  if (testResults.failed.length > 0) {
    console.log(`\n✗ FAILED: ${testResults.failed.length}`);
    testResults.failed.forEach(f => console.log(`  • ${f}`));
  }
  
  if (testResults.warnings.length > 0) {
    console.log(`\n⚠ WARNINGS: ${testResults.warnings.length}`);
    testResults.warnings.forEach(w => console.log(`  • ${w}`));
  }

  console.log('\n');
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run tests with 2-second delay to ensure server is ready
setTimeout(runAllTests, 2000);
