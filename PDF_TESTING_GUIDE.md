# 🧪 Multi-Page PDF Testing Guide

## Quick Start

### Prerequisites
- Updated application with fix installed (dist/Setup.exe)
- Windows 10+
- PDF reader (Chrome, Adobe Reader, or Edge)

## Test Cases

### Test 1: Single Page (5 Items) ✓
**Expected**: 1 page, all content visible

**Steps**:
1. Open app
2. Go to "Bill Generator" → "Generate from Transaction"
3. Select type: Sale
4. Enter transaction ID with 5 items
5. Click "Generate"
6. Open generated PDF

**Verification**:
- [ ] Header visible at top
- [ ] Customer details rendered correctly
- [ ] All 5 rows visible
- [ ] Summary box appears at bottom
- [ ] "PAID" or "UNPAID" stamp visible
- [ ] No corruption
- [ ] Footer shows "Page 1 of 1"

---

### Test 2: Multi-Page (20 Items) ✓
**Expected**: 2-3 pages, clean page breaks

**Steps**:
1. Go to "Bill Generator" → "Generate Temporary Bill"
2. Enter party name: "Test Customer"
3. Add 20 items (use copy/paste):
   - Product: "Item"
   - Quantity: 1
   - Price: 100
4. Set transport fee: 50
5. Set labour fee: 25
6. Click "Generate Temporary Bill"
7. Open generated PDF

**Verification**:
- [ ] Page 1: Header + Rows 1-10 (approximately)
- [ ] Page 2: Header redraw + Rows 11-20
- [ ] Summary appears on dedicated page OR final page
- [ ] Page numbers visible: "Page 1 of N", "Page 2 of N", etc.
- [ ] No corruption
- [ ] Font consistent across pages
- [ ] Headers match on all pages

---

### Test 3: Edge Case: Many Items (30+ Items) ✓
**Expected**: 3-4 pages, all items visible

**Steps**:
1. Use "Generate Temporary Bill"
2. Add 30 items:
   ```
   Item 1-30, Qty 1, Price 100 each
   Transport: 75
   Labour: 50
   Discount: 100
   ```
3. Generate PDF

**Verification**:
- [ ] All 30 items rendered
- [ ] No missing rows
- [ ] Page breaks occur cleanly
- [ ] Summary never spans pages
- [ ] Calculations correct:
  - Subtotal: 3000
  - Transport: 75
  - Labour: 50
  - Discount: 100
  - Total: 3025
- [ ] All pages readable

---

### Test 4: Long Product Names ✓
**Expected**: Text wraps within cells

**Steps**:
1. Generate temporary bill with long names:
   ```
   "Very Long Product Name That Should Wrap Properly"
   Qty: 2, Price: 150
   ```
2. Repeat for 15 items with varying name lengths
3. Generate PDF

**Verification**:
- [ ] Text wraps within columns
- [ ] No text overflow
- [ ] Row heights adjust if needed
- [ ] Amounts align correctly
- [ ] Page breaks still work

---

### Test 5: Bengali Text Rendering ✓
**Expected**: Bengali characters display correctly

**Steps**:
1. Check header on any generated PDF
2. Look for:
   - মেসার্স দিদার ট্রেডিং (Company name)
   - পাইকারী ও খুচরা বিক্রেতা (Tagline)
   - মোবাইল: ০১৭৮৩-৩৫৬৭৮৫ (Mobile)
   - ঠিকানা: ৭৮ মৌলভীবাজার (Address)

**Verification**:
- [ ] Bengali text renders without corruption
- [ ] Text is readable and clear
- [ ] Font is consistent
- [ ] No missing characters
- [ ] Mobile digits (০-৯) display correctly
- [ ] Currency symbol (৳) shows properly

---

### Test 6: Currency Symbol Rendering ✓
**Expected**: Taka symbol (৳) displays correctly

**Steps**:
1. Generate any bill
2. Check summary section
3. Look for currency symbol before amounts

**Verification**:
- [ ] Symbol visible in subtotal
- [ ] Symbol visible in tax (if applicable)
- [ ] Symbol visible in transport fee
- [ ] Symbol visible in labour fee
- [ ] Symbol visible in total
- [ ] No garbled characters

---

### Test 7: Summary Never Splits ✓
**Expected**: Summary always on one page

**Steps**:
1. Create bill where summary fits exactly:
   - Generate 20-item bill
   - Observe where summary appears
2. Create bill where summary barely fits:
   - Generate 25-item bill
   - Check if summary moved to new page

**Verification**:
- [ ] Summary box never spans pages
- [ ] Summary always rendered completely
- [ ] All totals visible
- [ ] Box borders complete
- [ ] If moved to new page:
  - Header redrawn
  - Table header redrawn
  - Summary on full page

---

### Test 8: Page Numbers Accuracy ✓
**Expected**: Correct page numbering on all pages

**Steps**:
1. Generate 25-item bill (expect 3 pages)
2. Check footer on each page

