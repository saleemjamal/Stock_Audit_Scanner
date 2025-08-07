# Deployment Guide - Stock Audit System

## System Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Web Dashboard │     │     Backend     │
│  (React Native) │────▶│    (Next.js)    │────▶│   (Node.js)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                              ┌───────────────────────────▼────────┐
                              │        PostgreSQL Database         │
                              └───────────────────────────────────┘
```

## 1. Backend Deployment (AWS/Google Cloud)

### Option A: AWS Deployment

#### EC2 Setup
```bash
# 1. Launch EC2 instance (t3.medium recommended)
# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql nginx certbot

# 4. Clone backend repository
git clone your-backend-repo
cd stock-audit-backend
npm install

# 5. Setup environment variables
nano .env
# Add production values

# 6. Setup PM2 for process management
npm install -g pm2
pm2 start server.js --name stock-audit-api
pm2 save
pm2 startup
```

#### RDS PostgreSQL Setup
1. Create RDS PostgreSQL instance
2. Configure security groups
3. Run database migrations:
```bash
npm run migrate:production
```

#### Load Balancer & SSL
1. Create Application Load Balancer
2. Configure target groups
3. Setup SSL certificate via ACM
4. Point domain to load balancer

### Option B: Google Cloud Run

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/stock-audit-api', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/stock-audit-api']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'stock-audit-api'
      - '--image=gcr.io/$PROJECT_ID/stock-audit-api'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
```

## 2. Web Dashboard Deployment (Vercel)

### Vercel Deployment
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
cd stock-audit-dashboard
vercel --prod

# 3. Configure environment variables in Vercel dashboard
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://dashboard.yourdomain.com
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```
### Custom Domain Setup
1. Add custom domain in Vercel
2. Update DNS records
3. SSL automatically provisioned

## 3. Mobile App Deployment

### Android Build & Release

#### 1. Generate Signed APK
```bash
cd android
# Generate keystore (first time only)
keytool -genkey -v -keystore stock-audit.keystore -alias stock-audit -keyalg RSA -keysize 2048 -validity 10000

# Build release APK
./gradlew assembleRelease
```

#### 2. Configure gradle.properties
```
MYAPP_RELEASE_STORE_FILE=stock-audit.keystore
MYAPP_RELEASE_KEY_ALIAS=stock-audit
MYAPP_RELEASE_STORE_PASSWORD=your-password
MYAPP_RELEASE_KEY_PASSWORD=your-password
```

#### 3. Play Store Deployment
1. Create app in Google Play Console
2. Upload signed APK
3. Fill store listing:
   - App name: Stock Audit Scanner
   - Category: Business
   - Content rating: Everyone
4. Setup internal testing track first
5. Gradual rollout to production

### iOS Build (Future)
```bash
# Install pods
cd ios && pod install

# Open in Xcode
open StockAuditApp.xcworkspace

# Archive and upload to App Store Connect
```

## 4. Environment Configuration

### Production Environment Variables

#### Backend (.env)
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/stockaudit
JWT_SECRET=strong-random-secret
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
REDIS_URL=redis://your-redis-endpoint
SENTRY_DSN=your-sentry-dsn
```

#### Mobile App (config.js)
```javascript
export const config = {
  API_URL: __DEV__ 
    ? 'http://localhost:3000' 
    : 'https://api.stockaudit.com',
  SOCKET_URL: __DEV__
    ? 'ws://localhost:3000'
    : 'wss://api.stockaudit.com'
};
```

## 5. Monitoring & Maintenance

### Setup Monitoring
1. **Sentry** for error tracking
2. **CloudWatch/Stackdriver** for logs
3. **Uptime monitoring** (Pingdom/UptimeRobot)
4. **Database monitoring**

### Backup Strategy
```bash
# Automated daily backups
0 2 * * * pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
# Upload to S3
aws s3 cp backup_*.sql s3://your-backup-bucket/
```

### Update Process
1. Test updates in staging environment
2. Schedule maintenance window
3. Deploy backend first
4. Deploy web dashboard
5. Release mobile app update
6. Monitor for issues

## 6. Security Checklist

- [ ] SSL certificates configured
- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Authentication tokens expire
- [ ] Audit logs enabled
- [ ] Regular security updates

## 7. Performance Optimization

### Backend
- Enable Redis caching
- Database connection pooling
- Query optimization
- Gzip compression

### Mobile App
- Code splitting
- Image optimization
- Offline data compression
- Background sync optimization

### Web Dashboard
- Static generation where possible
- Image optimization
- Bundle size optimization
- CDN for static assets

## 8. Rollback Plan

1. Keep previous versions tagged
2. Database migration rollback scripts
3. Quick APK rollback via Play Console
4. Blue-green deployment for zero downtime

## Support Documentation

Create and maintain:
- User training videos
- FAQ documentation
- Troubleshooting guide
- Admin manual

---

This deployment ensures a robust, scalable production environment for the stock audit system.