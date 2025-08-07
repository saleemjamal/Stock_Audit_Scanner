# Next.js Web Dashboard Implementation

## Project Structure
```
stock-audit-dashboard/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── approvals/
│   │   │   └── page.tsx
│   │   ├── locations/
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   └── reports/
│   │       └── page.tsx
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── dashboard/
│   │   ├── LiveFeed.tsx
│   │   ├── MetricsCard.tsx
│   │   └── PendingApprovals.tsx
│   ├── approvals/
│   │   ├── RackList.tsx
│   │   └── RackDetail.tsx
│   └── shared/
│       ├── DataTable.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── api.ts
│   ├── socket.ts
│   └── auth.ts
├── hooks/
│   ├── useSocket.ts
│   └── useRealtime.ts
└── types/
    └── index.ts
```

## Key Components

### 1. Authentication Setup
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Verify user has supervisor/admin role
      const response = await fetch(`${process.env.API_URL}/auth/verify-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      
      const data = await response.json();
      return data.hasAccess;
    },
  },
});

export { handler as GET, handler as POST };
### 2. Real-time Dashboard Component
```typescript
// components/dashboard/LiveFeed.tsx
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useSocket } from '@/hooks/useSocket';

interface ScanEvent {
  id: string;
  barcode: string;
  rackNumber: string;
  location: string;
  scanner: string;
  timestamp: string;
}

export default function LiveFeed() {
  const [recentScans, setRecentScans] = useState<ScanEvent[]>([]);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('scan:added', (scan: ScanEvent) => {
      setRecentScans(prev => [scan, ...prev].slice(0, 10));
    });

    return () => {
      socket.off('scan:added');
    };
  }, [socket]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Live Scanning Activity
        </Typography>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {recentScans.map((scan) => (
            <Box key={scan.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="body2">
                {scan.scanner} scanned {scan.barcode}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {scan.location}-{scan.rackNumber} • {new Date(scan.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
```

### 3. Approval Management Page
```typescript
// app/(dashboard)/approvals/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow,
  Button,
  Dialog,
  Typography
} from '@mui/material';
import { api } from '@/lib/api';
export default function ApprovalsPage() {
  const [pendingRacks, setPendingRacks] = useState([]);
  const [selectedRack, setSelectedRack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPendingRacks();
  }, []);

  const fetchPendingRacks = async () => {
    const data = await api.get('/racks/pending');
    setPendingRacks(data);
  };

  const handleApprove = async (rackId: string) => {
    setIsLoading(true);
    await api.post(`/racks/${rackId}/approve`);
    await fetchPendingRacks();
    setSelectedRack(null);
    setIsLoading(false);
  };

  const handleReject = async (rackId: string, reason: string) => {
    setIsLoading(true);
    await api.post(`/racks/${rackId}/reject`, { reason });
    await fetchPendingRacks();
    setSelectedRack(null);
    setIsLoading(false);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Pending Approvals
      </Typography>
      
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Rack</TableCell>
              <TableCell>Scanner</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Ready Since</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingRacks.map((rack: any) => (
              <TableRow key={rack.id}>
                <TableCell>{rack.location}</TableCell>
                <TableCell>{rack.rackNumber}</TableCell>
                <TableCell>{rack.scanner}</TableCell>
                <TableCell>{rack.itemCount}</TableCell>
                <TableCell>{new Date(rack.readyAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Button 
                    variant="contained" 
                    size="small"
                    onClick={() => setSelectedRack(rack)}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
```
### 4. Socket Hook for Real-time Updates
```typescript
// hooks/useSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: {
        token: session.accessToken
      }
    });

    socketInstance.on('connect', () => {
      console.log('Connected to server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [session]);

  return socket;
}
```

### 5. Dashboard Overview Page
```typescript
// app/(dashboard)/page.tsx
'use client';
import { Grid, Box } from '@mui/material';
import MetricsCard from '@/components/dashboard/MetricsCard';
import LiveFeed from '@/components/dashboard/LiveFeed';
import PendingApprovals from '@/components/dashboard/PendingApprovals';
import LocationProgress from '@/components/dashboard/LocationProgress';

export default function DashboardPage() {
  return (
    <Box>
      <Grid container spacing={3}>
        {/* Metrics Row */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard 
            title="Active Scanners" 
            value="12" 
            change="+3 from yesterday"
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard 
            title="Items Scanned Today" 
            value="4,521" 
            change="+18.2%"
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard 
            title="Pending Approvals" 
            value="8" 
            change="2 urgent"
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard 
            title="Completion Rate" 
            value="67%" 
            change="Est. 2 hours remaining"
            color="info"
          />
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <LiveFeed />
        </Grid>
        <Grid item xs={12} md={4}>
          <PendingApprovals />
        </Grid>
        
        {/* Location Progress */}
        <Grid item xs={12}>
          <LocationProgress />
        </Grid>
      </Grid>
    </Box>
  );
}
```
### 6. API Client Library
```typescript
// lib/api.ts
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '';
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

### 7. Report Generation
```typescript
// app/(dashboard)/reports/page.tsx
'use client';
import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  DatePicker
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('audit-summary');
  const [location, setLocation] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });
  const handleGenerateReport = async () => {
    const params = new URLSearchParams({
      type: reportType,
      location,
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString()
    });

    const response = await fetch(`/api/reports/generate?${params}`);
    const blob = await response.blob();
    
    // Download file
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString()}.xlsx`;
    a.click();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <MenuItem value="audit-summary">Audit Summary</MenuItem>
                <MenuItem value="user-productivity">User Productivity</MenuItem>
                <MenuItem value="location-variance">Location Variance</MenuItem>
                <MenuItem value="recount-analysis">Recount Analysis</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <MenuItem value="all">All Locations</MenuItem>
                <MenuItem value="A">Location A</MenuItem>
                <MenuItem value="B">Location B</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleGenerateReport}
              sx={{ height: '56px' }}
            >
              Generate Report
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
```