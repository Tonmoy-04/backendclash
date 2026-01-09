# 📦 Backup & Restore System - Complete Guide

## Overview

The inventory software includes a comprehensive backup and restore system that:
- ✅ **Supports all features** including new cashbox, transaction tracking, and separated databases
- ✅ **Maintains backward compatibility** with older backup versions
- ✅ **Includes versioning** to track backup format evolution
- ✅ **Automatically migrates** old backups when restored
- ✅ **Protects data** by creating a backup before every restore operation

## Backup Format Version: 2.0.0

### What's Included in Backups

#### Database Files
1. **inventory.db** - Main business logic database containing:
   - Users
   - Customers & customer transactions
   - Suppliers & supplier transactions
   - Sales & sale items
   - Purchases & purchase items
   - **Cashbox & cashbox transactions** (NEW in v2.0)
   - Customer/Supplier transaction history (NEW in v2.0)

2. **stock.db** - Inventory/stock database containing:
   - Products
   - Categories
   - **Stock history** (audit trail)

3. **backup-metadata.json** - Backup metadata file (NEW in v2.0) containing:
   - Backup version
   - Creation timestamp
   - Feature flags
   - Database presence indicators
   - Schema version information

### Backup Versions

#### Version 2.0.0 (Current)
- **Format:** ZIP archive with metadata
- **Features:**
  - Cashbox management
  - Customer/Supplier balance tracking
  - Transaction history for customers/suppliers
  - Stock history audit trail
  - Separated databases (inventory.db + stock.db)
  - Backup metadata with versioning

#### Version 1.0.0 (Legacy)
- **Format:** Single .db file or .zip without metadata
- **Features:**
  - Basic sales, purchases, customers, suppliers
  - Products in same database
  - No cashbox
  - No transaction tracking
  - No metadata

## Backward Compatibility

### Restoring Old Backups

When you restore a v1.0.0 backup in the current system (v2.0.0), the following migrations are **automatically applied**:

#### 1. New Tables Created
- `cashbox` - Empty, ready for initialization
- `cashbox_transactions` - Empty transaction history
- `customer_transactions` - Empty, will track future balance changes
- `supplier_transactions` - Empty, will track future balance changes
- `stock_history` - Empty, will track future stock changes

#### 2. New Columns Added

**Sales table:**
- `customer_phone` - NULL for old records
- `user_id` - NULL for old records
- `status` - Default: 'completed'
- `customer_id` - NULL for old records

**Sale Items table:**
- `product_name` - NULL for old records
- `unit_price` - Backfilled from `price` if available
- `total_price` - Backfilled from `subtotal` if available

**Purchases table:**
- `user_id` - NULL for old records
- `status` - Default: 'completed'
- `supplier_name` - NULL for old records

**Purchase Items table:**
- `product_name` - NULL for old records
- `unit_price` - Backfilled from `cost` if available
- `total_price` - Backfilled from `subtotal` if available

**Customers table:**
- `balance` - Default: 0

**Suppliers table:**
- `balance` - Default: 0
- `contact_person` - NULL for old records

#### 3. Safe Defaults Applied
- All new numeric fields default to 0
- All new text fields default to NULL or empty string
- All new boolean fields default to 0 (false)
- Timestamp fields use CURRENT_TIMESTAMP

### No Data Loss
- ✅ All existing data is preserved
- ✅ All existing columns remain unchanged
- ✅ New features start with clean state
- ✅ Relationships and foreign keys maintained

## How Backup & Restore Works

### Creating a Backup

```javascript
POST /api/backup/create
```

**Process:**
1. Close database connections (flush to disk)
2. Create timestamped backup filename: `backup_YYYY-MM-DDTHH-mm-ss-sss.zip`
3. Create ZIP archive containing:
   - inventory.db
   - stock.db (if exists)
   - backup-metadata.json (version, timestamp, features)
4. Reopen database connections
5. Return backup info with version

**Automatic Backups:**
- Scheduled every 24 hours (configurable)
- Automatically cleans old backups (keeps last 10)

### Restoring a Backup

```javascript
POST /api/backup/restore
Body: { fileName: "backup_2026-01-09T12-00-00-000.zip" }
```

