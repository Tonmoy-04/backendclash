# Balance Tracking Feature

## Overview
This feature allows you to track accounts receivable (money customers owe you) and accounts payable (money you owe suppliers).

## Database Changes

### Schema Updates
Added `balance` column to both `customers` and `suppliers` tables:
- Type: `DECIMAL(10, 2)`
- Default: `0`

### Migration
Run the migration script to update existing databases:
```bash
cd server
node scripts/add_balance_columns.js
```

## Backend API

### Customer Balance Endpoints

#### Update Customer Balance
**POST** `/api/customers/:id/balance`

**Request Body:**
```json
{
  "amount": 100.50,
  "type": "payment" | "charge",
  "description": "Optional description"
}
```

**Types:**
- `payment`: Customer made a payment (reduces their balance/receivable)
- `charge`: Customer bought on credit (increases their balance/receivable)

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "balance": 50.00,
  "transaction": {
    "type": "payment",
    "amount": 100.50,
    "description": "Payment received",
    "previousBalance": 150.50,
    "newBalance": 50.00
  }
}
```

### Supplier Balance Endpoints

#### Update Supplier Balance
**POST** `/api/suppliers/:id/balance`

**Request Body:**
```json
{
  "amount": 200.00,
  "type": "payment" | "charge",
  "description": "Optional description"
}
```

**Types:**
- `payment`: You made a payment to supplier (reduces what you owe)
- `charge`: You purchased on credit (increases what you owe)

**Response:**
```json
{
  "id": 1,
  "name": "ABC Suppliers",
  "balance": 300.00,
  "transaction": {
    "type": "charge",
    "amount": 200.00,
    "description": "Purchase of inventory",
    "previousBalance": 100.00,
    "newBalance": 300.00
  }
}
```

## Frontend Features

### Customer Page Updates
- **Balance Column**: Shows current receivable/credit status
  - Red badge: Customer owes you money (Receivable)
  - Green badge: Customer has credit (overpayment)
  - Gray badge: Balance is clear (0)
- **Balance Button** (💰): Opens payment/charge modal
- **Payment Modal**: Record payments or add charges

### Supplier Page Updates
- **Balance Column**: Shows current payable/advance status
  - Red badge: You owe supplier money (Payable)
  - Green badge: You have advance payment credit
  - Gray badge: Balance is clear (0)
- **Balance Button** (💰): Opens payment/charge modal
- **Payment Modal**: Record payments or add purchases

## How Balance Works

### For Customers (Accounts Receivable)
- **Positive Balance**: Customer owes you money
  - Example: Balance of ₹500 means customer needs to pay you ₹500
- **Negative Balance**: Customer has credit (rare - overpayment/refund scenario)
  - Example: Balance of -₹100 means you owe customer ₹100
- **Zero Balance**: All settled

### For Suppliers (Accounts Payable)
- **Positive Balance**: You owe supplier money
  - Example: Balance of ₹1000 means you need to pay supplier ₹1000
- **Negative Balance**: You have advance payment
  - Example: Balance of -₹200 means supplier owes you goods worth ₹200
- **Zero Balance**: All settled

## Usage Examples

### Customer Scenario
1. Customer buys goods worth ₹1000 on credit
   - Action: Click 💰 → Select "Add Charge" → Enter ₹1000
   - Result: Balance = ₹1000 (Receivable)

2. Customer pays ₹600
   - Action: Click 💰 → Select "Receive Payment" → Enter ₹600
   - Result: Balance = ₹400 (Receivable)

3. Customer pays remaining ₹400
   - Action: Click 💰 → Select "Receive Payment" → Enter ₹400
   - Result: Balance = ₹0 (Clear)

### Supplier Scenario
1. You purchase goods worth ₹2000 on credit
   - Action: Click 💰 → Select "Add Purchase" → Enter ₹2000
   - Result: Balance = ₹2000 (Payable)

2. You pay ₹1000 to supplier
   - Action: Click 💰 → Select "Make Payment" → Enter ₹1000
   - Result: Balance = ₹1000 (Payable)

3. You pay remaining ₹1000
   - Action: Click 💰 → Select "Make Payment" → Enter ₹1000
   - Result: Balance = ₹0 (Clear)

## Notes

- All monetary values are stored with 2 decimal precision
- Balances are updated in real-time on the frontend after successful transactions
- The balance field is automatically initialized to 0 for new customers/suppliers
- You can add optional descriptions to track what each transaction was for
