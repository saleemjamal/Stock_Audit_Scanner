# Backend API Implementation Guide

## Project Structure
```
stock-audit-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── auth.js
│   │   └── socket.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── rackController.js
│   │   ├── scanController.js
│   │   ├── userController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── roles.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Rack.js
│   │   ├── Scan.js
│   │   └── Location.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── racks.js
│   │   ├── scans.js
│   │   └── reports.js
│   ├── services/
│   │   ├── emailService.js
│   │   └── auditService.js
│   └── app.js
├── .env
├── package.json
└── server.js
```

## Core Implementation

### 1. Authentication Setup
```javascript
// config/auth.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;

// Gmail login for scanners (simple JWT)
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Google OAuth for supervisors/admins
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  // Check if user exists and has supervisor/admin role
  const user = await User.findByEmail(profile.emails[0].value);
  if (user && ['supervisor', 'admin'].includes(user.role)) {
    return done(null, user);
  }
  return done(null, false);
}));
```
### 2. Rack Management Endpoints
```javascript
// controllers/rackController.js
const createRack = async (req, res) => {
  const { locationId, rackNumber, shelfNumber } = req.body;
  const userId = req.user.id;
  
  // Check if rack already exists and is active
  const existingRack = await Rack.findOne({
    location_id: locationId,
    rack_number: rackNumber,
    status: 'active'
  });
  
  if (existingRack && existingRack.scanner_id !== userId) {
    return res.status(409).json({ 
      error: 'Rack already being scanned by another user' 
    });
  }
  
  // Create or return existing rack
  const rack = existingRack || await Rack.create({
    location_id: locationId,
    rack_number: rackNumber,
    scanner_id: userId,
    status: 'active'
  });
  
  // Emit real-time update
  io.to(`location_${locationId}`).emit('rack:updated', {
    rackId: rack.id,
    status: 'active',
    scanner: req.user.email
  });
  
  res.json(rack);
};

const markReadyForApproval = async (req, res) => {
  const { rackId } = req.params;
  
  const rack = await Rack.findById(rackId);
  if (rack.scanner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  rack.ready_for_approval = true;
  await rack.save();
  
  // Notify supervisors
  io.to(`supervisors_${rack.location_id}`).emit('notification:new', {
    type: 'approval_needed',
    message: `Rack ${rack.rack_number} ready for approval`,
    rackId: rack.id
  });
  
  res.json({ success: true });
};
const approveRack = async (req, res) => {
  const { rackId } = req.params;
  
  const rack = await Rack.findById(rackId);
  if (!rack.ready_for_approval) {
    return res.status(400).json({ error: 'Rack not ready for approval' });
  }
  
  rack.status = 'completed';
  rack.approved_by = req.user.id;
  rack.approved_at = new Date();
  await rack.save();
  
  // Log audit trail
  await AuditLog.create({
    action: 'rack_approved',
    entity_type: 'rack',
    entity_id: rackId,
    user_id: req.user.id,
    details: { rack_number: rack.rack_number }
  });
  
  // Notify scanner
  io.to(`user_${rack.scanner_id}`).emit('rack:approved', { rackId });
  
  res.json({ success: true });
};

const rejectRack = async (req, res) => {
  const { rackId } = req.params;
  const { reason } = req.body;
  
  const rack = await Rack.findById(rackId);
  rack.status = 'rejected';
  await rack.save();
  
  // Create recount entry
  await AuditLog.create({
    action: 'rack_rejected',
    entity_type: 'rack',
    entity_id: rackId,
    user_id: req.user.id,
    details: { reason, scanner_id: rack.scanner_id }
  });
  
  // Notify original scanner for recount
  io.to(`user_${rack.scanner_id}`).emit('rack:rejected', { 
    rackId, 
    reason,
    message: 'Recount required' 
  });
  
  res.json({ success: true });
};
```

### 3. Socket.io Real-time Setup
```javascript
// config/socket.js
const initializeSocket = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: [process.env.MOBILE_APP_URL, process.env.WEB_DASHBOARD_URL],
      credentials: true
    }
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      socket.userId = user.id;
      socket.userRole = user.role;
      socket.locationIds = user.location_ids;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    // Join user-specific room
    socket.join(`user_${socket.userId}`);
    
    // Join location rooms
    socket.locationIds.forEach(locId => {
      socket.join(`location_${locId}`);
      if (['supervisor', 'admin'].includes(socket.userRole)) {
        socket.join(`supervisors_${locId}`);
      }
    });

    // Handle scan events
    socket.on('scan:new', async (data) => {
      const scan = await Scan.create(data);
      io.to(`location_${data.locationId}`).emit('scan:added', scan);
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
};
```

### 4. Environment Configuration
```bash
# .env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/stock_audit

# Auth
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# URLs
MOBILE_APP_URL=http://localhost:8081
WEB_DASHBOARD_URL=http://localhost:3001

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASS=app-specific-password
```