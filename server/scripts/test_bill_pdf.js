const path = require('path');
const { generateBill } = require('../utils/billGenerator');

(async () => {
  try {
    const transaction = {
      id: 58,
      date: Date.now(),
      party: 'জোনায়েদ',
      subtotal: 150,
      tax: 0,
      total: 150
    };

    const items = [
      {
        product_name: 'দারচিনি',
        quantity: 3,
        price: 50,
        subtotal: 150
      }
    ];

    const filePath = await generateBill({
      type: 'sale',
      transaction,
      items,
      currencySymbol: '৳',
      adjustment: 0
    });

    console.log('Generated bill at:', filePath);
  } catch (err) {
    console.error('Failed to generate test bill:', err);
    process.exitCode = 1;
  }
})();
