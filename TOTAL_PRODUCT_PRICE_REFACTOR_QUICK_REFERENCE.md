# Total Product Price Refactor - Quick Reference

## What Changed

### Before
```
Total Product Price = SUM(cost field)
```
❌ Used selling price
❌ Didn't reflect actual stock
❌ Required manual field updates

### After
```
Total Product Price = Σ(quantity × purchase_rate)
```
✅ Uses purchase price only
✅ Reflects current stock
✅ Calculated from transaction history

---

## Key Changes

### 1. Dashboard Calculation (getDashboardStats)
**File**: `server/controllers/dashboard.controller.js`

```javascript
// Calculate per-product purchase rate
// Multiply by current quantity
// Sum all products
SELECT SUM(p.quantity * COALESCE(r.purchase_rate, 0))
FROM products p
LEFT JOIN (
  SELECT item_id,
         AVG(price / quantity) as purchase_rate
  FROM inventory_item_transactions
  WHERE type = 'PURCHASE'
  GROUP BY item_id
) r ON p.id = r.item_id
```

### 2. Add Product Movement (addProductMovement)
**File**: `server/controllers/product.controller.js`

```javascript
// BEFORE: Updated both quantity AND cost field
UPDATE products SET quantity = ..., cost = ...

// AFTER: Only update quantity
UPDATE products SET quantity = ...
// Note: Cost field removed from update
```

### 3. Update Product Movement (updateProductMovement)
**File**: `server/controllers/product.controller.js`

```javascript
// BEFORE: Reversed and applied cost changes
UPDATE products SET quantity = ..., cost = ...

// AFTER: Only reverse and apply quantity changes
UPDATE products SET quantity = ...
// Note: Cost field removed from update
```

---

## How It Works

1. **User performs action** (buy, sell, edit sale)
   - Product quantity is updated
   - Movement recorded in transaction history

2. **Dashboard recalculates**
   - Gets current quantity from products table
   - Calculates purchase_rate from PURCHASE transactions
   - Multiplies: qty × rate
   - Sums all products

3. **Result displayed**
   - Shows total value of current inventory
   - Based on purchase prices
   - Reflects actual stock in hand

---

## Update Scenarios

| Action | What Happens | Result |
|--------|--------------|--------|
| Buy 100 units at ৳10 | quantity = 100, calculate rate | Total = 100 × 10 = ৳1,000 |
| Sell 20 units | quantity = 80, rate unchanged | Total = 80 × 10 = ৳800 |
| Edit: sell 15 instead | quantity = 85, rate unchanged | Total = 85 × 10 = ৳850 |
| Delete sale | quantity = 100, rate unchanged | Total = 100 × 10 = ৳1,000 |
| New purchase at ৳12 | rate = avg(10,12) = 11, qty = 100 | Total = 100 × 11 = ৳1,100 |

---

## No Changes Needed

✅ Database schema - No new tables or columns
✅ API response - Same `totalProductPrice` field
✅ Frontend UI - No component changes
✅ Translation keys - Already exist
✅ Other statistics - No impact

---

## Testing Checklist

- [ ] Single product with single purchase calculates correctly
- [ ] Sale reduces total (fewer units × same rate)
- [ ] Sale edit updates total (quantity change)
- [ ] Multiple products calculate per-product then sum
- [ ] Different purchase rates per product handled correctly
- [ ] Dashboard auto-updates when inventory changes
- [ ] No selling price affects the calculation
- [ ] Null/zero rates handled with COALESCE
- [ ] Transaction placeholder products excluded
- [ ] Database schema unchanged

---

## Benefits

| Aspect | Improvement |
|--------|------------|
| **Accuracy** | Uses purchase price, not selling price |
| **Reliability** | Based on immutable transaction history |
| **Simplicity** | Single source of truth (transactions) |
| **Maintainability** | No manual field updates needed |
| **Auditability** | Easy to trace back to purchase records |
| **Flexibility** | Handles multiple purchase rates per product |

---

## Files Modified

1. **server/controllers/dashboard.controller.js**
   - Lines 51-65: New totalProductPrice calculation

2. **server/controllers/product.controller.js**
   - Lines 373-383: Simplified addProductMovement
   - Lines 449-480: Simplified updateProductMovement

---

## Formula Explanation

```
Total Product Price = Σ (quantity[i] × purchase_rate[i])

Where:
  quantity[i] = Current stock for product i
  purchase_rate[i] = AVG(price/quantity) for PURCHASE transactions
  Σ = Sum across all products

Example:
  Product A: 50 units × ৳20/unit = ৳1,000
  Product B: 100 units × ৳15/unit = ৳1,500
  Total: ৳1,000 + ৳1,500 = ৳2,500
```

---

## SQL Query Breakdown

```sql
-- Main query
SELECT COALESCE(SUM(p.quantity * COALESCE(r.purchase_rate, 0)), 0) as value

-- From products table
FROM products p

-- Join with calculated purchase rates
LEFT JOIN (
  -- Calculate average purchase rate per product
  SELECT 
    item_id,
    AVG(CASE WHEN quantity > 0 THEN price / quantity ELSE 0 END) as purchase_rate
  FROM inventory_item_transactions
  -- Only PURCHASE transactions
  WHERE type = 'PURCHASE' 
    AND price IS NOT NULL 
    AND price > 0 
    AND quantity > 0
  -- Group by product
  GROUP BY item_id
) r ON p.id = r.item_id

-- Exclude auto-generated transaction placeholders
WHERE p.name NOT LIKE 'Transaction-%'
```

---

## Maintenance Notes

- **Cost field**: Kept in DB for compatibility, no longer updated by movements
- **Backward compatible**: Existing API contracts unchanged
- **No migrations**: Schema remains the same
- **Easy to revert**: Cost field still available if needed

---

## Related Docs

- `TOTAL_PRODUCT_PRICE_REFACTOR_IMPLEMENTATION.md` - Full technical documentation
- `test-total-product-price.js` - Test scenarios and validation
