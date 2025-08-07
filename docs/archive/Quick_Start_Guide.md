# Quick Start Guide - Stock Audit Scanner App

## Prerequisites
- Node.js 18+ and npm/yarn
- Android Studio with Android SDK 28+
- React Native CLI
- Android device with USB debugging enabled
- USB OTG adapter
- Compatible USB barcode scanner

## Setup Instructions

### 1. Clone and Install
```bash
# Clone the repository
git clone [repository-url]
cd stock_audit_app

# Install dependencies
npm install

# Install pods for iOS (if needed later)
cd ios && pod install && cd ..
```

### 2. Configure Google Sheets API

#### Step 1: Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google Sheets API
4. Create Service Account:
   - Go to "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: "stock-audit-app"
   - Grant role: "Editor"
   - Create and download JSON key

#### Step 2: Setup Spreadsheet
1. Create new Google Sheet
2. Share with service account email (found in JSON key)
3. Create these sheets:
   - "Scans" - For raw scan data
   - "Device_Status" - For device tracking
   - "Summary" - For aggregated data
4. Copy spreadsheet ID from URL

#### Step 3: Add Credentials to App
```bash
# Create credentials directory
mkdir android/app/src/main/assets

# Copy service account JSON
cp ~/Downloads/service-account-key.json android/app/src/main/assets/credentials.json
```

### 3. Configure Android Device

#### Enable Developer Options
1. Settings → About Phone
2. Tap "Build Number" 7 times
3. Enable "Developer Options"
4. Enable "USB Debugging"
#### Check USB OTG Support
1. Download "USB OTG Checker" from Play Store
2. Connect USB OTG adapter
3. Verify device supports USB Host mode

### 4. Build and Run

#### Development Build
```bash
# Start Metro bundler
npx react-native start

# In another terminal, run on Android
npx react-native run-android
```

#### Release Build
```bash
# Generate release APK
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

### 5. Scanner Configuration

#### Recommended Scanner Settings
Most USB scanners need configuration via special barcodes. Print these from scanner manual:

1. **Set to USB HID Mode**
2. **Add Tab/Enter suffix**
3. **Enable beep on scan**
4. **Set appropriate scan speed**

#### Test Scanner Connection
1. Connect scanner via USB OTG
2. Open any text app (Notes, etc.)
3. Scan a barcode
4. Should see barcode text + tab/enter

### 6. App Configuration

#### First Launch Setup
1. **Device ID**: Auto-generated, can be customized in Settings
2. **User Login**: Select or create user profile
3. **Location**: Set warehouse location/zone
4. **Sync Settings**: Configure sync interval (default 5 min)

#### Environment Variables
Create `.env` file in project root:
```
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
SYNC_INTERVAL_MINUTES=5
BATCH_SIZE=100
API_TIMEOUT=30000
```

### 7. Testing Workflow

#### Basic Scanning Test
1. Launch app
2. Ensure scanner is connected (green indicator)
3. Scan test barcode
4. Verify:
   - Barcode appears in scan list
   - Count increments
   - Haptic feedback works
   - No duplicate warning (first scan)
#### Offline Mode Test
1. Enable airplane mode
2. Scan 10-20 barcodes
3. Check sync queue indicator
4. Re-enable network
5. Verify automatic sync

#### Multi-Device Test
1. Setup 2+ devices with unique IDs
2. Scan same barcode on different devices
3. Verify duplicate detection works
4. Check Google Sheets for both entries

### 8. Troubleshooting

#### Scanner Not Working
- **Issue**: Scanner connects but doesn't input text
  - Check USB OTG support
  - Try different USB port/adapter
  - Verify scanner is in HID mode
  
- **Issue**: Partial barcode scans
  - Reduce scan speed in scanner settings
  - Clean scanner window
  - Check barcode quality

#### Sync Issues
- **Issue**: Sync failing
  - Check network connection
  - Verify Google Sheets permissions
  - Check API quota limits
  - Review error logs in app

- **Issue**: Duplicate entries in sheet
  - Check device ID uniqueness
  - Verify timestamp precision
  - Review sync conflict logic

#### Performance Issues
- **Issue**: App slowing down after many scans
  - Check local database size
  - Run database cleanup
  - Clear old sync logs
  - Restart app

### 9. Deployment Checklist

- [ ] Production Google Sheets created and shared
- [ ] Service account credentials secured
- [ ] All test cases passed
- [ ] User documentation prepared
- [ ] Training videos recorded
- [ ] Backup scanners available
- [ ] IT support briefed
- [ ] Rollback plan ready

### 10. Support Contacts

- **Technical Issues**: dev-team@company.com
- **User Support**: support@company.com
- **Emergency**: +1-xxx-xxx-xxxx

---

## Common Commands Reference

```bash
# View device logs
adb logcat | grep "StockAudit"

# Clear app data
adb shell pm clear com.stockauditapp

# Install APK
adb install -r app-release.apk

# Database debugging
adb shell
run-as com.stockauditapp
sqlite3 databases/stockaudit.db
.tables
SELECT COUNT(*) FROM scans;
```