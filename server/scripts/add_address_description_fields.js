const db = require('../database/db');

(async () => {
  try {
    console.log('Adding address and description columns to sales and purchases tables...');

    // Add columns to sales table
    try {
      await db.run('ALTER TABLE sales ADD COLUMN customer_address TEXT DEFAULT NULL');
      console.log('✓ Added customer_address to sales table');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ customer_address already exists in sales table');
      } else {
        throw err;
      }
    }

    try {
      await db.run('ALTER TABLE sales ADD COLUMN description TEXT DEFAULT NULL');
      console.log('✓ Added description to sales table');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ description already exists in sales table');
      } else {
        throw err;
      }
    }

    // Add columns to purchases table
    try {
      await db.run('ALTER TABLE purchases ADD COLUMN supplier_address TEXT DEFAULT NULL');
      console.log('✓ Added supplier_address to purchases table');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ supplier_address already exists in purchases table');
      } else {
        throw err;
      }
    }

    try {
      await db.run('ALTER TABLE purchases ADD COLUMN description TEXT DEFAULT NULL');
      console.log('✓ Added description to purchases table');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ description already exists in purchases table');
      } else {
        throw err;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