**Process:**
1. **Safety backup** - Create backup of current state
2. Close database connections
3. Remove WAL/SHM sidecar files
4. **Detect backup version** from metadata (or assume v1.0.0 for legacy)
5. Extract database files from archive
6. **Apply migrations** if backup is older than current version
7. Reopen database connections
8. Return success with version info

### Supported Backup Formats

| Format | Extension | Detected As | Supported |
|--------|-----------|-------------|-----------|
| Current ZIP with metadata | `.zip` | v2.0.0 | ✅ Yes |
| Legacy ZIP without metadata | `.zip` | v1.0.0 | ✅ Yes (migrated) |
| Legacy single DB file | `.db` | v1.0.0 | ✅ Yes (migrated) |
| Uploaded backups | `.zip` or `.db` | Auto-detect | ✅ Yes |

## API Endpoints

### GET /api/backup/version
Get current backup system version and capabilities.

**Response:**
```json
{
  "currentVersion": "2.0.0",
  "supportedVersions": ["1.0.0", "2.0.0"],
  "features": {
    "cashbox": true,
    "customerTransactions": true,
    "supplierTransactions": true,
    "stockHistory": true,
    "separatedDatabases": true,
    "backupMetadata": true,
    "backwardCompatibility": true
  }
}
```

### GET /api/backup/info/:fileName
Get detailed information about a specific backup file.

**Response:**
```json
{
  "fileName": "backup_2026-01-09T12-00-00-000.zip",
  "size": 1234567,
  "created": "2026-01-09T12:00:00.000Z",
  "backupVersion": "2.0.0",
  "hasMetadata": true,
  "features": {
    "cashbox": true,
    "customerTransactions": true,
    "supplierTransactions": true,
    "stockHistory": true,
    "separatedDatabases": true
  },
  "databases": {
    "inventory": true,
    "stock": true
  },
  "isLegacy": false,
  "compatible": true
}
```

### GET /api/backup/export-json
Export all data as JSON for analysis or external processing.

**Features:**
- Includes ALL tables from both databases
- Contains version and feature flags
- Suitable for data migration or analysis
- Human-readable format

**Response includes:**
- All sales, purchases, customers, suppliers
- Cashbox and transaction data
- Products, categories, stock history
- Users (with hashed passwords)

## Migration Safety

### What Happens During Migration?

1. **Non-Destructive Operations Only**
   - New tables created with `IF NOT EXISTS`
   - New columns added with `ALTER TABLE ADD COLUMN`
   - No tables or columns are ever dropped
   - No data is ever deleted

2. **Smart Backfilling**
   - Missing numeric values → 0
   - Missing text values → NULL
   - Derived values when possible (e.g., `unit_price` from `price`)
   - Timestamps use `CURRENT_TIMESTAMP`

3. **Error Handling**
   - Each migration wrapped in try-catch
   - Failures logged but don't stop restore
   - Database remains in working state
   - Partial migrations are safe

4. **Logging**
   - All migration steps logged
   - Success/failure for each operation
   - Version detection logged
   - Warnings for any issues

## Testing Backup Compatibility

### Test Scenarios

#### ✅ Scenario 1: Restore v1.0 backup in v2.0 system
- **Expected:** All old data restored + new tables/columns added with defaults
- **Result:** ✅ Full compatibility, no data loss

#### ✅ Scenario 2: Restore v2.0 backup in v2.0 system
- **Expected:** Direct restore, no migrations needed
- **Result:** ✅ Perfect match, instant restore

#### ✅ Scenario 3: Restore backup missing some tables
- **Expected:** Missing tables created, existing data preserved
- **Result:** ✅ Safely handled with defaults

#### ✅ Scenario 4: Restore backup with extra/unknown fields
- **Expected:** Extra fields ignored, core data restored
- **Result:** ✅ Forward compatibility maintained

### Manual Testing Steps

1. **Create a backup** in current version
   - Verify metadata.json exists in ZIP
   - Check version = "2.0.0"
   - Confirm both DBs included

2. **Create test data**
   - Add cashbox transactions
   - Create customer with balance
   - Add supplier transactions
   - Record stock changes

3. **Restore the backup**
   - Check all data restored correctly
   - Verify cashbox balance matches
   - Confirm transaction history preserved

4. **Test with legacy backup**
   - Use old v1.0 backup (without cashbox)
   - Restore it
   - Verify new tables created empty
   - Confirm old data fully restored
   - Check new features work correctly

