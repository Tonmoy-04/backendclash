const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function openFileWindows(filePath) {
  try {
    spawn('cmd', ['/c', 'start', '', filePath], { detached: true, stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to auto-open PDF:', e);
  }
}

function getShopName() {
  try {
    const settingsPath = resolveConfigPath('settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const json = JSON.parse(raw);
      return json.companyName || json.shopName || 'M/S Didar Trading';
    }
  } catch (e) {
    // ignore
  }
  return process.env.SHOP_NAME || 'M/S Didar Trading';
}

function getCurrencySymbol() {
  try {
    const settingsPath = resolveConfigPath('settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const json = JSON.parse(raw);
      if (json.currencySymbol && typeof json.currencySymbol === 'string') {
        return json.currencySymbol;
      }
    }
  } catch {}
  return '৳';
}

function sanitizeForAscii(text, fallback = '') {
  if (text === undefined || text === null) return fallback;
  const str = String(text);
  if (!/[^\u0000-\u007F]/.test(str)) return str;
  return str.replace(/[^\u0000-\u007F]/g, '').trim() || fallback;
}

function resolveConfigPath(...segments) {
  // Works in both layouts:
  // - Source: server/utils -> server/config
  // - Built:  server/dist/utils -> server/config
  const candidates = [
    path.join(__dirname, '..', 'config', ...segments),
    path.join(__dirname, '..', '..', 'config', ...segments),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function selectUnicodeFont(doc) {
  try {
    const fontsDir = resolveConfigPath('fonts');
    const candidates = [
      'NotoSerifBengali-Regular.ttf',
      'NotoSansBengaliUI-Regular.ttf', // preferred (UI) to avoid shaping issues
      'NotoSansBengali-Regular.ttf',
      'NotoSansBengali.ttf',
      'Nirmala.ttf',
      'Vrinda.ttf'
    ];
    for (const name of candidates) {
      const p = path.join(fontsDir, name);
      if (fs.existsSync(p)) {
        doc.registerFont('unicode', p);
        // Try to load a bold sibling for better header emphasis
        let boldLoaded = false;
        const boldSibling = p.replace(/Regular/i, 'Bold').replace(/-BoldBold/i, '-Bold');
        if (boldSibling !== p && fs.existsSync(boldSibling)) {
          doc.registerFont('unicode-bold', boldSibling);
          boldLoaded = true;
        }
        doc.font('unicode');
        return { loaded: true, boldLoaded, path: p };
      }
    }
    const winFonts = [
      path.join('C:\\Windows\\Fonts', 'Nirmala.ttf'),
      path.join('C:\\Windows\\Fonts', 'Vrinda.ttf')
    ];
    for (const p of winFonts) {
      if (fs.existsSync(p)) {
        doc.registerFont('unicode', p);
        doc.font('unicode');
        return { loaded: true, boldLoaded: false, path: p };
      }
    }
  } catch (e) {
    // ignore
  }
  return { loaded: false, boldLoaded: false };
}

  /**
   * Detect if text contains Bengali/Devanagari characters
   */
  function containsBengaliText(text) {
    if (!text || typeof text !== 'string') return false;
    // Bengali Unicode range: 0x0980-0x09FF
    // Devanagari Unicode range: 0x0900-0x097F
    const bengaliPattern = /[\u0980-\u09FF\u0900-\u097F]/;
    return bengaliPattern.test(text);
  }
function formatCurrency(amount, symbol = '') {
  const n = Number(amount);
  const val = Number.isFinite(n) ? n : 0;
  return symbol ? `${symbol}${val.toFixed(2)}` : `${val.toFixed(2)}`;
}

function generateBill({ type, transaction, items, currencySymbol, adjustment = 0, transport_fee = 0, labour_fee = 0, address = '', description = '' }) {
  const home = os.homedir();
  const billsDir = path.join(home, 'Documents', 'InventoryApp', 'Bills');
  ensureDir(billsDir);

  const prefix = type === 'sale' ? 'INV' : 'PUR';
  const memoNumber = `${prefix}-${String(transaction.id).padStart(6, '0')}`;
  const fileName = `${memoNumber}-${Date.now()}.pdf`;
  const filePath = path.join(billsDir, fileName);

  // 3:4 portrait ratio size (450 x 600 points = 6.25 x 8.33 inches)
  const size = [450, 600];
  const margin = 22;
  const doc = new PDFDocument({ size, margin, layout: 'portrait', bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ===== CONSTANTS & CONFIGURATION =====
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const appleGreen = '#34C759';
  const darkGray = '#333333';
  const lightGray = '#f3f4f6';
  const veryLightGreen = '#f0fdf4';
  const borderGray = '#e5e7eb';
  
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const marginTop = doc.page.margins.top;
  const marginBottom = doc.page.margins.bottom;
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;

  // Table dimensions
  const tableLeft = marginLeft;
  const colWidths = {
    no: 25,
    item: usableWidth - 25 - 40 - 55,
    qty: 40,
    amount: 55
  };

  const tableHeaderHeight = 20;
  const tableRowHeight = 16;
  const footerHeight = 30; // Space reserved for footer

  // Summary box dimensions
  const summaryBoxW = 200;
  const summaryBoxTopPadding = 8;
  const summaryBoxBottomPadding = 8;
  const summaryLineHeight = 14;
  const summaryTotalLineHeight = 16;

  // ===== FONT SETUP (Once at start) =====
  let symbol = currencySymbol || getCurrencySymbol();
  const fontInfo = selectUnicodeFont(doc);
  if (!fontInfo.loaded) {
    doc.font('Helvetica');
    const isAscii = typeof symbol === 'string' && !/[^\u0000-\u007F]/.test(symbol);
    if (!isAscii) {
      symbol = 'Tk';
    }
  }

  const shopNameRaw = getShopName();
  const shopName = fontInfo.loaded ? shopNameRaw : sanitizeForAscii(shopNameRaw, 'M/S Didar Trading');
  const displaySymbol = fontInfo.loaded ? symbol : (/[^\u0000-\u007F]/.test(symbol) ? 'Tk' : symbol);
  const symbolIsNonAscii = typeof displaySymbol === 'string' && /[^\u0000-\u007F]/.test(displaySymbol);

  const formatDate = (value) => {
    const d = value ? new Date(value) : new Date();
    const date = d.toLocaleDateString('en-GB');
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${time}`;
  };

  // ===== HELPER: Draw header (for first page and page breaks) =====
  function drawHeader(yPos) {
    const headerX = marginLeft;
    const headerW = usableWidth;
    const headerH = 95;

    // Header border
    doc.lineWidth(2.5).strokeColor(appleGreen);
    if (typeof doc.roundedRect === 'function') {
      doc.roundedRect(headerX, yPos, headerW, headerH, 8).stroke();
    } else {
      doc.rect(headerX, yPos, headerW, headerH).stroke();
    }

    // Set font for header text
    if (fontInfo.loaded) {
      doc.font('unicode');
    } else {
      doc.font('Helvetica');
    }

    const headerPadX = 8;
    const line1Y = yPos + 8;
    const line2Y = yPos + 30;
    const line3Y = yPos + 40;
    const line4Y = yPos + 52;
    const line5Y = yPos + 64;

    // Line 1: Company name (Bengali bold)
    doc.font(fontInfo.loaded && fontInfo.boldLoaded ? 'unicode-bold' : (fontInfo.loaded ? 'unicode' : 'Helvetica-Bold'));
    doc.fillColor(appleGreen).fontSize(16);
    doc.text('মেসার্স দিদার ট্রেডিং', headerX + headerPadX, line1Y, { width: headerW - headerPadX * 2, align: 'center' });

    // Switch to regular font for remaining lines
    if (fontInfo.loaded) {
      doc.font('unicode');
    } else {
      doc.font('Helvetica');
    }
    doc.fillColor(darkGray);

    // Line 2: Product line (Bengali)
    doc.fontSize(8.5);
    doc.text('এলাচি,দারচিনি, জিরা, লবঙ্গ, কিসমিস,জাফরান,সোডা,বার্লি,বেনেতী পসারী', headerX + headerPadX, line2Y, { width: headerW - headerPadX * 2, align: 'center' });

    // Line 3: Tagline (Bengali)
    doc.fontSize(9);
    doc.text('পাইকারী ও খুচরা বিক্রেতা', headerX + headerPadX, line3Y, { width: headerW - headerPadX * 2, align: 'center' });

    // Line 4: Mobile (Bengali)
    doc.fontSize(8.5);
    doc.text('মোবাইল: ০১৭৮৩-৩৫৬৭৮৫, ০১৯২১-৯৯৩১৫৬', headerX + headerPadX, line4Y, { width: headerW - headerPadX * 2, align: 'center' });

    // Line 5: Address (Bengali)
    doc.fontSize(8.5);
    doc.text('ঠিকানা: ৭৮ মৌলভীবাজার, ট্রেড সেন্টার, ঢাকা-১২১১', headerX + headerPadX, line5Y, { width: headerW - headerPadX * 2, align: 'center' });

    // Reset font to Helvetica after header
    doc.font('Helvetica').fillColor(darkGray);

    return yPos + headerH + 12;
  }

  // ===== HELPER: Draw table header =====
  function drawTableHeader(yPos) {
    doc.rect(tableLeft, yPos, usableWidth, tableHeaderHeight).fill(lightGray);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(appleGreen);

    doc.text('#', tableLeft + 6, yPos + 6, { width: colWidths.no - 6, align: 'left' });
    doc.text('Item', tableLeft + colWidths.no + 6, yPos + 6, { width: colWidths.item - 6, align: 'left' });
    doc.text('Qty', tableLeft + colWidths.no + colWidths.item + 4, yPos + 6, { width: colWidths.qty - 4, align: 'right' });
    doc.text('Amount', tableLeft + colWidths.no + colWidths.item + colWidths.qty + 4, yPos + 6, { width: colWidths.amount - 4, align: 'right' });

    return yPos + tableHeaderHeight;
  }

  // ===== HELPER: Draw footer =====
  function drawFooter(yPos, pageNum, totalPages) {
    doc.font('Helvetica').fontSize(9).fillColor(darkGray);
    const footerText = `Page ${pageNum} of ${totalPages}`;
    const footerX = marginLeft + usableWidth - doc.widthOfString(footerText) - 10;
    doc.text(footerText, footerX, pageHeight - marginBottom + 10, { align: 'right' });
  }

  // ===== HELPER: Draw description section =====
  function drawDescription(yPos) {
    if (!description || !String(description).trim()) {
      return;
    }
    
    const descriptionText = String(description).trim();
    const descFontSize = 8;
    
    doc.font('Helvetica-Bold').fontSize(descFontSize).fillColor(darkGray);
    doc.text('Description:', marginLeft, yPos, { continued: false });
    
    const labelHeight = doc.heightOfString('Description:', { width: usableWidth });
    const descY = yPos + labelHeight + 2;
    
    doc.font('Helvetica-Oblique').fontSize(descFontSize).fillColor(darkGray).opacity(0.75);
    doc.text(descriptionText, marginLeft, descY, { 
      width: usableWidth, 
      align: 'left', 
      lineGap: 1,
      continued: false
    });
    doc.opacity(1);
  }

  // ===== HELPER: Calculate summary box height =====
  function calculateSummaryHeight() {
    let lineCount = 1; // Subtotal
    const tax = Number.isFinite(Number(transaction.tax)) ? Number(transaction.tax) : 0;
    const transportVal = Number.isFinite(Number(transport_fee)) ? Number(transport_fee) : 0;
    const labourVal = Number.isFinite(Number(labour_fee)) ? Number(labour_fee) : 0;

    if (type === 'sale' && tax > 0) lineCount++;
    if (transportVal > 0) lineCount++;
    if (labourVal > 0) lineCount++;

    return summaryBoxTopPadding + (lineCount * summaryLineHeight) + summaryTotalLineHeight + summaryBoxBottomPadding;
  }

  // ===== HELPER: Check if Y position is near page end & trigger new page =====
  function ensureSpace(requiredHeight) {
    const currentY = doc.y;
    const availableSpace = pageHeight - marginBottom - footerHeight - currentY;
    if (availableSpace < requiredHeight) {
      doc.addPage();
      const newY = drawHeader(marginTop);
      drawTableHeader(newY + 20);
      return newY + tableHeaderHeight + 43; // Return Y after new header and table header
    }
    return currentY;
  }

  // ===== MAIN LAYOUT =====
  // Page 1: Header + Customer Details + Table Header
  let y = drawHeader(marginTop);

  // Invoice/Purchase details section
  doc.font('Helvetica').fontSize(10).fillColor(darkGray);
  const billType = type === 'sale' ? 'Invoice' : 'Purchase Order';
  doc.text(`${billType}: ${memoNumber}`, marginLeft, y);
  y = doc.y + 3;
  doc.text(`Date: ${formatDate(transaction.date || Date.now())}`, marginLeft, y);
  y = doc.y + 10;

  // Customer/Party details box
  const customerBoxHeight = 55;
  const customerBoxX = marginLeft;
  const customerBoxY = y;

  doc.rect(customerBoxX, customerBoxY, usableWidth, customerBoxHeight).fill(veryLightGreen);
  doc.lineWidth(2.5).strokeColor(appleGreen);
  doc.moveTo(customerBoxX, customerBoxY).lineTo(customerBoxX, customerBoxY + customerBoxHeight).stroke();

  let partyRaw = transaction.party && String(transaction.party).trim() ? String(transaction.party).trim() : 'N/A';
  const party = partyRaw.replace(/^\s*(নাম[:ঃ]\s*)/i, '').trim() || 'N/A';
  const hasAddress = address && String(address).trim();

  const customerPadX = 12;
  let customerY = customerBoxY + 10;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(appleGreen);
  doc.text('Customer Details', customerBoxX + customerPadX, customerY);

  customerY = doc.y + 5;

  doc.font('Helvetica').fontSize(10).fillColor(darkGray);
  doc.text('Name: ', customerBoxX + customerPadX, customerY, { continued: true });

  if (fontInfo.loaded && containsBengaliText(party)) {
    doc.font('unicode').fontSize(10).fillColor(darkGray);
    doc.text(party, { continued: false });
  } else {
    doc.font('Helvetica').fontSize(10).fillColor(darkGray);
    doc.text(party, { continued: false });
  }

  // Display address below name if it exists
  if (hasAddress) {
    customerY = doc.y + 3;
    doc.font('Helvetica').fontSize(8.5).fillColor('#666666');
    const addressText = String(address).trim();
    doc.text(addressText, customerBoxX + customerPadX, customerY, { width: usableWidth - customerPadX * 2, align: 'left', lineGap: 1 });
  }

  y = customerBoxY + customerBoxHeight + 10;

  // Draw table header
  const tableHeaderY = y;
  doc.rect(tableLeft, tableHeaderY, usableWidth, tableHeaderHeight).fill(lightGray);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(appleGreen);

  doc.text('#', tableLeft + 6, tableHeaderY + 6, { width: colWidths.no - 6, align: 'left' });
  doc.text('Item', tableLeft + colWidths.no + 6, tableHeaderY + 6, { width: colWidths.item - 6, align: 'left' });
  doc.text('Qty', tableLeft + colWidths.no + colWidths.item + 4, tableHeaderY + 6, { width: colWidths.qty - 4, align: 'right' });
  doc.text('Amount', tableLeft + colWidths.no + colWidths.item + colWidths.qty + 4, tableHeaderY + 6, { width: colWidths.amount - 4, align: 'right' });

  y = tableHeaderY + tableHeaderHeight;

  // ===== RENDER TABLE ROWS WITH PAGE BREAK DETECTION =====
  const safeItems = Array.isArray(items) && items.length ? items : [];
  let itemIndex = 0;

  while (itemIndex < safeItems.length) {
    const it = safeItems[itemIndex];
    const name = it?.product_name && String(it.product_name).trim() ? String(it.product_name).trim() : 'N/A';
    const qtyNum = Number(it?.quantity);
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? String(qtyNum) : '';

    const subRaw = Number(it?.subtotal);
    const unitRaw = it?.price ?? it?.cost;
    const unitVal = Number(unitRaw);
    const hasUnit = Number.isFinite(unitVal);
    const computedSub = hasUnit && Number.isFinite(qtyNum) ? unitVal * qtyNum : NaN;
    const subVal = Number.isFinite(subRaw) ? subRaw : computedSub;
    const amount = Number.isFinite(subVal) ? formatCurrency(subVal, displaySymbol) : '';

    // Check if space is available for this row - only for last 2 items
    const currentY = doc.y;
    const availableSpace = pageHeight - marginBottom - footerHeight - currentY;
    
    // Only check space constraints for last 2 items when summary is about to be drawn
    const isVeryEnd = (safeItems.length - itemIndex) <= 2;
    const spaceNeeded = tableRowHeight + (isVeryEnd ? calculateSummaryHeight() + 150 : tableRowHeight);

    if (isVeryEnd && availableSpace < spaceNeeded) {
      // Not enough space: create new page
      doc.addPage();
      const newHeaderY = drawHeader(marginTop);
      drawTableHeader(newHeaderY + 20);
      y = newHeaderY + tableHeaderHeight + 42;
    } else {
      y = currentY;
    }

    // Render the row
    if (itemIndex % 2 === 0) {
      doc.rect(tableLeft, y - 2, usableWidth, tableRowHeight).fill('#fafafa');
    }

    doc.font('Helvetica').fontSize(9).fillColor(darkGray);
    doc.text(String(itemIndex + 1), tableLeft + 6, y, { width: colWidths.no - 6, align: 'left' });

    if (fontInfo.loaded && containsBengaliText(name)) {
      doc.font('unicode');
    }
    doc.text(name, tableLeft + colWidths.no + 6, y, { width: colWidths.item - 6, align: 'left' });
    doc.font('Helvetica');

    doc.text(qty, tableLeft + colWidths.no + colWidths.item + 4, y, { width: colWidths.qty - 4, align: 'right' });

    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(amount, tableLeft + colWidths.no + colWidths.item + colWidths.qty + 4, y, { width: colWidths.amount - 4, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(amount, tableLeft + colWidths.no + colWidths.item + colWidths.qty + 4, y, { width: colWidths.amount - 4, align: 'right' });
    }

    y += tableRowHeight;
    itemIndex++;
  }

  // Add separator line after table
  y += 10;
  doc.strokeColor(borderGray).lineWidth(1);
  doc.moveTo(tableLeft, y).lineTo(tableLeft + usableWidth, y).stroke();
  y += 20;

  // ===== SUMMARY SECTION: Draw on current page unless not enough space =====
  const summaryBoxH = calculateSummaryHeight();
  const summaryBoxX = tableLeft + usableWidth - summaryBoxW;

  // Check if summary fits on current page
  const availableSpaceSummary = pageHeight - marginBottom - footerHeight - y;
  const totalSpaceNeeded = summaryBoxH + 100; // Summary + stamp + description
  
  if (availableSpaceSummary < totalSpaceNeeded && y > marginTop + 200) {
    // Only add new page if we're already well into the current page
    doc.addPage();
    y = drawHeader(marginTop);
    drawTableHeader(y + 20);
    y = y + tableHeaderHeight + 42; // Position after header
  }

  // Calculate totals
  const subtotalCalc = (items || []).reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
  const subtotal = Number.isFinite(Number(transaction.subtotal)) ? Number(transaction.subtotal) : subtotalCalc;
  const tax = Number.isFinite(Number(transaction.tax)) ? Number(transaction.tax) : 0;
  const grossTotal = Number.isFinite(Number(transaction.total)) ? Number(transaction.total) : (subtotal + tax);
  const transportVal = Number.isFinite(Number(transport_fee)) ? Number(transport_fee) : 0;
  const labourVal = Number.isFinite(Number(labour_fee)) ? Number(labour_fee) : 0;
  const netTotal = grossTotal + transportVal + labourVal;

  // Draw summary box
  doc.rect(summaryBoxX, y, summaryBoxW, summaryBoxH).fill(veryLightGreen);
  doc.strokeColor(appleGreen).lineWidth(2.5);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(summaryBoxX, y, summaryBoxW, summaryBoxH, 5).stroke();
  } else {
    doc.rect(summaryBoxX, y, summaryBoxW, summaryBoxH).stroke();
  }

  let summaryY = y + summaryBoxTopPadding;
  doc.font('Helvetica').fontSize(9).fillColor(darkGray);

  // Subtotal
  doc.text('Subtotal:', summaryBoxX + 10, summaryY, { continued: false });
  if (symbolIsNonAscii && fontInfo.loaded) {
    doc.font('unicode');
    doc.text(formatCurrency(subtotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    doc.font('Helvetica');
  } else {
    doc.text(formatCurrency(subtotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
  }
  summaryY += summaryLineHeight;

  // Tax
  if (type === 'sale' && tax > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(darkGray);
    doc.text('Tax:', summaryBoxX + 10, summaryY, { continued: false });
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(tax, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(tax, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += summaryLineHeight;
  }

  // Transport Fee
  if (transportVal > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(darkGray);
    doc.text('Transport:', summaryBoxX + 10, summaryY, { continued: false });
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(transportVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(transportVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += summaryLineHeight;
  }

  // Labour Fee
  if (labourVal > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(darkGray);
    doc.text('Labour:', summaryBoxX + 10, summaryY, { continued: false });
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(labourVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(labourVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += summaryLineHeight;
  }

  // Discount removed from summary display

  // Separator line before total
  summaryY += 2;
  doc.strokeColor(appleGreen).lineWidth(1);
  doc.moveTo(summaryBoxX + 12, summaryY).lineTo(summaryBoxX + summaryBoxW - 12, summaryY).stroke();
  summaryY += 6;

  // Total (bold and highlighted)
  doc.font('Helvetica-Bold').fontSize(12).fillColor(appleGreen);
  doc.text('Total:', summaryBoxX + 12, summaryY, { continued: false });
  if (symbolIsNonAscii && fontInfo.loaded) {
    doc.font('unicode');
    doc.text(formatCurrency(netTotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    doc.font('Helvetica');
  } else {
    doc.text(formatCurrency(netTotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
  }

  // Add "Paid" or "Unpaid" stamp based on payment method
  const paymentMethod = transaction.payment_method ? String(transaction.payment_method).toLowerCase().trim() : '';
  const isDue = paymentMethod === 'due' || paymentMethod === 'বাকি';
  const stampText = isDue ? 'UNPAID' : 'PAID';
  const stampColor = isDue ? '#EF4444' : '#10B981';

  const stampX = marginLeft + usableWidth - 120;
  const stampY = y + summaryBoxH + 20;
  const stampW = 100;
  const stampH = 40;

  doc.save();
  doc.translate(stampX + stampW / 2, stampY + stampH / 2);
  doc.rotate(-10);

  doc.opacity(0.15);
  doc.rect(-stampW / 2, -stampH / 2, stampW, stampH).fill(stampColor);
  doc.opacity(1);

  doc.lineWidth(3).strokeColor(stampColor);
  doc.rect(-stampW / 2, -stampH / 2, stampW, stampH).stroke();
  doc.lineWidth(1.5);
  doc.rect(-stampW / 2 + 4, -stampH / 2 + 4, stampW - 8, stampH - 8).stroke();

  doc.font('Helvetica-Bold').fontSize(20).fillColor(stampColor);
  doc.text(stampText, -stampW / 2, -stampH / 2 + 10, {
    width: stampW,
    align: 'center'
  });

  doc.restore();

  // ===== Draw description below stamp on first page =====
  if (description && String(description).trim()) {
    const descY = stampY + stampH + 15;
    const availableSpaceForDesc = pageHeight - marginBottom - footerHeight - descY;
    
    // Only draw if there's enough space, otherwise skip
    if (availableSpaceForDesc > 20) {
      drawDescription(descY);
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      openFileWindows(filePath);
      resolve(filePath);
    });
    stream.on('error', (err) => reject(err));
  });
}

module.exports = {
  generateBill,
};
