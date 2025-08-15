# CRITICAL: Keystore Backup Instructions

## ⚠️ EXTREMELY IMPORTANT ⚠️
Your keystore file is the ONLY way to update your app. If you lose it, you cannot update the app ever again!

## Files to Backup

### 1. Keystore File
**Location**: `mobile/android/app/release-keystore.jks`
**Created**: Today
**Validity**: 10,000 days (until ~2051)

### 2. Keystore Credentials
```
Keystore Password: StockAudit2024!
Key Alias: stock-audit-key
Key Password: StockAudit2024!
```

## Backup Locations (Do ALL of These)

1. **Cloud Storage** (Google Drive/Dropbox)
   - Create folder: "Stock-Audit-Keystore-Backup"
   - Upload `release-keystore.jks`
   - Save this file as "keystore-info.txt"

2. **USB Drive**
   - Copy `release-keystore.jks`
   - Copy this documentation

3. **Password Manager**
   - Store passwords and alias
   - Attach keystore file if supported

4. **Email to Yourself**
   - Subject: "Stock Audit Keystore - DO NOT DELETE"
   - Attach keystore and credentials

## When You Need This

- **App Updates**: Every release needs this keystore
- **New Developer Machine**: Copy keystore to new setup
- **Team Member Builds**: They need this to create releases
- **Firebase Distribution**: All uploads need signing

## Recovery Instructions

If setting up on new machine:
1. Copy `release-keystore.jks` to `mobile/android/app/`
2. Add to `mobile/android/gradle.properties`:
   ```
   MYAPP_UPLOAD_STORE_FILE=release-keystore.jks
   MYAPP_UPLOAD_STORE_PASSWORD=StockAudit2024!
   MYAPP_UPLOAD_KEY_ALIAS=stock-audit-key
   MYAPP_UPLOAD_KEY_PASSWORD=StockAudit2024!
   ```

## Security Notes

- **Never share publicly** (GitHub, forums, etc.)
- **Never commit to Git** (already in .gitignore)
- **Change passwords** if compromised
- **Keep multiple backups** in different locations

## Keystore Details

- **CN**: Stock Audit Scanner
- **Organization**: PJ Stock Audit
- **Location**: Dallas, TX, US
- **Algorithm**: RSA 2048-bit
- **Certificate**: SHA256withRSA

## Lost Keystore = Cannot Update App!

If you lose this keystore:
- Cannot update existing app installations
- Must create entirely new app with different package name
- All users must uninstall old app and install new one
- Lose all user data and settings

**BACKUP NOW - DON'T WAIT!**