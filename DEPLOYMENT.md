# Stock Audit System - Deployment Guide

Complete guide for deploying mobile app and web dashboard updates.

## 🏗️ System Architecture

- **Mobile App**: React Native (Android) with Firebase App Distribution
- **Web Dashboard**: Next.js deployed on Vercel at `stockauditor.app`
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)

## 📱 Mobile App Deployment

### Prerequisites
```bash
# Required tools
- Node.js 18+
- React Native CLI: npm install -g react-native-cli
- Android Studio with SDK 33+
- Java JDK 17+
```

### Environment Setup
```bash
# mobile/.env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Development Commands
```bash
cd mobile

# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on Android device/emulator  
npx react-native run-android

# Clean cache (if issues)
npm run clean
```

### Building & Distribution

#### 1. Build Release APK
```bash
cd mobile

# Build release APK
npm run build:android

# APK location: mobile/android/app/build/outputs/apk/release/app-release.apk
```

#### 2. Deploy to Firebase App Distribution
```bash
cd mobile

# Deploy to testers (requires Firebase CLI setup)
npm run distribute

# Manual upload alternative:
# 1. Go to Firebase Console → App Distribution
# 2. Upload mobile/android/app/build/outputs/apk/release/app-release.apk
# 3. Add tester emails
# 4. Send notifications
```

### 🔐 Keystore Information

**Critical**: Keep keystore file secure - needed for all app updates!

**Location**: `mobile/android/app/my-release-key.keystore`

**Keystore Details**:
- **Alias**: `my-key-alias`
- **Store Password**: [SECURE - Store in password manager]
- **Key Password**: [SECURE - Store in password manager]

**Backup Keystore**:
```bash
# Create backup copy
cp mobile/android/app/my-release-key.keystore ~/keystore-backup/

# Store in secure location (Google Drive, 1Password, etc.)
```

**If Keystore is Lost**: Cannot update existing app - would need new app in Play Store!

### Troubleshooting Mobile
```bash
# Clear React Native cache
cd mobile && npm run clean

# Reset Metro bundler
npx react-native start --reset-cache

# Clean Android build
cd mobile/android && ./gradlew clean

# Check USB scanner connection
# Ensure device in Developer Mode with USB Debugging enabled
```

---

## 🌐 Dashboard Deployment

### Prerequisites
```bash
# Required tools
- Node.js 18+
- Vercel CLI: npm install -g vercel
```

### Environment Variables (Vercel)
```bash
# Dashboard Environment Variables (set in Vercel Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Development Commands
```bash
cd dashboard

# Install dependencies
npm install

# Start development server
npm run dev
# Access: http://localhost:3000

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production (test locally)
npm run build
```

### Production Deployment

#### Method 1: Vercel CLI (Recommended)
```bash
cd dashboard

# Deploy to production
vercel --prod

# First time: Will ask for project linking
# Subsequent deploys: Automatic
```

#### Method 2: Git Integration
```bash
# Push to main branch
git add .
git commit -m "Update dashboard"
git push origin main

# Vercel auto-deploys from main branch
```

### Domain Management
- **Production URL**: `https://stockauditor.app`
- **Staging URL**: `https://stockauditorapp.vercel.app`
- **Domain managed in**: Vercel Dashboard → Project → Settings → Domains

### OAuth Configuration Updates
When deploying to new domain, update:

1. **Google Cloud Console**:
   - APIs & Credentials → OAuth 2.0 Client IDs
   - Authorized redirect URIs: `https://stockauditor.app/dashboard`

2. **Supabase Dashboard**:
   - Authentication → URL Configuration
   - Site URL: `https://stockauditor.app`
   - Redirect URLs: `https://stockauditor.app/dashboard`

### Troubleshooting Dashboard
```bash
# Common build errors:
# 1. TypeScript errors - check for `any` types, missing imports
# 2. ESLint errors - disabled in .eslintrc.json
# 3. Environment variables - ensure set in Vercel Dashboard

# Local debugging
cd dashboard
npm run build  # Test build locally
npm run lint   # Check for linting issues
```

---

## 🔄 Complete Update Workflow

### 1. Code Changes
```bash
# Make changes in VS Code
# Test locally: mobile (npm start) + dashboard (npm run dev)
```

### 2. Mobile App Update
```bash
cd mobile
npm run build:android  # Build APK
npm run distribute     # Deploy to Firebase
```

### 3. Dashboard Update  
```bash
cd dashboard
vercel --prod          # Deploy to production
```

### 4. Testing
- **Mobile**: Test APK on physical device with USB scanner
- **Dashboard**: Test at `https://stockauditor.app`
- **End-to-End**: Scan → Review → Approve → Export CSV

---

## 🚨 Emergency Procedures

### Rollback Mobile App
- Firebase App Distribution → Previous release → Re-distribute
- No automatic rollback - manual process

### Rollback Dashboard
```bash
# Vercel automatic rollback
vercel --prod --rollback  # Previous deployment
```

### Database Issues
- **Backup**: Supabase auto-backups daily
- **Restore**: Supabase Dashboard → Database → Backups

---

## 📋 Pre-Deployment Checklist

### Mobile App
- [ ] Test on physical Android device with USB scanner
- [ ] Verify barcode scanning works (no duplicates)
- [ ] Test offline functionality
- [ ] Check queue system and sync
- [ ] Ensure no console errors in logs

### Dashboard  
- [ ] Test login with Google OAuth
- [ ] Verify reports page and CSV export
- [ ] Check all dashboard components load
- [ ] Test supervisor approval workflow
- [ ] Ensure single active session enforcement

### Both
- [ ] Environment variables correctly set
- [ ] No hardcoded localhost URLs
- [ ] All TypeScript errors resolved
- [ ] Database connectivity working

---

## 📞 Quick Reference

### Important URLs
- **Dashboard**: https://stockauditor.app
- **Vercel Project**: https://vercel.com/dashboard (stockauditorapp)
- **Supabase**: https://supabase.com/dashboard/project/your-project-id
- **Firebase**: https://console.firebase.google.com/project/your-project

### Key Commands
```bash
# Mobile deploy
cd mobile && npm run distribute

# Dashboard deploy  
cd dashboard && vercel --prod

# View mobile logs
npx react-native log-android

# Test dashboard build
cd dashboard && npm run build
```

### Support Contacts
- **Claude Code**: For development assistance
- **Vercel Support**: For deployment issues
- **Supabase Support**: For database issues
- **Firebase Support**: For app distribution issues

---

*Last Updated: August 14, 2025*
*System Status: ✅ Production Ready*