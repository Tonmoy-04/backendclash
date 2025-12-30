/**
 * Migration Script: Update default user credentials
 * Updates the default admin user from admin@inventory.com to ms.didar.trading
 * Password changes from admin123 to didar2026
 */

const bcrypt = require('bcrypt');
const db = require('../database/db');

async function updateDefaultUser() {
  try {
    console.log('Starting migration: Update default user credentials...');
    
    // Generate bcrypt hash for "didar2026"
    const newPassword = 'didar2026';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log(`Generated hash for password "${newPassword}"`);
    
    // Update existing admin user or insert if not exists
    const result = await db.run(
      `UPDATE users SET 
        username = ?, 
        email = ?, 
        password = ? 
       WHERE email = ? OR username = ?`,
      ['ms.didar.trading', 'ms.didar.trading', hashedPassword, 'admin@inventory.com', 'admin']
    );
    
    if (result.changes === 0) {
      // If update didn't affect any rows, insert new user
      console.log('No existing admin user found, inserting new default user...');
      await db.run(
        `INSERT INTO users (username, email, password, role) 
         VALUES (?, ?, ?, ?)`,
        ['ms.didar.trading', 'ms.didar.trading', hashedPassword, 'admin']
      );
    }
    
    console.log('✅ Migration complete!');
    console.log('New credentials:');
    console.log('  Email/Username: ms.didar.trading');
    console.log('  Password: didar2026');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

updateDefaultUser();
