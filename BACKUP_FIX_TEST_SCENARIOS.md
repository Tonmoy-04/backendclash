# Backup System Fix - Test Scenarios

## Overview
Tests for the backup system fixes addressing:
- Download functionality with proper streaming
- ZIP import from external locations
- Atomic restore (no data loss)
- Backward compatibility with v1.0.0
- Production path safety

## Test Environment Setup

### Prerequisites
1. Fresh application instance with database
2. Running server on `http://localhost:5000`
3. Access to backup directory
4. Multiple test backup files:
   - Legacy v1.0.0 .db backup
   - Current v2.0.0 ZIP backup with both DBs
   - v2.0.0 ZIP with only inventory.db
   - v2.0.0 ZIP with only stock.db

---

## Test Scenarios

### ✅ Test 1: Download ZIP Backup from Local Storage

**Objective**: Verify backup download works with correct headers and file integrity

**Steps**:
1. Create a backup via UI: `POST /api/backup/create` ✓ Success
2. List backups: `GET /api/backup/list` ✓ Returns backup files
3. Download backup: `GET /api/backup/download/{fileName}`
   - Expected: File downloads as attachment
   - Expected headers:
     - `Content-Type: application/octet-stream`
     - `Content-Disposition: attachment; filename=...`
     - `Content-Length: [actual size]`
   - Expected: File size matches original

**Validation**:
- [ ] Download completes without errors
- [ ] File size matches original (byte-for-byte)
- [ ] ZIP can be opened/extracted
- [ ] Contains `inventory.db`, `stock.db`, `backup-metadata.json`
- [ ] No corruption detected

**Expected Result**: ✅ PASS

---

### ✅ Test 2: Import v2.0.0 ZIP Backup (Both DBs)

**Objective**: Verify importing a complete ZIP with both databases

**Setup**:
1. Have a valid v2.0.0 ZIP backup from another PC
2. Application has existing data

**Steps**:
1. Access Settings > Backup > Import
2. Select ZIP backup file
3. Click "Import and Restore"
4. `POST /api/backup/import` with file upload

**Validation**:
- [ ] File uploads successfully
- [ ] Restore response includes:
  - `"success": true`
  - `"restored": ["inventory.db", "stock.db"]`
  - `"backupVersion": "2.0.0"`
  - `"migrationsApplied": false`
- [ ] Database connections re-established
- [ ] UI updates show restored data
- [ ] No SQL errors in console
- [ ] Previous data is replaced with imported data

**Expected Result**: ✅ PASS

---

### ✅ Test 3: Import Legacy v1.0.0 Single .db Backup

**Objective**: Verify backward compatibility with old single-file backups

**Setup**:
1. Have a legacy `backup_inventory_*.db` file
2. Application has modern v2.0.0 schema

**Steps**:
1. Upload legacy .db file via Settings > Import
2. `POST /api/backup/import` with .db file

**Validation**:
- [ ] File uploads successfully
- [ ] Restore response includes:
  - `"success": true`
  - `"restored": ["inventory.db"]`
  - `"backupVersion": "1.0.0"`
  - `"migrationsApplied": true` (migrations applied for v1.0→v2.0)
- [ ] Migrations auto-run:
  - Cashbox tables created
  - Customer/supplier transaction tables created
  - Sale_items/purchase_items columns added
  - Stock history table created
- [ ] No data loss during migration
- [ ] Application works with migrated data

**Expected Result**: ✅ PASS

---

### ✅ Test 4: Import ZIP Missing stock.db (Partial Restore)

**Objective**: Verify atomic restore respects missing databases

**Setup**:
1. Manually create a v2.0.0 ZIP with only `inventory.db` + metadata
2. Application has existing stock.db

**Steps**:
1. Upload partial ZIP
2. Monitor restore process

**Validation**:
- [ ] Restore completes successfully
- [ ] Response shows:
  - `"restored": ["inventory.db"]`
  - No `"stock.db"` in restored list
- [ ] Inventory data is replaced
- [ ] **Existing stock.db is preserved** (NOT overwritten)
- [ ] Stock data remains intact

**Expected Result**: ✅ PASS (Atomic behavior works)

---

### ✅ Test 5: WAL/SHM Cleanup During Restore

**Objective**: Verify cleanup of SQLite WAL/SHM files prevents lock issues

**Setup**:
1. Application running with active DB connections
2. WAL files exist: `inventory.db-wal`, `inventory.db-shm`, etc.

**Steps**:
1. Trigger restore: `POST /api/backup/restore`
2. Monitor temp directory and file cleanup

**Validation**:
- [ ] Close connections logged: `[RESTORE] closeDatabases`
- [ ] WAL/SHM files removed before restore
- [ ] Restore completes without lock errors
- [ ] No hanging connections
- [ ] New DB connections established: `[RESTORE] reloadDatabases`

**Expected Result**: ✅ PASS (No lock conflicts)

