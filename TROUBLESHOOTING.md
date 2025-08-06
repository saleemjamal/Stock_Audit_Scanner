# React Native Troubleshooting Guide

## Current Status ✅
- ✅ Build successful - APK installs on emulator
- ✅ React Native Reanimated issue resolved
- ✅ Firebase configuration added
- ✅ NDK installation fixed
- ❌ App crashes when opened (need to debug)

## Issue: App Keeps Closing

### Problem
The app builds and installs successfully but crashes immediately when opened, even with Metro bundler running.

---

## Fix 1: Android SDK PATH Issue

### Current Error
```
error spawnSync :LOCALAPPDATA\Android\Sdk/platform-tools/adb ENOENT
```

### Solution: Fix Environment Variables

1. **Add ANDROID_HOME Environment Variable**
   ```
   Variable: ANDROID_HOME
   Value: C:\Users\salee\AppData\Local\Android\Sdk
   ```

2. **Add to Windows PATH**
   Add these paths to your PATH environment variable:
   ```
   C:\Users\salee\AppData\Local\Android\Sdk\platform-tools
   C:\Users\salee\AppData\Local\Android\Sdk\tools
   C:\Users\salee\AppData\Local\Android\Sdk\cmdline-tools\latest\bin
   ```

3. **Restart Required**
   - Close all terminals and VS Code
   - Restart applications to pick up new environment variables

4. **Verify Fix**
   ```bash
   adb version
   ```

---

## Fix 2: Get Crash Logs

### Method 1: Direct ADB (with full path)
```bash
"C:\Users\salee\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat | findstr "StockAuditScanner"
```

### Method 2: Metro Bundler Logs
Check the Metro terminal for red error messages when the app crashes.

### Method 3: Android Studio Logcat
1. Open Android Studio
2. Go to View → Tool Windows → Logcat
3. Filter by app package: `com.stockauditscanner`

---

## Fix 3: Common App Crash Causes

### A. Missing Environment Variables
The app likely needs Supabase configuration. Check if these are missing:

**Expected locations to check:**
- `mobile/.env` file
- `mobile/src/config/` directory
- Supabase URL and anon key configuration

### B. Database Initialization Issues
SQLite setup might be failing on first launch.

### C. Native Module Linking
Some native modules might not be properly linked after our dependency changes.

---

## Debugging Workflow

### Step 1: Clear App Data
```bash
adb shell pm clear com.stockauditscanner
```

### Step 2: Reinstall App
```bash
cd C:\Projects\Stock_Audit\mobile
npx react-native run-android
```

### Step 3: Start Fresh Metro
```bash
cd C:\Projects\Stock_Audit\mobile
npx react-native start --reset-cache
```

### Step 4: Check for JavaScript Errors
1. Open the app
2. Watch Metro terminal for red error screens
3. Note any specific error messages

### Step 5: Check Native Crashes
```bash
adb logcat | grep -i "fatal\|crash\|error"
```

---

## Quick Fixes to Try

### Fix 1: Environment Configuration
Create missing environment files for Supabase configuration.

### Fix 2: Database Reset
Clear any corrupted local database files.

### Fix 3: Permission Issues
Check if the app needs specific Android permissions that aren't granted.

### Fix 4: Metro Cache Reset
```bash
npx react-native start --reset-cache
```

---

## Success Criteria

When fixed, you should see:
1. ✅ ADB commands work without full path
2. ✅ App opens without crashing
3. ✅ Metro bundler shows successful connection
4. ✅ App displays the Stock Audit Scanner interface

---

## Notes

- The build system is working correctly
- All major setup issues (NDK, Firebase, dependencies) are resolved
- This is likely a configuration or initialization issue
- Once logs are visible, the specific problem will be clear

---

*Created: August 5, 2025*
*Status: App builds successfully, needs runtime debugging*