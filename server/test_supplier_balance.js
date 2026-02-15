const axios = require('axios');

async function testSupplierBalance() {
  try {
    const baseUrl = 'http://127.0.0.1:5000';
    const testDate = '14/02/2026';

    console.log('\n=== CREATING SUPPLIER ===\n');
    const supplierRes = await axios.post(`${baseUrl}/api/suppliers`, {
      name: 'Test Supplier',
      contact_person: 'Test Contact',
      phone: '0000',
      email: 'test@supplier.local',
      address: 'Test Address'
    });

    const supplierId = supplierRes.data?.id;
    console.log('Supplier ID:', supplierId);

    console.log('\n=== POSTING SUPPLIER BALANCE ===\n');
    const balanceRes = await axios.post(`${baseUrl}/api/suppliers/${supplierId}/balance`, {
      amount: 1000,
      type: 'charge',
      description: 'Test previous date',
      transaction_date: testDate
    });

    console.log('Balance response:', balanceRes.data);

    console.log('\n=== FETCHING SUPPLIER TRANSACTIONS ===\n');
    const txRes = await axios.get(`${baseUrl}/api/suppliers/${supplierId}/transactions`);
    console.log('Transactions:', JSON.stringify(txRes.data, null, 2));

  } catch (error) {
    console.error('\nERROR:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
  }
}

testSupplierBalance();
