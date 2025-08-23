'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add,
  Receipt,
  Photo,
  Delete,
  Edit,
  Visibility,
  CheckCircle,
  Warning,
  LocalShipping,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';
import { DeliveryChallanEntry } from '@/components/dc/DeliveryChallanEntry';
import { DeliveryChallanView } from '@/components/dc/DeliveryChallanView';
import DashboardLayout from '@/components/DashboardLayout';

interface DeliveryChallan {
  id: string;
  audit_session_id: string;
  dc_number: string;
  dc_date: string;
  dc_type: 'sample' | 'replacement';
  image_urls: string[];
  total_items: number;
  total_quantity: number;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
    email: string;
  };
  session?: {
    shortname: string;
    location?: {
      name: string;
    };
  };
}

interface AuditSession {
  id: string;
  shortname: string;
  location_id: number;
  status: string;
  location?: {
    name: string;
  };
}

function DeliveryChallansPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dcList, setDcList] = useState<DeliveryChallan[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDC, setSelectedDC] = useState<DeliveryChallan | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadUserAndSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadDCs();
    }
  }, [selectedSession]);

  const loadUserAndSessions = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      setUser(profile);

      // Load active sessions
      let query = supabase
        .from('audit_sessions')
        .select(`
          id,
          shortname,
          location_id,
          status,
          location:locations(name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Filter by location for non-superusers
      if (profile.role !== 'superuser' && profile.location_ids?.length > 0) {
        query = query.in('location_id', profile.location_ids);
      }

      const { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;
      
      // Transform the data to handle the location array from Supabase join
      const transformedSessions = (sessionsData || []).map(session => ({
        ...session,
        location: Array.isArray(session.location) ? session.location[0] : session.location
      }));
      setSessions(transformedSessions);
      
      // Auto-select first session if available
      if (sessionsData && sessionsData.length > 0) {
        setSelectedSession(sessionsData[0].id);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Feature discovery tour trigger
  // Tour code removed

  const loadDCs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_challans')
        .select(`
          *,
          creator:users!delivery_challans_created_by_fkey(full_name, email),
          session:audit_sessions(
            shortname,
            location:locations(name)
          )
        `)
        .eq('audit_session_id', selectedSession)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDcList(data || []);
    } catch (err: any) {
      console.error('Error loading DCs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDC = () => {
    setEntryDialogOpen(true);
  };

  const handleViewDC = (dc: DeliveryChallan) => {
    setSelectedDC(dc);
    setViewDialogOpen(true);
  };

  const handleDeleteDC = async (dcId: string) => {
    if (!confirm('Are you sure you want to delete this Delivery Challan?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('delivery_challans')
        .delete()
        .eq('id', dcId);

      if (error) throw error;
      
      // Reload DCs
      loadDCs();
    } catch (err: any) {
      console.error('Error deleting DC:', err);
      setError(err.message);
    }
  };

  if (loading && !sessions.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping />
          Delivery Challans
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage delivery challans for items temporarily out of stock
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Session Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Audit Session</InputLabel>
                <Select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  label="Select Audit Session"
                >
                  {sessions.map((session) => (
                    <MenuItem key={session.id} value={session.id}>
                      {session.shortname} - {session.location?.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateDC}
                disabled={!selectedSession}
                fullWidth
                sx={{ height: '56px' }}
              >
                Create New DC
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* DC List */}
      {selectedSession && (
        <Grid container spacing={3}>
          {dcList.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Receipt sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Delivery Challans Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first delivery challan to track items temporarily out of stock
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreateDC}
                >
                  Create First DC
                </Button>
              </Paper>
            </Grid>
          ) : (
            dcList.map((dc) => (
              <Grid item xs={12} md={6} lg={4} key={dc.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Typography variant="h6">
                        {dc.dc_number}
                      </Typography>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip 
                          label={dc.dc_type === 'sample' ? 'Sample' : 'Replacement'}
                          size="small"
                          color={dc.dc_type === 'sample' ? 'info' : 'warning'}
                          variant="outlined"
                        />
                        <Chip 
                          label={`${dc.total_items} items`}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        Date: {dc.dc_date ? new Date(dc.dc_date).toLocaleDateString() : 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Quantity: {dc.total_quantity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created by: {dc.creator?.full_name || 'Unknown'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(dc.created_at).toLocaleString()}
                      </Typography>
                    </Box>

                    <Box display="flex" gap={1}>
                      {dc.image_urls && dc.image_urls.length > 0 && (
                        <Chip 
                          icon={<Photo />}
                          label={`${dc.image_urls.length} photos`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDC(dc)}
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                      {user?.role === 'superuser' && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteDC(dc.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Entry Dialog */}
      {entryDialogOpen && (
        <DeliveryChallanEntry
          open={entryDialogOpen}
          onClose={() => setEntryDialogOpen(false)}
          sessionId={selectedSession}
          onSuccess={() => {
            setEntryDialogOpen(false);
            loadDCs();
          }}
        />
      )}

      {/* View Dialog */}
      {viewDialogOpen && selectedDC && (
        <DeliveryChallanView
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          dcId={selectedDC.id}
        />
      )}
    </Container>
  );
}

export default function DeliveryChallansPageWrapper() {
  return (
    <DashboardLayout>
      <DeliveryChallansPage />
    </DashboardLayout>
  );
}