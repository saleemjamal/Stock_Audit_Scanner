# Stock Audit Scanner - App Distribution Guide

## Overview
This app uses Firebase App Distribution for distributing test builds to team members without the Google Play Store.

## Prerequisites

1. **Firebase CLI** (one-time installation)
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Release Keystore** (already configured in gradle.properties)
   - Located in `android/app/`
   - Required for signing release builds

## Firebase Console Setup (One-Time)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **pj-stock-audit-scanner**
3. Navigate to **Release & Monitor** → **App Distribution**
4. Click **Get Started** if first time
5. Create a tester group:
   - Click **Testers & Groups** tab
   - Click **Add group**
   - Name: `internal-testers`
   - Add tester emails (one per line)
   - Save

## Building and Distributing

### Quick Distribution (Recommended)
```bash
cd mobile
npm run distribute
```
This will:
1. Clean previous builds
2. Build a signed release APK
3. Upload to Firebase App Distribution
4. Send emails to all testers in `internal-testers` group

### Distribution with Custom Release Notes
1. Create a `release-notes.txt` file in the mobile directory:
   ```
   echo "Version 1.0.1 - Fixed barcode scanning issue" > release-notes.txt
   ```

2. Run distribution with notes:
   ```bash
   npm run distribute:notes
   ```

### Manual Build Only (No Distribution)
```bash
npm run build:release
```
APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Tester Experience

### First Time Setup (Testers)
1. Receive email invitation from Firebase
2. Accept invitation (creates Firebase account if needed)
3. Install **App Tester** app from email link
4. Open App Tester → Find Stock Audit Scanner
5. Download and install

### Getting Updates (Testers)
1. Receive email notification of new version
2. Open App Tester app
3. Tap on Stock Audit Scanner
4. Download and install update

## Managing Testers

### Add New Testers
1. Firebase Console → App Distribution → Testers & Groups
2. Click on `internal-testers` group
3. Add email addresses
4. Save

### Remove Testers
1. Same location as above
2. Remove email addresses
3. Save

### Tester Permissions
After adding to Firebase, also add them to the app database:
1. Open Dashboard → User Management
2. Add user with same email
3. Set appropriate role (scanner/supervisor/superuser)
4. Assign locations

## Monitoring

### View Distribution Status
1. Firebase Console → App Distribution → Releases
2. See:
   - Who downloaded
   - Download counts
   - Version history
   - Feedback from testers

### Crashlytics Integration
Crashes from distributed builds automatically appear in:
- Firebase Console → Crashlytics

## Troubleshooting

### Build Fails
```bash
cd mobile/android
./gradlew clean
cd ..
npm run distribute
```

### Firebase CLI Issues
```bash
firebase logout
firebase login
```

### "App Not Installed" Error (Tester)
1. Enable "Install from Unknown Sources" in Android settings
2. Uninstall any previous version
3. Try installation again

### Distribution Upload Fails
1. Check Firebase CLI is logged in: `firebase login:list`
2. Verify project: `firebase projects:list`
3. Ensure you have permission in Firebase Console

## Version Management

### Current Version
Check `android/app/build.gradle`:
- `versionCode` - increment for each release
- `versionName` - user-visible version

### Before Each Release
1. Update version in `android/app/build.gradle`
2. Create release notes
3. Test on local device first
4. Then distribute

## Security Notes

- Never commit `google-services.json` changes (already in repo)
- Keep keystore passwords in `gradle.properties` (not in version control)
- Only add trusted emails to tester groups
- Testers must also be whitelisted in app database

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run android` | Development build (unchanged) |
| `npm run build:release` | Build APK only |
| `npm run distribute` | Build + upload to Firebase |
| `npm run distribute:notes` | Build + upload with release notes |

## Support

For issues with:
- **Firebase setup**: Check Firebase Console → App Distribution
- **Build problems**: Run `cd android && ./gradlew clean`
- **Tester access**: Verify email in both Firebase and app database