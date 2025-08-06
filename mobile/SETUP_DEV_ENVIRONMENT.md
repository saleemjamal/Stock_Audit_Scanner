# React Native Development Environment Setup (Windows)

Complete guide to set up React Native development environment for the Stock Audit Scanner mobile app.

## 🛠️ **Prerequisites**

Before starting, ensure you have:
- Windows 10/11 (64-bit)
- At least 15 GB free disk space
- Stable internet connection (will download ~8-10 GB)
- Administrator access to install software

## 📋 **Setup Checklist**

- [ ] Install Node.js 18+
- [ ] Install Java Development Kit (JDK 17)
- [ ] Install Android Studio
- [ ] Configure Android SDK
- [ ] Set up environment variables
- [ ] Create Android Virtual Device (AVD)
- [ ] Install React Native CLI
- [ ] Test the setup

---

## **Step 1: Install Node.js and Package Managers**

### 1.1 Download and Install Node.js
- Go to [nodejs.org](https://nodejs.org/)
- Download the **LTS version** (18.x or higher)
- Run the installer with **default settings**
- Restart your computer after installation

### 1.2 Verify Installation
Open Command Prompt and run:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

### 1.3 Install Yarn (Optional but Recommended)
```bash
npm install -g yarn
yarn --version  # Should show 1.x.x
```

---

## **Step 2: Install Java Development Kit (JDK)**

### 2.1 Download Microsoft OpenJDK 17
- Go to [Microsoft OpenJDK Downloads](https://docs.microsoft.com/en-us/java/openjdk/download#openjdk-17)
- Download the **Windows x64 MSI installer**
- Run installer with **default settings**

### 2.2 Verify Java Installation
```bash
java -version  # Should show openjdk version "17.x.x"
javac -version # Should show javac 17.x.x
```

If Java is not recognized, restart Command Prompt and try again.

---

## **Step 3: Install Android Studio**

### 3.1 Download Android Studio
- Go to [developer.android.com/studio](https://developer.android.com/studio)
- Download **Android Studio** (latest stable version)
- File size: ~1 GB

### 3.2 Install Android Studio
- Run the installer as Administrator
- Choose **"Standard" installation type**
- Accept all license agreements
- Let it download and install all components (~3-4 GB)
- This process takes 20-30 minutes

### 3.3 Complete Setup Wizard
- Start Android Studio
- Go through the setup wizard
- Install the Android SDK (API 33 or 34)
- Install Android SDK Build-Tools
- Install Intel HAXM (for emulator acceleration)

---

## **Step 4: Configure Android SDK**

### 4.1 Set Up Environment Variables

#### Method 1: Using Windows GUI
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click **"Environment Variables"**
3. Under **"User Variables"**, click **"New"**

#### Method 2: Using PowerShell (Run as Administrator)
```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

### 4.2 Add Environment Variables
Add these **User Environment Variables**:

| Variable Name | Value |
|---------------|-------|
| `ANDROID_HOME` | `C:\Users\%USERNAME%\AppData\Local\Android\Sdk` |

### 4.3 Update PATH Variable
Add these paths to your **PATH** environment variable:
```
%ANDROID_HOME%\emulator
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

### 4.4 Restart Command Prompt
**Important:** Close and reopen all Command Prompt/PowerShell windows.

### 4.5 Verify SDK Installation
```bash
adb version        # Should show Android Debug Bridge version
emulator -version  # Should show emulator version
```

---

## **Step 5: Create Android Virtual Device (AVD)**

### 5.1 Open AVD Manager
1. Open **Android Studio**
2. Go to **Tools → AVD Manager**
3. Click **"Create Virtual Device"**

### 5.2 Create Virtual Device
1. Choose **"Phone"** category
2. Select **"Pixel 6"** or similar modern device
3. Click **"Next"**
4. Download a system image:
   - Choose **API 33** or **API 34**
   - Select **x86_64** architecture
   - Click **"Download"** (this takes 10-15 minutes)
5. Name it **"StockAuditTester"**
6. Click **"Finish"**

### 5.3 Start the Emulator
- Click the **"Play"** button next to your AVD
- Wait for it to fully boot (first time takes 2-3 minutes)
- You should see an Android phone interface

---

## **Step 6: Install React Native CLI**

```bash
npm install -g @react-native-community/cli
```

Verify installation:
```bash
npx react-native --version
```

---

## **Step 7: Enable Developer Options (Physical Device - Optional)**

If you want to test on a real Android device:

### 7.1 On Your Android Device
1. Go to **Settings → About Phone**
2. Tap **"Build Number"** 7 times (you'll see "You are now a developer!")
3. Go back to **Settings → Developer Options**
4. Enable **"USB Debugging"**

### 7.2 Connect and Verify
1. Connect your device via USB
2. Allow USB debugging when prompted
3. Run: `adb devices` (should show your device)

---

## **Step 8: Test Your Setup**

### 8.1 Navigate to Project
```bash
cd "C:\Users\%USERNAME%\OneDrive\Desktop\Projects\Stock_Audit\mobile"
```

### 8.2 Ensure Environment File Exists
Verify you have `mobile/.env` file with Supabase credentials.

### 8.3 Install Dependencies (if not done)
```bash
npm install
```

### 8.4 Start Metro Bundler
```bash
npx react-native start
```
Keep this terminal open.

### 8.5 Run the App
In a **new terminal** window:
```bash
cd "C:\Users\%USERNAME%\OneDrive\Desktop\Projects\Stock_Audit\mobile"
npx react-native run-android
```

### 8.6 Expected Result
- App should install on emulator/device
- You should see the Stock Audit Scanner login screen
- Metro bundler should show "Loading dependency graph..."

---

## **🚨 Troubleshooting Common Issues**

### Issue: "adb not found" or "SDK not found"
**Solution:**
1. Restart all Command Prompt windows
2. Verify environment variables are set correctly
3. Make sure Android Studio SDK is installed

### Issue: "Unable to load script from assets"
**Solution:**
```bash
cd mobile
npx react-native start --reset-cache
```

### Issue: Build fails with Gradle errors
**Solution:**
```bash
cd mobile/android
./gradlew clean
cd ..
npx react-native run-android
```

### Issue: Emulator won't start
**Solution:**
1. Check if Hyper-V is disabled (Windows features)
2. Ensure Intel HAXM is installed
3. Try creating a new AVD with API 33

### Issue: Metro bundler connection issues
**Solution:**
```bash
cd mobile
rm -rf node_modules
npm install
npx react-native start --reset-cache
```

### Issue: "React Native CLI not found"
**Solution:**
```bash
npm install -g @react-native-community/cli
```

---

## **💾 Disk Space Requirements**

- **Node.js:** ~200 MB
- **JDK 17:** ~300 MB
- **Android Studio:** ~4 GB
- **Android SDK:** ~5 GB
- **Emulator images:** ~2 GB each
- **Project dependencies:** ~500 MB
- **Total:** ~12-15 GB

---

## **⏱️ Expected Timeline**

- **Download time:** 1-2 hours (depending on internet speed)
- **Installation time:** 30-45 minutes
- **Configuration time:** 15-20 minutes
- **First build:** 5-10 minutes
- **Subsequent builds:** 1-2 minutes

---

## **✅ Final Verification**

After complete setup, these commands should all work:

```bash
# Basic tools
node --version
java -version
adb version
npx react-native --version

# Android development
adb devices          # Shows connected devices/emulators
emulator -list-avds  # Shows available virtual devices

# Project specific
cd mobile
npm run android      # Should build and run the app
```

---

## **🎯 Success Criteria**

You've successfully set up the development environment when:
- [ ] Android emulator starts successfully
- [ ] `adb devices` shows your emulator or physical device
- [ ] `npx react-native run-android` builds without errors
- [ ] Stock Audit Scanner app launches on the device/emulator
- [ ] You can see the login screen

---

## **📞 Getting Help**

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Restart your computer if environment variables aren't recognized
4. Make sure Android Studio can see your SDK installations

The initial setup is time-consuming but you only need to do it once. After this, building and testing the app will be much faster!

---

## **Next Steps After Setup**

Once your development environment is ready:
1. Test the Stock Audit Scanner app
2. Set up the web dashboard (`cd dashboard && npm run dev`)
3. Configure your Supabase database with the provided SQL scripts
4. Test the complete workflow: mobile scanning → web dashboard approval