---

### ✅ Test 6: Download and Re-import Same Backup

**Objective**: Verify downloaded backup can be re-imported (idempotent)

**Steps**:
1. Create initial backup
2. Download ZIP file: `GET /api/backup/download/{fileName}`
3. Save to external location
4. Make changes to database
5. Upload saved ZIP: `POST /api/backup/import`
6. Verify data matches original backup

**Validation**:
- [ ] Download succeeds with correct size
- [ ] ZIP file is valid (can be extracted)
- [ ] Re-import restores data exactly as it was
- [ ] No data corruption
- [ ] Idempotent: importing same backup twice = same result

**Expected Result**: ✅ PASS (Full cycle works)

---

### ✅ Test 7: Restore on Fresh Install (No Existing DB)

**Objective**: Verify restore works when databases don't exist yet

**Setup**:
1. Backup directory contains only backups
2. Database directory empty (fresh install)

**Steps**:
1. Upload backup file
2. `POST /api/backup/import`

**Validation**:
- [ ] Directories created automatically
- [ ] Database files created from backup
- [ ] Restore succeeds even without pre-existing DBs
- [ ] Schema migrations applied if needed
- [ ] Application starts and loads restored data

**Expected Result**: ✅ PASS (Fresh install support)

---

### ✅ Test 8: Temp Directory Cleanup (Zip-slip Prevention)

**Objective**: Verify temp extraction is safe and cleaned up

**Setup**:
1. Monitor temp directory (`%TEMP%` on Windows)
2. Upload malicious ZIP with path traversal attempts

**Steps**:
1. Create ZIP with entry `../../../../etc/passwd` or similar
2. Upload via `POST /api/backup/import`

**Validation**:
- [ ] Zip-slip prevention triggered:
  - `Error: Zip-slip detected`
  - Restore aborted
- [ ] Temp directory cleaned up immediately
- [ ] No files extracted outside temp dir
- [ ] Original databases untouched

**Expected Result**: ✅ PASS (Security validated)

---

### ✅ Test 9: Path Traversal Prevention (Download)

**Objective**: Verify download cannot access files outside backupDir

**Steps**:
1. Attempt download with path traversal: `GET /api/backup/download/../../../etc/passwd`
2. Attempt: `GET /api/backup/download/..%2F..%2F..%2Fetc%2Fpasswd`
3. Attempt: `GET /api/backup/download/invalid/../../sensitive`

**Validation**:
- [ ] All requests return `400 Bad Request` or `403 Forbidden`
- [ ] Error message: `"Invalid file name"` or `"Access denied"`
- [ ] Sensitive files NOT accessible
- [ ] Server logs show security attempt detected

**Expected Result**: ✅ PASS (Path traversal blocked)

---

### ✅ Test 10: Atomic Restore - No Partial State

**Objective**: Verify restore is all-or-nothing (no data loss)

**Setup**:
1. Database with 1000+ records
2. Restore backup containing older data

**Steps**:
1. Note current record count
2. Start restore of different backup
3. During restore, check temp extraction progress
4. After restore, verify final state

**Validation**:
- [ ] Safety backup created before restore
- [ ] If restore fails, safety backup available
- [ ] Final state is either:
  - Complete restore (all files replaced), OR
  - Error before any changes (rollback-like)
- [ ] No partial database state (e.g., old inventory + new stock)
- [ ] Record counts match expected backup state

**Expected Result**: ✅ PASS (Atomicity guaranteed)

---

## Production Path Safety

### ✅ Test 11: Refuse Bundled Path Restore (Electron Build)

**Objective**: Prevent restoring into ASAR resources (production safety)

**Setup**:
1. Simulate bundled path detection (mock ASAR scenario)
2. Attempt restore

**Validation**:
- [ ] Check DB path validation:
  - `[BACKUP] Refusing to use bundled DB path...`
