const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const INVENTORY_DB = path.join(__dirname, '..', 'database', 'inventory.db');

console.log('Reinitializing inventory.db with proper schema...');

// Close any existing connection and recreate
const db = new sqlite3.Database(INVENTORY_DB);

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
const statements = schema.split(';').filter(stmt => stmt.trim());

let completed = 0;

statements.forEach((statement, index) => {
  if (statement.trim()) {
    db.run(statement, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error(`Error on statement ${index}:`, err.message);
      }
      completed++;
      if (completed === statements.length) {
        console.log('Schema reinitialized successfully!');
        db.close();
      }
    });
  } else {
    completed++;
  }
});