## Best Practices

### For Users

1. **Regular Backups**
   - Create manual backups before major changes
   - Automatic backups run daily
   - Download important backups to external storage

2. **Before Restore**
   - System automatically creates safety backup
   - Download current data if needed
   - Close all active operations

3. **After Restore**
   - Verify critical data
   - Check recent transactions
   - Test new features if restored from old backup

### For Developers

1. **Adding New Features**
   - Update `BACKUP_VERSION` if schema changes
   - Add migration logic in `applyBackwardCompatibilityMigrations()`
   - Use `IF NOT EXISTS` for new tables
   - Use `ALTER TABLE ADD COLUMN` for new fields
   - Test with old backups

2. **Schema Changes**
   - Never remove columns (mark deprecated instead)
   - Never rename tables (create new, migrate data)
   - Always provide defaults for new columns
   - Document migration path

3. **Testing**
   - Test restore with v1.0 backup
   - Test restore with v2.0 backup
   - Test with missing tables/columns
   - Verify data integrity after migration

## Technical Implementation

### File Structure

```
backups/
├── backup_2026-01-09T12-00-00-000.zip  (v2.0 format)
│   ├── inventory.db
│   ├── stock.db
│   └── backup-metadata.json
├── backup_2025-12-15T10-30-00-000.zip  (v1.0 legacy)
│   ├── inventory.db
│   └── stock.db
└── backup_2025-11-01T08-15-00-000.db   (v1.0 very old)
```

### Metadata Format

```json
{
  "backupVersion": "2.0.0",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "created": "2026-01-09T12:00:00.000Z",
  "databases": {
    "inventory": true,
    "stock": true
  },
  "features": {
    "cashbox": true,
    "customerTransactions": true,
    "supplierTransactions": true,
    "stockHistory": true,
    "separatedDatabases": true
  },
  "schemaVersion": {
    "inventory": "2.0",
    "stock": "1.0"
  }
}
```

### Migration Functions

Each migration function is isolated and safe:

```javascript
async ensureCashboxTablesExist(db)
async ensureTransactionTablesExist(db)
async ensureSaleItemsColumns(db)
async ensurePurchaseItemsColumns(db)
async ensureSalesColumns(db)
async ensurePurchasesColumns(db)
async ensureSuppliersColumns(db)
async ensureCustomersColumns(db)
async ensureStockHistoryTable(stockDb)
```

## Troubleshooting

### Common Issues

#### Issue: "Backup file not found"
- **Cause:** Incorrect filename or path
- **Solution:** Use `/api/backup/list` to get valid filenames

#### Issue: "Database is locked"
- **Cause:** Active connections during backup/restore
- **Solution:** System automatically closes connections; retry if needed

#### Issue: "Missing columns after restore"
- **Cause:** Migration failed silently
- **Solution:** Check logs for migration warnings; manually run schema update

#### Issue: "Old backup won't restore"
- **Cause:** Very old format or corrupted file
- **Solution:** Check backup integrity; use JSON export as alternative

### Logs

All backup operations are logged:

```
[BACKUP] Creating backup from source: /path/to/inventory.db
[BACKUP] Backup created: backup_2026-01-09T12-00-00-000.zip (version 2.0.0)
[RESTORE] Requested restore file: backup_2025-11-01T08-15-00-000.db
[RESTORE] Detected backup version: 1.0.0
[MIGRATION] Applying backward compatibility migrations for backup version 1.0.0
[MIGRATION] ✓ Cashbox tables ensured
[MIGRATION] ✓ Transaction tables ensured
[MIGRATION] ✓ Added product_name to sale_items
[MIGRATION] Backward compatibility migrations completed successfully
```

## Summary

The backup and restore system is **production-ready** with:

✅ **Full feature coverage** - All new tables, columns, and features included  
✅ **Backward compatible** - Old backups work seamlessly  
✅ **Forward compatible** - Can handle unknown fields gracefully  
✅ **Versioned** - Clear tracking of backup format evolution  
✅ **Safe** - Automatic safety backups before restore  
✅ **Logged** - Comprehensive logging for debugging  
✅ **Tested** - Handles multiple scenarios and edge cases  
✅ **Documented** - Complete API and usage documentation  

**No existing backup will ever become invalid** - all formats are supported with automatic migration to current schema.
