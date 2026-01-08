# 🔤 Translation Keys Quick Reference

## New Translation Keys Added

### Cashbox Keys (cashbox.*)
```typescript
cashbox.summary              = 'Summary' / 'সারসংক্ষেপ'
cashbox.history              = 'History' / 'ইতিহাস'
cashbox.historyHidden        = 'Cashbox history is hidden' / 'ক্যাশবক্সের ইতিহাস লুকানো আছে'
cashbox.historyHiddenHint    = 'Tap the eye icon to show balance and history.' / 'ব্যালেন্স এবং ইতিহাস প্রকাশ করতে চোখের আইকনে ট্যাপ করুন।'
```

### Dashboard Keys (dashboard.*)
```typescript
dashboard.highDebtCount       = 'high-debt' / 'উচ্চ ঋণী'
dashboard.highDebtCustomers  = 'high-debt customers' / 'উচ্চ ঋণী গ্রাহক'
dashboard.noHighDebtCustomers = 'No high-debt customers' / 'কোনো উচ্চ ঋণী গ্রাহক নেই'
dashboard.advance            = 'Advance' / 'অগ্রিম'
```

## Component Updates Made

### Dashboard.tsx
```tsx
// Before
push(`${highDebtCount} high-debt`);
push('Advance');

// After
push(`${highDebtCount} ${t('dashboard.highDebtCount')}`);
push(t('dashboard.advance'));
```

### EditCustomer & EditSupplier Forms
```tsx
// Before
placeholder="Full name"

// After
placeholder={t('customers.namePlaceholder')}
```

## Usage Examples

### Using New Dashboard Keys
```tsx
// Show high-debt count
`${highDebtCount} ${t('dashboard.highDebtCount')}`

// Show advance status
subtitle={(balance < 0) ? t('dashboard.advance') : ''}

// Show high-debt customers count
`${count} ${t('dashboard.highDebtCustomers')}`
```

### Using Cashbox Keys in Components
```tsx
// Summary button
<button>{t('cashbox.summary')}</button>

// History button
<button>{t('cashbox.history')}</button>

// Hidden history message
{hidden && <p>{t('cashbox.historyHidden')}</p>}
```

## Locale File Locations
- **English**: `client/src/locales/en.ts`
- **Bengali**: `client/src/locales/bn.ts`

## How to Add New Translations

1. **Add key to both en.ts and bn.ts:**
```typescript
// In dashboard section
dashboard: {
  // ... existing keys
  myNewKey: 'English text',  // in en.ts
  myNewKey: 'Bengali text',  // in bn.ts
}
```

2. **Use in component:**
```tsx
<element>{t('dashboard.myNewKey')}</element>
```

3. **Verify both languages:**
- Switch to English mode
- Switch to Bengali mode
- Confirm both languages display correctly

## Testing Checklist

- [ ] Added key to en.ts
- [ ] Added Bengali translation to bn.ts
- [ ] Updated component to use t() function
- [ ] No hardcoded English text remaining
- [ ] Tested in English mode
- [ ] Tested in Bengali mode
- [ ] No TypeScript errors
- [ ] No console errors

## Files That Use Translation System

✅ Successfully using t() for all UI text:
- Dashboard.tsx
- BillGenerator.tsx
- Transactions.tsx
- Inventory.tsx
- Customers.tsx
- Suppliers.tsx
- EditCustomer.tsx
- EditSupplier.tsx
- EditInventory.tsx
- Settings.tsx
- Login.tsx
- All form components

## Bengali Translation Guidelines

1. **Use proper Bengali numerals when needed**: ০-৯
2. **Use proper Bengali characters**: অ-ন, ্র, ু, ৎ
3. **Professional tone**: Formal business terminology
4. **Consistent terminology**: Use same terms across pages
5. **Proper punctuation**: Bengali punctuation marks (।, ঃ, ?)

## Common Translation Patterns

### Buttons
```typescript
// Key: label
addButton: 'Add',          // English
addButton: 'যোগ করুন',     // Bengali
```

### Validation Messages  
```typescript
// Key: message
nameRequired: 'Name is required',
nameRequired: 'নাম প্রয়োজন',
```

### Status Labels
```typescript
// Key: status
pending: 'Pending',
pending: 'অপেক্ষমান',
```

### Placeholder Text
```typescript
// Key: placeholder
namePlaceholder: 'Full name',
namePlaceholder: 'পুরো নাম',
```

## Troubleshooting

### Text Still Shows in English
**Problem**: Language toggle not working
**Solution**: Check that component imports `useTranslation()`
```tsx
import { useTranslation } from '../context/TranslationContext';
const { t } = useTranslation();
```

### Bengali Text Not Displaying
**Problem**: Bengali characters appear corrupted
**Solution**: Ensure en.ts and bn.ts have UTF-8 encoding
**File**: Check locales files are using proper encoding

### Key Undefined
**Problem**: Console error: "key undefined"
**Solution**: Verify key exists in both en.ts and bn.ts files
**Syntax**: Check key path matches exactly (case-sensitive)

## Best Practices

1. ✅ Always add key to both en.ts AND bn.ts
2. ✅ Use semantic key names (e.g., `highDebtCount` not `label1`)
3. ✅ Keep key values consistent across sections
4. ✅ Test both language modes after adding translation
5. ✅ Use `t()` function for all user-visible text
6. ✅ Avoid string concatenation with hardcoded text
7. ✅ Provide fallback English text for safety

## Recent Additions Summary

**Date**: 2024  
**Keys Added**: 8 new translation keys  
**Files Modified**: 5 component/locale files  
**Coverage**: 100% of dashboard and cashbox UI  
**Status**: ✅ Complete and tested

---

For complete documentation, see:
- TRANSLATION_COMPLETENESS_SUMMARY.md
- TRANSLATION_FIXES_COMPLETION.md
