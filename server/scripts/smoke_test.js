const base = 'http://localhost:' + (process.env.PORT || '5002') + '/api';

(async () => {
  try {
    const post = async (url, body) => {
      const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };
    const put = async (url, body) => {
      const res = await fetch(base + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };

    // Create sale
    const salePayload = {
      customer_name: 'Smoke Test Customer',
      payment_method: 'due',
      notes: 'smoke',
      items: [
        { product_name: 'Apple', quantity: 2, price: 5 },
        { product_name: 'Banana', quantity: 1, price: 3 }
      ]
    };

    console.log('Creating sale...');
    const created = await post('/sales', salePayload);
    console.log('Created sale:', created);
    const saleId = created.saleId;

    // Generate bill initial
    console.log('Generating initial bill...');
    const bill1 = await post(`/sales/${saleId}/generate-bill`, {});
    console.log('Bill1:', bill1);

    // Update sale: remove Banana, add Orange
    const updatePayload = {
      customer_name: 'Smoke Test Customer',
      payment_method: 'due',
      notes: 'smoke updated',
      items: [
        { product_name: 'Apple', quantity: 1, price: 5 },
        { product_name: 'Orange', quantity: 3, price: 4 }
      ]
    };

    console.log('Updating sale...');
    const updated = await put(`/sales/${saleId}`, updatePayload);
    console.log('Updated:', updated);

    // Generate bill after update
    console.log('Generating updated bill...');
    const bill2 = await post(`/sales/${saleId}/generate-bill`, {});
    console.log('Bill2:', bill2);

    console.log('Smoke test completed successfully');
  } catch (err) {
    console.error('Smoke test failed:', err.message || err);
    process.exit(1);
  }
})();
