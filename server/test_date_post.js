const axios = require('axios');

async function testDatePost() {
  try {
    // Test with a previous date in dd/mm/yyyy format
    const testDate = '30/12/2025';
    
    console.log('\n=== TESTING SALE WITH DATE:', testDate, '===\n');
    
    const payload = {
      customer_name: 'Test Customer',
      customer_address: 'Test Address',
      payment_method: 'cash',
      notes: 'Test sale with previous date',
      sale_date: testDate,
      total: 1000,
      items: [
        {
          product_name: 'Test Product',
          quantity: 1,
          price: 1000
        }
      ]
    };
    
    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post('http://127.0.0.1:5000/api/sales', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\nResponse status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Now fetch the sale to see what was stored
    if (response.data.id || response.data.saleId) {
      const saleId = response.data.id || response.data.saleId;
      console.log('\nFetching sale ID:', saleId);
      
      const getResponse = await axios.get(`http://127.0.0.1:5000/api/sales/${saleId}`);
      console.log('\nStored sale data:', JSON.stringify(getResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('\nERROR:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
  }
}

testDatePost();