- [ ] Restore blocked if path contains:
  - `app.asar`
  - `\resources\`
- [ ] Error: `"Refusing to restore into bundled path"`
- [ ] Safety ensured in production

**Expected Result**: ✅ PASS (Production safety)

---

### ✅ Test 12: Electron userData Path Resolution

**Objective**: Verify correct paths in Electron packaged mode

**Setup**:
1. Run production Electron build (Setup.exe)
2. Monitor backup location

**Validation**:
- [ ] Backup directory:
  - Windows: `C:\Users\[user]\AppData\Local\InventoryManager\backups\`
  - NOT inside ASAR
  - Writable and persistent
- [ ] Database directory:
  - `C:\Users\[user]\AppData\Local\InventoryManager\database\`
  - Contains `inventory.db` and `stock.db`
- [ ] Backup paths logged correctly
- [ ] Downloads work from production build

**Expected Result**: ✅ PASS (Production paths correct)

---

## Error Handling & Response Validation

### ✅ Test 13: Clear Error Messages

**Test Cases**:

| Scenario | Request | Expected Response |
|----------|---------|-------------------|
| Missing file | `GET /api/backup/download/nonexistent.zip` | `404 {"error": "Backup file not found"}` |
| No file uploaded | `POST /api/backup/import` (no file) | `400 {"error": "No file uploaded"}` |
| Invalid ZIP | Upload corrupted ZIP | `500 {"error": "..."}` with details |
| Missing inventory.db | Upload ZIP missing inventory.db | `500 {"error": "Invalid backup: inventory.db missing"}` |
| Invalid file type | Upload .txt file | `400 {"error": "Only .db or .zip files allowed"}` |
| Path traversal | `GET /api/backup/download/../../etc` | `400 {"error": "Invalid file name"}` |

**Validation**:
- [ ] All error messages are clear and actionable
- [ ] Status codes are appropriate (4xx for client, 5xx for server)
- [ ] No sensitive information leaked in errors

**Expected Result**: ✅ PASS (Errors helpful)

---

## Performance & Limits

### ✅ Test 14: Large Backup Handling

**Setup**:
1. Database with 100,000+ records
2. Backup file ~50MB

**Steps**:
1. Create backup
2. Download backup
3. Re-import backup

**Validation**:
- [ ] Large backups create successfully
- [ ] Download streams without memory issues
- [ ] No timeout errors
- [ ] Restore completes within reasonable time (<2 minutes)
- [ ] Temp extraction handles large files

**Expected Result**: ✅ PASS (Scales well)

---

## Regression Tests

### ✅ Test 15: Existing Backup Functionality Still Works

**Validation**:
- [ ] `GET /api/backup/list` returns all backups
- [ ] `GET /api/backup/info/{fileName}` returns metadata
- [ ] `POST /api/backup/create` creates new backups
- [ ] `DELETE /api/backup/delete/{fileName}` removes backups
- [ ] `GET /api/backup/location` returns backup directory
- [ ] Auto-cleanup keeps last 10 backups
- [ ] Auto-scheduling runs every 24 hours

**Expected Result**: ✅ PASS (No regressions)

---

## Summary of Critical Fixes

| Issue | Fix | Test |
|-------|-----|------|
| **Download corrupted/empty** | Proper streaming with correct headers, path validation | Test 1, 6, 12 |
| **ZIP import not working** | New `/api/backup/import` endpoint with unified restore | Test 2, 3, 5 |
| **Partial restore data loss** | Unified pipeline with atomic behavior | Test 4, 10 |
| **WAL/SHM lock issues** | Explicit cleanup before restore | Test 5 |
| **Zip-slip vulnerability** | Path validation during extraction | Test 8 |
| **Path traversal attack** | Filename validation, path resolution checks | Test 9 |
| **Production bundled path** | Refuse ASAR restore, force userData | Test 11, 12 |
| **Legacy v1.0.0 incompatibility** | Backward compatibility migrations | Test 3 |

---

## Test Execution Checklist

- [ ] All 15 tests completed
- [ ] All validation points checked
- [ ] No test marked FAIL
- [ ] Performance acceptable
- [ ] No data loss detected
- [ ] Production paths verified
- [ ] Security tests passed
- [ ] Error messages clear
- [ ] Logs review completed

---

## Sign-Off

**Date**: [Test Date]  
**Tester**: [Name]  
**Result**: ✅ **ALL TESTS PASSED** / ❌ **FAILURES DETECTED**  
**Notes**: [Any additional findings]

---

## Appendix: API Reference

### GET /api/backup/download/:fileName
Download a backup file with proper streaming.

**Headers**:
- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename=...`
- `Content-Length: [size]`
- `Cache-Control: no-cache, no-store, must-revalidate`

**Errors**:
- `400`: Invalid file name (path traversal detected)
- `403`: Access denied
- `404`: Backup file not found
- `500`: Download failed

---

### POST /api/backup/import
Import and restore a backup from uploaded file.

**Request**:
```
Content-Type: multipart/form-data
File: [ZIP or .db file, max 50MB]
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Backup imported and restored successfully",
  "restored": ["inventory.db", "stock.db"],
  "backupVersion": "2.0.0",
  "currentVersion": "2.0.0",
  "migrationsApplied": false
}
```

**Errors**:
- `400`: No file uploaded
- `400`: Invalid file type
- `413`: File too large
- `500`: Import/restore failed with details

---

### POST /api/backup/restore (existing)
Restore from backup in local backup directory.

**Request**:
```json
{
  "fileName": "backup_inventory_2025-01-10_10-30-45.zip"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Database restored successfully",
  "restored": ["inventory.db", "stock.db"],
  "backupVersion": "2.0.0",
  "currentVersion": "2.0.0",
  "migrationsApplied": false
}
```

---

### GET /api/backup/version
Get system version and features.

**Response**:
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

---

**End of Test Scenarios**
