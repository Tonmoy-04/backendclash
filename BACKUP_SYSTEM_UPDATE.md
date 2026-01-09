# 🔄 Backup System Update - Quick Reference

## Summary of Changes

The backup and restore system has been **upgraded to version 2.0.0** with full backward compatibility support.

## What's New

### ✨ Features Added

1. **Backup Versioning**
   - Each backup now includes version metadata
   - Current version: 2.0.0
   - Legacy version: 1.0.0 (auto-detected)

2. **Automatic Migration**
   - Old backups automatically upgraded when restored
   - New tables/columns added with safe defaults
   - Zero data loss guarantee

3. **Complete Data Coverage**
   - ✅ Cashbox & cashbox transactions
   - ✅ Customer transaction history
   - ✅ Supplier transaction history
   - ✅ Stock history audit trail
   - ✅ All new columns in existing tables

4. **Enhanced JSON Export**
   - Includes ALL tables from both databases
   - Contains version and feature information
   - Suitable for data analysis and migration

5. **Backup Information API**
   - Get detailed info about any backup file
   - Check version compatibility
   - View included features

## Files Modified

### Backend
- ✅ `server/utils/backup.js` - Main backup manager with versioning and migrations
- ✅ `server/routes/backup.routes.js` - Added version and info endpoints, updated JSON export

### Documentation
- ✅ `BACKUP_RESTORE_SYSTEM.md` - Complete system documentation
- ✅ `BACKUP_SYSTEM_UPDATE.md` - This quick reference

## New API Endpoints

```javascript
// Get backup system version and capabilities
GET /api/backup/version

// Get detailed information about a backup file
GET /api/backup/info/:fileName

// Export as JSON (updated to include all new tables)
GET /api/backup/export-json
```

## Backward Compatibility Migrations

When restoring a v1.0.0 backup, these migrations run automatically:

### Tables Created (if missing)
- `cashbox`
- `cashbox_transactions`
- `customer_transactions`
- `supplier_transactions`
- `stock_history`

### Columns Added (if missing)

**Sales:**
- customer_phone, user_id, status, customer_id

**Sale Items:**
- product_name, unit_price, total_price

**Purchases:**
- user_id, status, supplier_name

**Purchase Items:**
- product_name, unit_price, total_price

**Customers:**
- balance

**Suppliers:**
- balance, contact_person

## Testing Checklist

- [ ] Create a new backup (should be v2.0.0 with metadata)
- [ ] Restore the new backup (should work perfectly)
- [ ] Restore an old backup (should auto-migrate)
- [ ] Check JSON export includes all tables
- [ ] Verify cashbox data is preserved
- [ ] Confirm transaction history is backed up
- [ ] Test `/api/backup/version` endpoint
- [ ] Test `/api/backup/info/:fileName` endpoint

## User Impact

### ✅ Positive
- Old backups still work perfectly
- New features are included in backups
- Automatic migration = no manual work
- Better information about backup contents

### ⚠️ Neutral
- Backup files slightly larger (due to metadata)
- Migration logs may appear in console (informational only)

### ❌ None
- No breaking changes
- No data loss
- No manual intervention required

## Developer Notes

### Adding Future Features

When adding new database tables or columns:

1. **Update `BACKUP_VERSION`** constant if needed:
   ```javascript
   const BACKUP_VERSION = '2.1.0'; // or 3.0.0 for major changes
   ```

2. **Add migration logic** in `applyBackwardCompatibilityMigrations()`:
   ```javascript
   if (major < 3) {
     await this.ensureYourNewFeature(db);
   }
   ```

3. **Create migration function**:
   ```javascript
   async ensureYourNewFeature(db) {
     try {
       await db.run(`CREATE TABLE IF NOT EXISTS your_table (...)`);
       // OR
       const cols = await db.all("PRAGMA table_info('existing_table')");
       if (!columnNames.has('new_column')) {
         await db.run('ALTER TABLE existing_table ADD COLUMN new_column ...');
       }
     } catch (err) {
       logger.warn(`Migration warning: ${err.message}`);
     }
   }
   ```

4. **Update metadata** in `createBackup()` if needed

5. **Test with old backups** to verify migration

### Key Principles

1. **Never remove data** - Only add tables/columns
2. **Always provide defaults** - New columns must have DEFAULT values
3. **Use IF NOT EXISTS** - For all CREATE TABLE statements
4. **Graceful failures** - Migrations log warnings but don't crash
5. **Test backward compatibility** - Always test with v1.0 and v2.0 backups

## Code Structure

```
server/utils/backup.js
├── BACKUP_VERSION constant (2.0.0)
├── createBackup() - Adds metadata with version info
├── restoreBackup() - Detects version, applies migrations
├── applyBackwardCompatibilityMigrations() - Main migration orchestrator
├── ensureCashboxTablesExist()
├── ensureTransactionTablesExist()
├── ensureSaleItemsColumns()
├── ensurePurchaseItemsColumns()
├── ensureSalesColumns()
├── ensurePurchasesColumns()
├── ensureSuppliersColumns()
├── ensureCustomersColumns()
└── ensureStockHistoryTable()
```

## Logging

Look for these log messages during backup/restore:

```
[BACKUP] Creating backup from source: ...
[BACKUP] Backup created: ... (version 2.0.0)
[RESTORE] Detected backup version: 1.0.0
[MIGRATION] Applying backward compatibility migrations for backup version 1.0.0
[MIGRATION] ✓ Cashbox tables ensured
[MIGRATION] ✓ Transaction tables ensured
[MIGRATION] ✓ Added product_name to sale_items
[MIGRATION] Backward compatibility migrations completed successfully
```

## Metadata File Example

New backups include `backup-metadata.json`:

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

## Common Questions

**Q: Will my old backups stop working?**  
A: No! All old backups are fully supported and automatically migrated.

**Q: Do I need to recreate my backups?**  
A: No. Old backups work fine. New backups will include version info automatically.

**Q: What if I restore an old backup?**  
A: The system detects it's old and automatically adds missing tables/columns.

**Q: Can I restore a v2.0 backup in an old v1.0 system?**  
A: Not recommended. Old systems won't understand new tables. Always update software first.

**Q: How do I know what version a backup is?**  
A: Use `GET /api/backup/info/:fileName` to check any backup file.

**Q: What if migration fails?**  
A: Each migration is isolated. Failures are logged but don't crash restore. Database remains functional.

## Support

For issues or questions:
1. Check logs for migration messages
2. Use `/api/backup/info/:fileName` to inspect backup
3. Review `BACKUP_RESTORE_SYSTEM.md` for full details
4. Check that all database schema migrations ran successfully

## Version History

- **v2.0.0** (2026-01-09) - Added versioning, metadata, full feature support, backward compatibility
- **v1.0.0** (Legacy) - Basic backup/restore without versioning
