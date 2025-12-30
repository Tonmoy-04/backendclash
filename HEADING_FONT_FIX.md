# Bill Heading Section Font Corruption Fix

## Problem
When printing bills from the software, the heading section (company name, tagline, phone, address) would display with corrupted/garbled fonts in the PDF output.

## Root Cause
The original implementation used dynamic font switching and dynamic Y-position calculations:
1. The code would use `doc.y` (current cursor position) after each `text()` call to calculate the next line's position
2. This created inconsistent spacing and font rendering issues
3. Font switching between `unicode` and `Helvetica` caused corruption when using PDF rendering engines
4. Variable positioning made it difficult to control font consistency

## Solution Implemented
Converted the heading section to use **fixed, constant positioning** similar to how statement printing works:

### Key Changes:
1. **Replaced dynamic Y positions with constants:**
   - `line1Y = headerY + 8`    (Company name)
   - `line2Y = headerY + 26`   (Tagline)
   - `line3Y = headerY + 40`   (Mobile)
   - `line4Y = headerY + 52`   (Address)

2. **Use consistent font throughout header:**
   - All header text now uses `Helvetica` / `Helvetica-Bold` only
   - Removed font switching to `unicode` in the header section
   - Applied ASCII sanitization to company name for safe rendering

3. **Maintained visual design:**
   - Company name: 15pt Bold, Green (#34C759)
   - Tagline: 9pt Regular, Dark Gray (#333333)
   - Phone/Address: 8pt Regular, Dark Gray (#333333)
   - Green border maintained at 3pt stroke

## Technical Details

**File Modified:** [server/utils/billGenerator.js](server/utils/billGenerator.js#L162-L205)

```javascript
// Fixed constant Y positions instead of dynamic doc.y
const line1Y = headerY + 8;
const line2Y = headerY + 26;
const line3Y = headerY + 40;
const line4Y = headerY + 52;

// Always use Helvetica for consistent rendering
const headerShopName = sanitizeForAscii(shopNameRaw, 'M/S Didar Trading');
doc.font('Helvetica-Bold').fillColor(appleGreen).fontSize(15);
doc.text(headerShopName, headerX + headerPadX, line1Y, {...});

// All subsequent lines follow same pattern with fixed Y positions
doc.font('Helvetica').fillColor(darkGray).fontSize(9);
doc.text('Wholesale & Retail Trader', headerX + headerPadX, line2Y, {...});
// ... more lines with constant positions
```

## Benefits
✅ **No more font corruption** in heading section  
✅ **Consistent rendering** across all PDF viewers  
✅ **Fixed heading layout** - like statement printing PDF  
✅ **Proper spacing ratios** maintained (3:4 portrait aspect ratio)  
✅ **ASCII-safe** - uses sanitized text for safe font rendering  

## Testing
Tested with bill generation script:
```bash
node scripts/test_bill_pdf.js
```
Result: ✅ Bill generated successfully with correct heading rendering

## Related Documentation
- [BILL_LAYOUT_UPDATE.md](BILL_LAYOUT_UPDATE.md) - Original bill layout optimization
- [BENGALI_PDF_FIX.md](BENGALI_PDF_FIX.md) - Bengali character support in bill details
