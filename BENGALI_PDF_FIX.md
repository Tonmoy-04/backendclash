# Bengali Font Support in PDF Bills - Fix Documentation

## Problem
When users entered Bengali text in customer names or item names, the PDF bills displayed corrupted/garbled text instead of properly rendered Bengali characters.

Example of the issue:
```
Name: ম EFES%-UCѕ  (corrupted)
```

## Root Cause
The PDF generation code was using only the Helvetica font for all text content, including customer names and item names. Helvetica doesn't support Bengali Unicode characters (U+0980-U+09FF), resulting in corrupted output.

## Solution Implemented

### 1. Added Bengali Character Detection Function
Created `containsBengaliText()` function that detects if a string contains Bengali or Devanagari characters by checking Unicode ranges:
- Bengali: U+0980 to U+09FF
- Devanagari: U+0900 to U+097F

### 2. Conditional Font Selection
Modified the PDF generation to:
- Check if text contains Bengali characters using `containsBengaliText()`
- If Bengali characters are detected and a Unicode font is available, switch to Unicode font (e.g., NotoSansBengaliUI-Regular.ttf)
- If no Bengali characters, use Helvetica as before

### 3. Applied to Two Critical Areas

#### A. Customer/Party Name (Line 204-211)
```javascript
if (fontInfo.loaded && containsBengaliText(party)) {
  doc.font('unicode').fontSize(9).fillColor('#333');
  doc.text(`Name: ${party}`, ...);
} else {
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  doc.text(`Name: ${party}`, ...);
}
```

#### B. Item Names in Bill Table (Line 247-259)
```javascript
if (fontInfo.loaded && containsBengaliText(name)) {
  doc.font('unicode').fontSize(8).fillColor('#000');
  // render with unicode font
} else {
  doc.font('Helvetica').fontSize(8).fillColor('#000');
  // render with helvetica font
}
```

## Requirements
- A Bengali-supporting font must be installed:
  - `NotoSansBengaliUI-Regular.ttf` (preferred)
  - `NotoSansBengali-Regular.ttf`
  - `NotoSerifBengali-Regular.ttf`
  - `Nirmala.ttf` (Windows)
  - `Vrinda.ttf` (Windows)

Place these fonts in: `server/config/fonts/`

Or they will be auto-detected from Windows Fonts folder: `C:\Windows\Fonts\`

## Testing
To verify the fix:
1. Create a new transaction with a Bengali customer name
2. Generate a PDF bill
3. Check that the Bengali text in the "Name:" field is properly rendered
4. Create items with Bengali names and verify they render correctly in the bill table

## Files Modified
- `server/utils/billGenerator.js`
  - Added `containsBengaliText()` function
  - Updated customer name rendering logic
  - Updated item name rendering logic

## Backward Compatibility
- ✅ Fully backward compatible
- English and mixed-text names continue to work
- No changes to PDF structure or layout
- Automatic font switching is transparent to users