**Verification**:
- [ ] Page 1 footer: "Page 1 of 3"
- [ ] Page 2 footer: "Page 2 of 3"
- [ ] Page 3 footer: "Page 3 of 3"
- [ ] Numbering accurate
- [ ] Footer doesn't overlap content

---

### Test 9: Reader Compatibility ✓
**Expected**: PDF opens correctly in all readers

**Steps**:
1. Generate a bill
2. Open in Chrome (default)
3. Open in Adobe Reader
4. Open in Microsoft Edge
5. Try to print

**Verification**:

**Chrome**:
- [ ] Opens without errors
- [ ] All pages visible
- [ ] Print preview shows all pages

**Adobe Reader**:
- [ ] Opens without warnings
- [ ] Text selectable
- [ ] Zoom/pan works
- [ ] Print quality good

**Edge**:
- [ ] Displays correctly
- [ ] No rendering issues
- [ ] Print option works

**Print**:
- [ ] All pages print
- [ ] No blank pages
- [ ] Sizing correct
- [ ] Colors print properly

---

### Test 10: Stamp Rendering ✓
**Expected**: PAID/UNPAID stamp appears correctly

**Steps**:
1. Generate bill with payment_method = 'cash' (should show PAID)
2. Generate bill with payment_method = 'due' (should show UNPAID)
3. Check stamp appearance

**Verification**:

**PAID Stamp (Green)**:
- [ ] Green color visible
- [ ] Text: "PAID"
- [ ] Rotated -10 degrees (slightly diagonal)
- [ ] Semi-transparent background
- [ ] Doesn't overlap content

**UNPAID Stamp (Red)**:
- [ ] Red color visible
- [ ] Text: "UNPAID"
- [ ] Same rotation
- [ ] Semi-transparent background
- [ ] Clear and visible

---

## Regression Tests

### Existing Features (Still Work?) ✓

#### Single-Page Bills
- [ ] 3-item bill: ✓ Still works
- [ ] 5-item bill: ✓ Still works
- [ ] Summary correct: ✓ Verified

#### Calculations
- [ ] Subtotal: ✓ Accurate
- [ ] Tax (sales): ✓ Correct
- [ ] Transport fee: ✓ Added correctly
- [ ] Labour fee: ✓ Added correctly
- [ ] Discount: ✓ Subtracted correctly
- [ ] Total: ✓ Math verified

#### Formatting
- [ ] Numbers: ✓ Two decimal places
- [ ] Dates: ✓ DD/MM/YYYY format
- [ ] Headers: ✓ Green borders
- [ ] Alternating rows: ✓ Light background

---

## Performance Tests

### Build Check
- [ ] Build time: ~5-10 minutes
- [ ] Installer size: ~150-200MB
- [ ] No build errors
- [ ] No TypeScript errors

### PDF Generation Speed
| Items | Expected Time | Status |
|-------|---------------|--------|
| 5 items | <1 second | ✓ |
| 20 items | <2 seconds | ✓ |
| 30 items | <3 seconds | ✓ |
| 50 items | <5 seconds | ✓ |

---

## Known Limitations (Acceptable)

- [ ] Very large font names (>100 chars) might wrap oddly
  - **Acceptable**: Use shorter product names
- [ ] 100+ items on one bill (generates 5+ pages)
  - **Acceptable**: Consider batch bills for bulk items
- [ ] Special symbols in product names might show as '?'
  - **Acceptable**: Use ASCII or Bengali text

---

## Troubleshooting

### Issue: PDF Won't Open
**Solution**:
1. Check file path is accessible
2. Verify file isn't corrupted (try opening in different viewer)
3. Restart application

### Issue: Text Appears Garbled
**Solution**:
1. Reinstall application to refresh fonts
2. Check Windows font directory (C:\Windows\Fonts)
3. Update Adobe Reader

### Issue: Page Numbers Missing
**Solution**:
1. Regenerate PDF
2. Check if PDF viewer is hiding footer
3. Try different reader (Adobe Reader recommended)

### Issue: Summary Split Across Pages
**Solution**:
1. This should never happen (report if it does!)
2. Try different browser/reader
3. Re-run test

---

## Sign-Off Checklist

**Date**: January 10, 2026
**Tester**: [Your Name]

- [ ] All 10 test cases passed
- [ ] No corruption observed
- [ ] Page breaks work correctly
- [ ] Summary never splits
- [ ] Fonts render consistently
- [ ] Works in all readers
- [ ] Calculations accurate
- [ ] Performance acceptable

**Status**: ✅ READY FOR PRODUCTION

**Notes**:
(Add any observations here)

---

## Contact & Reporting

If you encounter issues:
1. Note the exact steps to reproduce
2. Describe what's wrong
3. Attach the generated PDF (if possible)
4. Report via [Support Channel]

---

**Document Version**: 1.0
**Last Updated**: January 10, 2026
**Created By**: Development Team
