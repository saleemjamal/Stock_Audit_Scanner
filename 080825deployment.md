# Stock Audit Scanner - Deployment Guide
**Date:** August 8, 2025  
**Version:** Mobile Whitelisting Security Update

## 🎯 **Deployment Overview**

This guide covers deploying the Stock Audit Scanner mobile app for internal testing without Google Play Store approval, using Firebase App Distribution as the primary method.

### **Current Architecture:**
- ✅ **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- ✅ **Mobile:** React Native with Google OAuth
- ✅ **Dashboard:** Next.js with Google OAuth
- ✅ **Security:** Whitelisting system (both platforms)

## 📱 **Physical Device Testing Options**

### **Option 1: USB Debugging (Development)**

**Setup Android Device:**
1. **Enable Developer Options:**
   - Settings → About Phone
   - Tap "Build Number" 7 times rapidly
   - Developer Options appears in Settings

2. **Enable USB Debugging:**
   - Settings → Developer Options
   - Turn ON "USB Debugging"
   - Turn ON "Stay Awake" (helpful during testing)

3. **Connect & Run:**
   ```bash
   cd mobile
   adb devices  # Verify device connected
   npx react-native run-android
   ```

### **Option 2: Wireless Debugging (Android 11+)**
```bash
# Enable wireless debugging in Developer Options
adb connect <DEVICE_IP>:5555
npx react-native run-android
```

### **Option 3: Direct APK Install**
```bash
cd mobile
npm run build:android-debug
# Manually install: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## 🚀 **Firebase App Distribution (Recommended for Team Testing)**

### **Why Firebase App Distribution?**
- ✅ **Bypasses Google Play Store approval**
- ✅ **Easy team distribution via email invites**
- ✅ **Automatic update notifications for testers**
- ✅ **Built-in crash reporting and analytics**
- ✅ **Professional testing experience**
- ✅ **No backend changes needed** (keep Supabase)

### **Setup Process (15 minutes):**

#### **1. Install Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
```

#### **2. Create Firebase Project** (if needed)
- Go to [Firebase Console](https://console.firebase.google.com/)
- Create new project or use existing
- Add Android app with package name: `com.stockauditscanner`

#### **3. Build and Deploy**
```bash
cd mobile

# Build debug APK
npm run build:android-debug

# Deploy to Firebase App Distribution
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups "internal-testers" \
  --release-notes "Stock Audit Scanner v1.0 - Google OAuth with whitelisting security"
```

#### **4. Add Testers**
```bash
# Add individual testers
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_FIREBASE_APP_ID \
  --testers "saleem@poppatjamals.com,supervisor1@poppatjamals.com,john@company.com"

# Or create tester groups in Firebase Console
```

### **Tester Experience:**
1. Receive email invitation
2. Install "Firebase App Tester" from Play Store
3. Accept invitation and download app
4. Get automatic notifications for new versions

## 🔧 **Environment Configuration**

### **Mobile App Environment**
Ensure `mobile/.env` has correct Supabase credentials:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### **Google OAuth Configuration**
Web Client ID is already configured in:
- File: `mobile/src/services/googleSignIn.ts`
- Current ID: `318174569372-71q77m38ou4br513pl9egl3kne3a6j5s.apps.googleusercontent.com`

## 🧪 **Testing Scenarios**

### **Security Testing (Whitelisting):**

#### **Test 1: Authorized User**
- **User:** `saleem@poppatjamals.com` (superuser)
- **Expected:** ✅ Access granted, full mobile functionality
- **Platform:** Mobile app only initially

#### **Test 2: Unauthorized User** 
- **User:** Random Google account not in system
- **Expected:** ❌ Immediate sign-out with error message
- **Message:** "Access denied. Your Google account (email) is not authorized..."

#### **Test 3: Role-Based Access**
- **Scanner Role:** Should work on mobile only
- **Supervisor Role:** Should work on both mobile and dashboard
- **Dashboard Access:** Scanners blocked, supervisors/superusers allowed

### **Functionality Testing:**
1. **Google Sign-in Flow:** OAuth works smoothly
2. **Location Selection:** Users see assigned locations only
3. **Offline Mode:** App works without internet for scanning
4. **Real-time Sync:** Data syncs when back online
5. **Barcode Scanning:** Camera and USB scanner input

## 🚨 **Pre-Deployment Checklist**

### **Database Preparation:**
- [ ] Test users created with Google emails
- [ ] Locations added to system
- [ ] Audit sessions ready for testing
- [ ] RLS policies active and tested

### **Mobile App:**
- [ ] Google OAuth configured
- [ ] Supabase connection working  
- [ ] Whitelisting security implemented
- [ ] Error handling for unauthorized users
- [ ] Build successful: `npm run build:android-debug`

### **Security Verification:**
- [ ] Auto-user creation disabled
- [ ] Proper whitelisting implemented
- [ ] Unauthorized users blocked immediately
- [ ] Error messages clear and helpful

## 📊 **Alternative Deployment Methods**

### **Google Play Console - Internal Testing**
```bash
# More formal but still bypasses public approval
# Upload APK to Play Console → Internal Testing track
# Share test link with team members
# Requires Google Developer account ($25 one-time)
```

### **Direct APK Distribution**
```bash
# Simple file sharing approach
cd mobile
npm run build:android-debug
# Share APK file via email/cloud storage
# Location: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔄 **Update Process**

### **For New Builds:**
```bash
cd mobile

# Make code changes
# Update version in android/app/build.gradle if needed

# Build new APK
npm run build:android-debug

# Deploy update
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups "internal-testers" \
  --release-notes "Bug fixes and improvements"
```

### **Testers Get:**
- Automatic notification of new version
- One-click update process
- Release notes explaining changes

## 📞 **Support Information**

### **For Users Having Issues:**
- **System Administrator:** saleem@poppatjamals.com
- **Access Requests:** Contact admin to be added to whitelist
- **Technical Issues:** Check internet connection, Google Services installed

### **Common Issues:**
1. **"Access Denied"** → User not whitelisted, contact admin
2. **Google Sign-in Fails** → Check internet, Google Services
3. **App Won't Install** → Enable "Unknown Sources" for APK installs
4. **No Locations Visible** → User not assigned locations, contact admin

## 🎯 **Next Steps After Deployment**

1. **Monitor Firebase Analytics** for usage patterns
2. **Collect feedback** from internal testers  
3. **Fix bugs** based on real usage
4. **Add missing features** identified during testing
5. **Plan production rollout** when ready

---

**Note:** This deployment method is perfect for internal testing and bypasses Google Play Store approval entirely. Your Supabase backend remains unchanged - Firebase only handles app distribution.