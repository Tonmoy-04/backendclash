const db = require('./database/db');

async function checkDates() {
  console.log('\n=== CHECKING SALES DATES ===\n');
  
  const sales = await db.all(`SELECT id, customer_name, sale_date, typeof(sale_date) as date_type FROM sales ORDER BY id DESC LIMIT 10`);
  
  console.log('Recent sales:');
  sales.forEach(sale => {
    console.log(`ID ${sale.id}: ${sale.customer_name}`);
    console.log(`  sale_date: ${sale.sale_date}`);
    console.log(`  type: ${sale.date_type}`);
    console.log(`  new Date(sale_date): ${new Date(sale.sale_date)}`);
    console.log(`  isNaN: ${isNaN(new Date(sale.sale_date).getTime())}`);
    console.log('');
  });
  
  console.log('\n=== CHECKING PURCHASES DATES ===\n');
  
  const purchases = await db.all(`SELECT id, supplier_name, purchase_date, typeof(purchase_date) as date_type FROM purchases ORDER BY id DESC LIMIT 10`);
  
  console.log('Recent purchases:');
  purchases.forEach(purchase => {
    console.log(`ID ${purchase.id}: ${purchase.supplier_name}`);
    console.log(`  purchase_date: ${purchase.purchase_date}`);
    console.log(`  type: ${purchase.date_type}`);
    console.log(`  new Date(purchase_date): ${new Date(purchase.purchase_date)}`);
    console.log(`  isNaN: ${isNaN(new Date(purchase.purchase_date).getTime())}`);
    console.log('');
  });
  
  process.exit(0);
}

checkDates().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
