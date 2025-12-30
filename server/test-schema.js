const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/inventory.db');

db.serialize(() => {
  db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'", (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else if (rows && rows.length > 0) {
      console.log('Products table schema:');
      console.log(rows[0].sql);
    } else {
      console.log('Products table not found');
    }
    db.close();
  });
});
