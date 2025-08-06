# React Native Troubleshooting Guide

## Current Status ✅
- ✅ Build successful - APK installs on emulator
- ✅ React Native Reanimated issue resolved
- ✅ Firebase configuration added
- ✅ NDK installation fixed
- ✅ MainApplication.java and MainActivity.java created
- ✅ Gesture Handler dependency conflicts resolved
- ✅ Metro configuration fixed for shared folder access
- ✅ App launches successfully

## Issues Resolved

### Issue 1: App Crashes - Missing Java Files

**Error:**
```
java.lang.ClassNotFoundException: Didn't find class "com.stockauditscanner.MainApplication"
```

**Root Cause:** 
React Native project was missing essential Java bootstrap files (`MainActivity.java` and `MainApplication.java`) that should have been auto-generated during project initialization.

**Solution:**
1. Created `mobile/android/app/src/main/java/com/stockauditscanner/MainActivity.java`
2. Created `mobile/android/app/src/main/java/com/stockauditscanner/MainApplication.java` 
3. Created `mobile/android/app/src/main/java/com/stockauditscanner/ReactNativeFlipper.java`
4. These files are standard React Native boilerplate - they just load the JavaScript bundle.

---

### Issue 2: React Native Gesture Handler Dependency Conflicts

**Error:**
```
Error: Unable to resolve module react-native-reanimated from react-native-gesture-handler
```

**Root Cause:**
- `react-native-gesture-handler@2.14.0` requires `react-native-reanimated` 
- `react-native-reanimated` was previously removed due to compilation issues
- `@react-navigation/stack` depends on `react-native-gesture-handler`

**Solution - Migration to Native Stack:**
1. **Removed problematic dependencies:**
   ```bash
   npm uninstall react-native-gesture-handler @react-navigation/stack
   ```

2. **Installed compatible alternative:**
   ```bash
   npm install @react-navigation/native-stack@^6.9.0
   ```

3. **Updated all navigation files:**
   - `AppNavigator.tsx`: `createStackNavigator` → `createNativeStackNavigator`
   - `AuthNavigator.tsx`: `createStackNavigator` → `createNativeStackNavigator` 
   - `MainNavigator.tsx`: `createStackNavigator` → `createNativeStackNavigator`

4. **Removed GestureHandlerRootView from App.tsx:**
   ```jsx
   // Before
   import { GestureHandlerRootView } from 'react-native-gesture-handler';
   <GestureHandlerRootView style={{ flex: 1 }}>
   
   // After  
   import { View } from 'react-native';
   <View style={{ flex: 1 }}>
   ```

**Benefits:**
- ✅ No dependency on react-native-reanimated
- ✅ Native performance (uses native navigation)
- ✅ Simpler dependency tree
- ✅ Same navigation API

---

### Issue 3: Shared Folder Module Resolution

**Error:**
```
Error: Unable to resolve module ../../../shared/utils/constants from mobile/src/utils/theme.ts
```

**Root Cause:**
Metro bundler cannot resolve files outside the React Native project directory by default.

**Solution - Metro Configuration:**
Updated `mobile/metro.config.js` to include shared folder:

```javascript
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [
    path.resolve(__dirname, '../shared'),  // ← Added this
  ],
  // ... rest of config
};

module.exports = mergeConfig(defaultConfig, config);
```

**Result:**
- ✅ Mobile app can import from `../../../shared/utils/constants`
- ✅ Shared TypeScript types work across mobile and dashboard
- ✅ Single source of truth for constants

---

### Issue 4: Metro Asset Loading Error

**Error:**
```
Error: Unable to resolve module missing-asset-registry-path from react-native/Libraries/LogBox/UI/LogBoxImages/close.png
```

**Root Cause:**
Custom Metro configuration wasn't properly merging with React Native's default asset handling.

**Solution:**
Used `mergeConfig` to properly extend default Metro configuration instead of overriding it completely.

---

## Legacy Issues (Previously Resolved)

### Fix 1: Android SDK PATH Issue

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