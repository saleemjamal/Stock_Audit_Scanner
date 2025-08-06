# Stock Audit Scanner - Mobile App

React Native Android application for barcode scanning with offline capability.

## 🏗️ Setup

### Prerequisites
- Node.js 18+
- Android Studio with Android SDK 28+
- React Native CLI
- Android device with USB debugging enabled
- USB OTG adapter + compatible USB barcode scanner

### Installation

```bash
# Install dependencies
npm install

# Install pods (if iOS support added later)
cd ios && pod install && cd ..

# Start Metro bundler
npx react-native start

# Run on Android device
npx react-native run-android
```

### Environment Setup

Create `.env` file in mobile directory:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## 📱 Features

### Core Functionality
- **USB Scanner Integration**: Automatic barcode scanning via USB OTG
- **Offline-First**: SQLite local storage with background sync
- **Rack Management**: Dropdown selection and assignment
- **Authentication**: Email OTP and Google OAuth via Supabase
- **Supervisor Approvals**: Real-time notification system

### User Flows
1. **Scanner Login**: Email-based authentication
2. **Rack Selection**: Choose from available racks in audit session
3. **Scanning**: USB scanner or manual barcode entry
4. **Approval Request**: Mark rack ready for supervisor review
5. **Sync**: Automatic background synchronization

## 🏗️ Architecture

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── navigation/         # Navigation setup
├── store/             # Redux store and slices
├── services/          # API and business logic
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── hooks/             # Custom React hooks
```

### Key Components
- **ScannerInput**: Handles USB scanner input and manual entry
- **RackSelector**: Dropdown for rack selection
- **ScanList**: Displays scanned items with offline indicators
- **SyncManager**: Handles background synchronization
- **AuthProvider**: Manages authentication state

## 🔧 Configuration

### Scanner Setup
1. Connect USB scanner via OTG adapter
2. Configure scanner to HID keyboard mode
3. Set suffix to Tab or Enter
4. Enable beep feedback

### Database
- Local SQLite database for offline operation
- Automatic sync every 5 minutes when online
- Conflict resolution with server priority

### Permissions
Required Android permissions:
- `INTERNET` - Network access
- `ACCESS_NETWORK_STATE` - Network state monitoring
- `VIBRATE` - Haptic feedback
- `WAKE_LOCK` - Keep screen active during scanning
- `USB_HOST` - USB OTG support

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests (requires device)
npm run test:e2e

# Run specific test file
npm test -- ScannerInput.test.js
```

## 📦 Building

### Debug Build
```bash
npm run build:android-debug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release Build
```bash
npm run build:android
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## 🚀 Deployment

### Firebase App Distribution
```bash
# Upload to Firebase
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app your-firebase-app-id \
  --groups testers
```

## 🐛 Troubleshooting

### Scanner Issues
- Verify USB OTG support: Use "USB OTG Checker" app
- Check scanner mode: Should be HID keyboard mode
- Test in simple text app first

### Sync Issues
- Check network connectivity
- Verify Supabase credentials
- Review logs: `adb logcat | grep StockAudit`

### Performance Issues
- Clear app data: `adb shell pm clear com.stockauditscanner`
- Check database size in settings
- Restart Metro bundler

## 📝 Notes

- Target Android 9.0+ (API 28)
- Optimized for tablet use (7-10 inch screens)
- Supports landscape and portrait orientations
- Battery optimized for 8+ hour shifts