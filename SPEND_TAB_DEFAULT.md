# Customer Manage Balance Form - Spend Tab Default

## Changes Made

### 1. Default Tab Set to "Spend" (Charge)
- **File:** `client/src/pages/Customers.tsx`
- **Line 44:** `paymentType` state defaults to `'charge'` (already was this, confirmed)
- **Line 827:** Changed row click handler to open modal with `setPaymentType('charge')` instead of `'payment'`
- **Line 876:** Blue button already correctly sets `setPaymentType('charge')`

### 2. Button Labels Updated to Use Translations
- **Line 947-963:** Updated transaction type buttons to use translation keys:
  - Left button: `{t('transaction.givenDebit')}` or 'Spend' (for 'charge')
  - Right button: `{t('transaction.takenCredit')}` or 'Deposit' (for 'payment')
  
### 3. Improved Visual Hierarchy for "Spend"
- **Line 954:** Added gradient and shadow to the active Spend button:
  ```tsx
  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
    paymentType === 'charge'
      ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md'
      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }`}
  ```

## Behavior
1. When customer manage balance form opens, **"Spend" tab is selected by default**
2. The "Spend" button appears on the left with a red/orange gradient when active
3. The "Deposit" button appears on the right with green when active
4. Labels now use localized text from translation files

## Build Status
✅ Production build successful (155.68 kB gzip)
✅ No errors introduced

## Translation Keys Used
- `transaction.givenDebit` → 'Spend' (from line 293 of en.ts)
- `transaction.takenCredit` → 'Deposit' (from line 294 of en.ts)

---
**Date Implemented:** January 7, 2026
