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

function generateBill({ type, transaction, items, currencySymbol, adjustment = 0, transport_fee = 0, labour_fee = 0 }) {
  const home = os.homedir();
  const billsDir = path.join(home, 'Documents', 'InventoryApp', 'Bills');
  ensureDir(billsDir);

  const prefix = type === 'sale' ? 'INV' : 'PUR';
  const memoNumber = `${prefix}-${String(transaction.id).padStart(6, '0')}`;
  const fileName = `${memoNumber}-${Date.now()}.pdf`;
  const filePath = path.join(billsDir, fileName);

  // 3:4 portrait ratio size (450 x 600 points = 6.25 x 8.33 inches)
  // Maintains clean 3:4 aspect ratio for optimal readability and printing
  const size = [450, 600];
  const margin = 22;
  const doc = new PDFDocument({ size, margin, layout: 'portrait' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const appleGreen = '#34C759';
  const darkGray = '#333333';
  const lightGray = '#f3f4f6';
  const veryLightGreen = '#f0fdf4';
  const borderGray = '#e5e7eb';
  const lightGreen = '#dcfce7';

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

  let y = doc.page.margins.top;

  // Modern header with green border and company details - FIXED POSITIONING to prevent font corruption
  const headerX = doc.page.margins.left;
  const headerY = y;
  const headerW = usableWidth;
  const headerH = 115; // Increased height for padding after first line

  // Header border
  doc.lineWidth(3).strokeColor(appleGreen);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(headerX, headerY, headerW, headerH, 8).stroke();
  } else {
    doc.rect(headerX, headerY, headerW, headerH).stroke();
  }

  // HEADER SECTION - Copied from customer statement for consistency
  // Green bordered box with company details (Bengali text as provided by user)
  const headerPadX = 10;
  
  // Draw header box with green border
  doc.lineWidth(3).strokeColor(appleGreen);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(headerX, headerY, headerW, headerH, 8).stroke();
  } else {
    doc.rect(headerX, headerY, headerW, headerH).stroke();
  }
  
  // Set font for header text
  if (fontInfo.loaded) {
    doc.font('unicode');
  } else {
    doc.font('Helvetica');
  }
  
  // Fixed Y positions for each line (constant to prevent corruption)
  const line1Y = headerY + 10;
  const line2Y = headerY + 40; // Added padding after first line
  const line3Y = headerY + 50;
  const line4Y = headerY + 63;
  const line5Y = headerY + 78;
  const line6Y = headerY + 88;
  
  // Line 1: Company name (Bengali bold)
  doc.font(fontInfo.loaded && fontInfo.boldLoaded ? 'unicode-bold' : (fontInfo.loaded ? 'unicode' : 'Helvetica-Bold'));
  doc.fillColor(appleGreen).fontSize(18);
  doc.text('মেসার্স দিদার ট্রেডিং', headerX + headerPadX, line1Y, { width: headerW - headerPadX * 2, align: 'center' });
  
  // Switch to regular font for remaining lines
  if (fontInfo.loaded) {
    doc.font('unicode');
  } else {
    doc.font('Helvetica');
  }
  doc.fillColor(darkGray);
  
  // Line 2: Product line (Bengali)
  doc.fontSize(10);
  doc.text('এলাচি,দারচিনি, জিরা, লবঙ্গ, কিসমিস,জাফরান,সোডা,বার্লি,বেনেতী পসারী', headerX + headerPadX, line2Y, { width: headerW - headerPadX * 2, align: 'center' });
  
  // Line 3: Tagline (Bengali)
  doc.fontSize(11);
  doc.text('পাইকারী ও খুচরা বিক্রেতা', headerX + headerPadX, line3Y, { width: headerW - headerPadX * 2, align: 'center' });
  
  // Line 4: Mobile (Bengali)
  doc.fontSize(10);
  doc.text('মোবাইল: ০১৭৮৩-৩৫৬৭৮৫, ০১৯২১-৯৯৩১৫৬', headerX + headerPadX, line4Y, { width: headerW - headerPadX * 2, align: 'center' });
  
  // Line 5: Address (Bengali)
  doc.fontSize(10);
  doc.text('ঠিকানা: ৭৮ মৌলভীবাজার, ট্রেড সেন্টার, ঢাকা-১২১১', headerX + headerPadX, line5Y, { width: headerW - headerPadX * 2, align: 'center' });
  
  // Reset font to Helvetica after header
  doc.font('Helvetica').fillColor(darkGray);

  y = headerY + headerH + 20;

  // Invoice/Purchase details section
  doc.font('Helvetica').fontSize(12).fillColor(darkGray);
  const billType = type === 'sale' ? 'Invoice' : 'Purchase Order';
  doc.text(`${billType}: ${memoNumber}`, doc.page.margins.left, y);
  y = doc.y + 5;
  doc.text(`Date: ${formatDate(transaction.date || Date.now())}`, doc.page.margins.left, y);
  y = doc.y + 13;

  // Customer/Party details box - matching statement style
  const customerBoxHeight = 65;
  const customerBoxX = doc.page.margins.left;
  const customerBoxY = y;
  
  // Light green background for customer info
  doc.rect(customerBoxX, customerBoxY, usableWidth, customerBoxHeight).fill(veryLightGreen);
  
  // Green left border
  doc.lineWidth(3).strokeColor(appleGreen);
  doc.moveTo(customerBoxX, customerBoxY).lineTo(customerBoxX, customerBoxY + customerBoxHeight).stroke();

  let partyRaw = transaction.party && String(transaction.party).trim() ? String(transaction.party).trim() : 'N/A';
  const party = partyRaw.replace(/^\s*(নাম[:ঃ]\s*)/i, '').trim() || 'N/A';

  const customerPadX = 15;
  let customerY = customerBoxY + 13;
  
  // Customer info title
  doc.font('Helvetica-Bold').fontSize(12).fillColor(appleGreen);
  doc.text('Customer Details', customerBoxX + customerPadX, customerY);
  
  customerY = doc.y + 7;
  
  // Name field - matching statement approach
  doc.font('Helvetica').fontSize(12).fillColor(darkGray);
  const nameX = customerBoxX + customerPadX;
  const nameLabelWidth = doc.widthOfString('Name: ');
  doc.text('Name: ', nameX, customerY, { continued: true });
  
  if (fontInfo.loaded && containsBengaliText(party)) {
    // Bengali name
    doc.font('unicode').fontSize(12).fillColor(darkGray);
    doc.text(party, { continued: false });
  } else {
    // English name
    doc.font('Helvetica').fontSize(12).fillColor(darkGray);
    doc.text(party, { continued: false });
  }

  y = customerBoxY + customerBoxHeight + 15;

  // Table header with green background
  const tableLeft = doc.page.margins.left;
  const colWidths = {
    no: 25,
    item: usableWidth - 25 - 40 - 55,
    qty: 40,
    amount: 55
  };

  const tableHeaderY = y;
  doc.rect(tableLeft, tableHeaderY, usableWidth, 23).fill(lightGray);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(appleGreen);
  
  doc.text('#', tableLeft + 6, tableHeaderY + 6, { width: colWidths.no - 6, align: 'left' });
  doc.text('Item', tableLeft + colWidths.no + 6, tableHeaderY + 6, { width: colWidths.item - 6, align: 'left' });
  doc.text('Qty', tableLeft + colWidths.no + colWidths.item + 4, tableHeaderY + 6, { width: colWidths.qty - 4, align: 'right' });
  doc.text('Amount', tableLeft + colWidths.no + colWidths.item + colWidths.qty + 4, tableHeaderY + 6, { width: colWidths.amount - 4, align: 'right' });

  y = tableHeaderY + 28;

  // Table rows
  const safeItems = Array.isArray(items) && items.length ? items : [];
  safeItems.forEach((it, idx) => {
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

    // Alternate row background
    if (idx % 2 === 0) {
      doc.rect(tableLeft, y - 2, usableWidth, 18).fill('#fafafa');
    }

    doc.font('Helvetica').fontSize(10).fillColor(darkGray);
    doc.text(String(idx + 1), tableLeft + 6, y, { width: colWidths.no - 6, align: 'left' });
    
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

    y += 18;
  });

  y += 70;

  // Totals section with modern styling
  const subtotalCalc = (items || []).reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
  const subtotal = Number.isFinite(Number(transaction.subtotal)) ? Number(transaction.subtotal) : subtotalCalc;
  const tax = Number.isFinite(Number(transaction.tax)) ? Number(transaction.tax) : 0;
  const grossTotal = Number.isFinite(Number(transaction.total)) ? Number(transaction.total) : (subtotal + tax);
  const adj = Number.isFinite(Number(adjustment)) ? Number(adjustment) : 0;
  const transportVal = Number.isFinite(Number(transport_fee)) ? Number(transport_fee) : 0;
  const labourVal = Number.isFinite(Number(labour_fee)) ? Number(labour_fee) : 0;
  // Final total = Subtotal + Transport Fee + Labour Fee - Discount
  const netTotal = grossTotal + transportVal + labourVal - adj;

  const summaryBoxX = tableLeft + usableWidth - 210;
  const summaryBoxW = 210;
  // Calculate dynamic height based on number of lines
  // Base: Subtotal (14) + Final Total (14) + padding (15)
  // Add 14 for each conditional line: Tax, Transport, Labour, Discount
  let summaryBoxH = 43; // base
  if (type === 'sale' && tax > 0) summaryBoxH += 14;
  if (transportVal > 0) summaryBoxH += 14;
  if (labourVal > 0) summaryBoxH += 14;
  if (adj > 0) summaryBoxH += 14;

  // Summary box background
  doc.rect(summaryBoxX, y, summaryBoxW, summaryBoxH).fill('#f0fdf4');
  doc.strokeColor(appleGreen).lineWidth(2.5);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(summaryBoxX, y, summaryBoxW, summaryBoxH, 5).stroke();
  } else {
    doc.rect(summaryBoxX, y, summaryBoxW, summaryBoxH).stroke();
  }

  doc.font('Helvetica').fontSize(10).fillColor(darkGray);
  let summaryY = y + 15;

  // Subtotal
  doc.text('Subtotal:', summaryBoxX + 12, summaryY);
  if (symbolIsNonAscii && fontInfo.loaded) {
    doc.font('unicode');
    doc.text(formatCurrency(subtotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    doc.font('Helvetica');
  } else {
    doc.text(formatCurrency(subtotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
  }
  summaryY += 14;

  // Tax
  if (type === 'sale' && tax > 0) {
    doc.text('Tax:', summaryBoxX + 12, summaryY);
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(tax, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(tax, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += 14;
  }

  // Transport Fee - shown only if > 0
  if (transportVal > 0) {
    doc.text('Transport:', summaryBoxX + 12, summaryY);
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(transportVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(transportVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += 14;
  }

  // Labour Fee - shown only if > 0
  if (labourVal > 0) {
    doc.text('Labour:', summaryBoxX + 12, summaryY);
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(labourVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(labourVal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += 14;
  }

  // Discount - shown only if > 0
  if (adj > 0) {
    doc.text('Discount:', summaryBoxX + 12, summaryY);
    if (symbolIsNonAscii && fontInfo.loaded) {
      doc.font('unicode');
      doc.text(formatCurrency(-adj, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
      doc.font('Helvetica');
    } else {
      doc.text(formatCurrency(-adj, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    }
    summaryY += 14;
  }

  // Total (highlighted)
  doc.fontSize(13).font('Helvetica-Bold').fillColor(appleGreen);
  doc.text('Total:', summaryBoxX + 12, summaryY);
  if (symbolIsNonAscii && fontInfo.loaded) {
    doc.font('unicode');
    doc.text(formatCurrency(netTotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
    doc.font('Helvetica');
  } else {
    doc.text(formatCurrency(netTotal, displaySymbol), summaryBoxX + 110, summaryY, { width: 80, align: 'right' });
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
