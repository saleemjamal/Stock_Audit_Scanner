# Firebase App Distribution Setup

## 1. Initial Setup

### Install Firebase Tools
```bash
npm install -g firebase-tools
```

### Add to Android Project
```gradle
// android/build.gradle
buildscript {
    dependencies {
        classpath 'com.google.firebase:firebase-appdistribution-gradle:4.0.1'
    }
}

// android/app/build.gradle
apply plugin: 'com.google.firebase.appdistribution'

firebaseAppDistribution {
    releaseNotes = "Stock audit app release"
    groups = "internal-testers"
}
```

## 2. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Add Android app:
   - Package name: `com.stockauditapp`
   - Download `google-services.json`
   - Place in `android/app/`
4. Enable App Distribution in console

## 3. Configure Testers

### Add Testers
```bash
firebase appdistribution:testers:add user1@gmail.com user2@gmail.com --project your-project-id
```

### Create Groups
```bash
firebase appdistribution:group:create internal-testers --project your-project-id
```

## 4. Build & Deploy

### First Time Setup
```bash
firebase login
firebase use your-project-id
```

### Build Release
```bash
cd android
./gradlew assembleRelease
```

### Deploy to Testers
```bash
./gradlew appDistributionUploadRelease
```

### Alternative: Firebase CLI
```bash
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups "internal-testers" \
  --release-notes "Bug fixes and improvements"
```

## 5. Tester Instructions

Send this to testers:
1. Check email for Firebase invite
2. Accept invitation
3. Download Firebase App Tester app
4. Install Stock Audit app through tester app
5. Enable "Install Unknown Apps" if prompted

## 6. CI/CD Integration (Optional)

### GitHub Actions
```yaml
name: Deploy to Firebase
on:
  push:
    branches: [release]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build APK
        run: |
          cd android
          ./gradlew assembleRelease
      - name: Deploy to Firebase
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_APP_ID }}
          token: ${{ secrets.FIREBASE_TOKEN }}
          groups: internal-testers
          file: android/app/build/outputs/apk/release/app-release.apk
```

## 7. Version Management

### Auto-increment version
```gradle
// android/app/build.gradle
def getVersionCode = { ->
    def code = project.hasProperty('versionCode') ? versionCode.toInteger() : 1
    return code
}

android {
    defaultConfig {
        versionCode getVersionCode()
        versionName "1.0.${getVersionCode()}"
    }
}
```

### Deploy with version
```bash
./gradlew assembleRelease -PversionCode=23
./gradlew appDistributionUploadRelease
```

## Common Issues

**"Unknown Sources" Error**
- Settings → Security → Enable Unknown Sources
- Or Settings → Apps → Special Access → Install Unknown Apps

**Tester Not Receiving Email**
- Check spam folder
- Verify email in Firebase console
- Resend invite from console

**Upload Failed**
- Check Firebase authentication: `firebase login`
- Verify app ID matches
- Ensure APK is signed

## Quick Deploy Script

Create `deploy.sh`:
```bash
#!/bin/bash
cd android
./gradlew clean
./gradlew assembleRelease
./gradlew appDistributionUploadRelease
echo "Deployed to Firebase App Distribution!"
```

Make executable: `chmod +x deploy.sh`
Run: `./deploy.sh`