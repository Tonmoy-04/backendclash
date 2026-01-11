# Production Build Deployment Guide

**Status:** ✅ Ready for Deployment  
**Build Date:** January 10, 2026  
**Executable:** `dist/Setup.exe` (91.98 MB)

---

## What Was Fixed

This is a **critical production update** that fixes multiple issues where the installed application was using outdated code (8-9 days old):

### Issues Resolved
1. ✅ **PDF Bill Generator** - Now uses latest formatting with proper Bengali headers
2. ✅ **Customer Debt Alerts** - Now properly triggers for customers owing >100,000
3. ✅ **Database Migrations** - Now includes transport_fee and labour_fee columns
4. ✅ **Build System** - Fixed broken build script that wasn't copying JavaScript files

### Technical Details
- Fresh build from all latest source code (Jan 9-10, 2026)
- All JavaScript files properly compiled and included
- Database migration code present and tested
- Full Electron installer created and verified

---

## Deployment Instructions

### Step 1: Backup (Optional but Recommended)
If users have existing installations, their data is preserved:

```
Windows 10/11:
C:\Users\[Username]\AppData\Local\InventoryManager\database\

Or in the installation directory:
C:\Program Files\M∕S DIDAR TRADING\resources\server\database\
```

Backups are optional - the installer won't delete existing databases (`deleteAppDataOnUninstall: false`).

### Step 2: Run the Installer
```bash
dist/Setup.exe
```

**Installer Features:**
- NSIS installer (Windows native)
- Custom installation directory option
- Creates Start Menu shortcuts
- Runs application immediately after installation
- Preserves existing user data

### Step 3: First Launch
On first launch, the application will:

1. ✅ Initialize the database (automatic)
2. ✅ Run any necessary migrations:
   - Add `transport_fee` column to `sales` table (if missing)
   - Add `labour_fee` column to `sales` table (if missing)
3. ✅ Start the backend server
4. ✅ Display the dashboard

**Note:** Database migrations are transparent and automatic. No user action required.

### Step 4: Verify Installation

**Check 1: Application Starts**
- Installer runs the app automatically
- Dashboard displays with stats

**Check 2: Customer Debt Alerts**
- Navigate to Dashboard
- Look for "High Customer Debt" card in top-right
- Create a test customer with balance > 100,000
- Alert should appear showing the count and customer list

**Check 3: Create a Sale with Fees**
- Go to Transactions > Sales
- Create a new sale
- Optional: Add transport fee or labour fee
- Submit the sale
- Should save without "missing column" errors

**Check 4: Generate Bill**
- After creating a sale, generate a bill
- PDF should open with:
  - ✅ Bengali company name: "মেসার্স দিদার ট্রেডিং"
  - ✅ Product description in Bengali
  - ✅ Mobile numbers: "০১৭৮৩-৩৫৬৭৮৫, ০১৯২১-৯৯৩১৫৬"
  - ✅ Taka currency symbol: "৳"
  - ✅ Professional layout with green header

---

## System Requirements

- **OS:** Windows 10, 11 (64-bit)
- **RAM:** 2 GB minimum (4 GB recommended)
- **Disk Space:** 200 MB for installation + database
- **Internet:** Not required (fully offline application)
- **Administrator:** May be required for first-time installation (permission elevation allowed)

---

## Rollback Plan

If issues occur, users can:

1. **Revert to Previous Version:**
   - Uninstall current version (Windows Settings > Apps)
   - Keep database files (unchecked by default)
   - Install previous version

2. **Database Backup:**
   - If database is corrupted, restore from:
   - `C:\Users\[User]\AppData\Local\InventoryManager\backups\`
   - (Automatic backups created every 24 hours)

3. **Contact Support:**
   - Check application logs in:
   - `C:\Users\[User]\AppData\Local\InventoryManager\logs\`

---

## Detailed Changelog

### Fixed Issues
| Component | Issue | Fix | Status |
|-----------|-------|-----|--------|
| PDF Generator | Using 8-day old code | Rebuilt with latest source | ✅ |
| Customer Alerts | Missing 100K threshold | Latest logic in compiled code | ✅ |
| Database | Missing fee columns | Migrations now present | ✅ |
| Build System | Broken xcopy script | Replaced with Node.js build | ✅ |

### New Features
- None (bug fixes only)

### Breaking Changes
- None

### Database Changes
- NEW COLUMNS (auto-created on first run):
  - `sales.transport_fee` (DECIMAL, DEFAULT 0)
  - `sales.labour_fee` (DECIMAL, DEFAULT 0)
  - `purchases.transport_fee` (DECIMAL, DEFAULT 0)
  - `purchases.labour_fee` (DECIMAL, DEFAULT 0)

### Backward Compatibility
- ✅ 100% backward compatible
- ✅ Existing data preserved
- ✅ No data migration required
- ✅ Automatic column creation on first run

---

## Verification Checklist

Before deploying to users, verify:

- [x] `dist/Setup.exe` exists and is 91.98 MB
- [x] All critical files present in build
- [x] Database migrations in compiled code
- [x] Bill generator has Bengali text
- [x] Dashboard controller has alert logic
- [x] Build verification script passes ✅
- [x] Electron installer contains fresh code

---

## Support Information

**If users experience issues:**

1. **Check the logs:**
   ```
   C:\Users\[Username]\AppData\Local\InventoryManager\logs\
   ```

2. **Check database:**
   ```
   C:\Users\[Username]\AppData\Local\InventoryManager\database\
   ```

3. **Common issues:**
   - "Port already in use" → Another app using port 5000, will auto-select next port
   - "Database locked" → Close other instances, restart app
   - "Bill not generating" → Check fonts folder, reinstall if needed

4. **Emergency reset:**
   - Uninstall application
   - Delete: `C:\Users\[Username]\AppData\Local\InventoryManager\`
   - Reinstall fresh
   - Database backup automatically restored

---

## Post-Deployment Monitoring

After deploying to users, monitor:

1. ✅ Application launches without errors
2. ✅ Database migrations complete silently
3. ✅ Customer alerts work correctly
4. ✅ Sales creation succeeds
5. ✅ PDF generation works
6. ✅ No crash reports

**Log Location:** `C:\Users\[User]\AppData\Local\InventoryManager\logs\`

---

## Version Information

- **Application:** M/S DIDAR TRADING v1.0.1
- **Build Date:** January 10, 2026, 11:55:00 AM
- **Platform:** Windows x64
- **Electron:** 28.0.0
- **Node.js:** 18.x
- **React:** 19.2.3

---

**Ready for Production Deployment** ✅
