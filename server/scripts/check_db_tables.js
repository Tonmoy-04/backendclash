const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'inventory.db');
const db = new sqlite3.Database(DB_PATH);

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables in inventory.db:');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
