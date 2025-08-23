'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  Refresh,
  Visibility,
  TrendingUp,
  TrendingDown,
  Assessment,
  ErrorOutline,
  CheckCircle,
  Inventory2,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';
import { BrandDetailDialog } from './BrandDetailDialog';
import { useRouter } from 'next/navigation';

interface BrandVariance {
  brand: string;
  expected_value: number;
  actual_value: number;
  variance_value: number;
  variance_percent: number;
  item_count: number;
  scanned_count: number;
}

interface VarianceSummary {
  total_expected_quantity: number;
  total_scanned_quantity: number;
  total_expected_value: number;
  total_actual_value: number;
  total_variance_value: number;
  total_variance_percent: number;
  total_inventory_items: number;
  unique_scanned_items: number;
}

interface SessionOption {
  session_id: string;
  shortname: string;
  location_name: string;
  location_id: string;
  status: string;
  total_racks: number;
  total_scans: number;
}

interface BrandVarianceReportProps {
  userRole: string;
}

export function BrandVarianceReport({ userRole }: BrandVarianceReportProps) {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [data, setData] = useState<BrandVariance[]>([]);
  const [summary, setSummary] = useState<VarianceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInventory, setHasInventory] = useState<boolean>(false);
  const [inventoryCount, setInventoryCount] = useState<number>(0);
  
  // Dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  const supabase = createClient();
  const router = useRouter();

  // Add useEffect hooks here, before any conditional returns
  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      checkInventoryForSession();
    }
  }, [selectedSessionId]);

  // Early return AFTER all hooks
  if (userRole !== 'supervisor' && userRole !== 'superuser') {
    return (
      <Alert severity="warning">
        Brand Variance Reports are only available to Supervisors and Super Users.
      </Alert>
    );
  }

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      // Get sessions directly with location info
      const { data, error } = await supabase
        .from('audit_sessions')
        .select(`
          id,
          shortname,
          status,
          total_rack_count,
          location_id,
          locations!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform data to match our interface
      const transformedData = await Promise.all(
        (data || []).map(async (session: any) => {
          // Get total scans for this session
          const { count: totalScans } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true })
            .eq('audit_session_id', session.id);

          return {
            session_id: session.id,
            shortname: session.shortname || 'Audit',
            location_name: session.locations.name,
            location_id: session.location_id,
            status: session.status,
            total_racks: session.total_rack_count,
            total_scans: totalScans || 0
          };
        })
      );

      setSessions(transformedData);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const checkInventoryForSession = async () => {
    if (!selectedSessionId) return;

    try {
      // Get session location
      const { data: session, error: sessionError } = await supabase
        .from('audit_sessions')
        .select('location_id')
        .eq('id', selectedSessionId)
        .single();

      if (sessionError || !session) {
        setHasInventory(false);
        setInventoryCount(0);
        return;
      }

      // Check inventory count for this location
      const response = await fetch(`/api/inventory/import?locationId=${session.location_id}`);
      const result = await response.json();
      
      if (result.success) {
        const count = result.count || 0;
        setInventoryCount(count);
        setHasInventory(count > 0);
      } else {
        setHasInventory(false);
        setInventoryCount(0);
      }
    } catch (error) {
      console.error('Error checking inventory:', error);
      setHasInventory(false);
      setInventoryCount(0);
    }
  };

  const fetchVariance = async () => {
    if (!selectedSessionId || !hasInventory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch brand variance data (top 20 brands)
      const { data: varianceData, error: varianceError } = await supabase
        .rpc('get_live_brand_variance', { session_id: selectedSessionId });
      
      if (varianceError) throw varianceError;
      
      // Fetch overall summary data (all inventory)
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_brand_variance_summary', { session_id: selectedSessionId });
      
      if (summaryError) throw summaryError;
      
      setData(varianceData || []);
      setSummary(summaryData && summaryData.length > 0 ? summaryData[0] : null);
    } catch (error) {
      console.error('Failed to fetch variance:', error);
      setError('Failed to load variance data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (brand: string) => {
    setSelectedBrand(brand);
    setDetailDialogOpen(true);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'success.main';
    if (variance < -1000) return 'error.main';
    return 'warning.main';
  };

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" />
              <Typography variant="h6">Brand Variance Analysis</Typography>
            </Box>
            {selectedSession && !hasInventory && (
              <Button
                variant="outlined"
                startIcon={<Inventory2 />}
                onClick={() => router.push('/dashboard/inventory')}
                size="small"
              >
                Import Inventory Data
              </Button>
            )}
          </Box>

          {/* Session Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Audit Session</InputLabel>
            <Select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              label="Select Audit Session"
              disabled={loadingSessions}
            >
              {sessions.map((session) => (
                <MenuItem key={session.session_id} value={session.session_id}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {session.shortname} - {session.location_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {session.status === 'active' ? '🔴 Active' : '✅ Completed'} • 
                      {session.total_racks} racks • {session.total_scans} scans
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Inventory Status */}
          {selectedSessionId && (
            <Box sx={{ mb: 3 }}>
              {hasInventory ? (
                <Alert 
                  severity="success" 
                  icon={<CheckCircle />}
                  action={
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={fetchVariance}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={16} /> : <Assessment />}
                    >
                      {loading ? 'Calculating...' : 'Calculate Variance'}
                    </Button>
                  }
                >
                  <Typography variant="body2">
                    <strong>Ready for variance analysis!</strong><br/>
                    {inventoryCount.toLocaleString()} inventory items loaded for this location.
                  </Typography>
                </Alert>
              ) : (
                <Alert 
                  severity="warning" 
                  icon={<ErrorOutline />}
                  action={
                    userRole === 'superuser' ? (
                      <Typography variant="caption" color="text.secondary">
                        Use "Import Inventory" button above
                      </Typography>
                    ) : undefined
                  }
                >
                  <Typography variant="body2">
                    <strong>No inventory data found</strong><br/>
                    Go to the Inventory page to import expected inventory data and enable variance analysis.
                    {userRole !== 'superuser' && ' Contact your Super User to import inventory data.'}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Loading State */}
          {loading && (
            <Box sx={{ py: 3 }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Calculating brand variance...
              </Typography>
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* FIXED: Variance Summary using database totals */}
          {!loading && !error && summary && (
            <Alert 
              severity={summary.total_variance_value >= 0 ? 'success' : 'error'} 
              sx={{ mb: 3 }}
              icon={<Assessment />}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Overall Variance Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Quantities:</Typography>
                  <Typography variant="body2">
                    <strong>{summary.total_scanned_quantity.toLocaleString()}</strong> scanned of <strong>{summary.total_expected_quantity.toLocaleString()}</strong> expected
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Values:</Typography>
                  <Typography variant="body2">
                    {formatCurrency(summary.total_actual_value)} vs {formatCurrency(summary.total_expected_value)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Variance:</Typography>
                  <Typography variant="body2" sx={{ 
                    color: summary.total_variance_value >= 0 ? 'success.main' : 'error.main',
                    fontWeight: 'bold'
                  }}>
                    {formatCurrency(summary.total_variance_value)} ({summary.total_variance_percent > 0 ? '+' : ''}{summary.total_variance_percent}%)
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Coverage:</Typography>
                  <Typography variant="body2">
                    <strong>{summary.unique_scanned_items.toLocaleString()}</strong> of <strong>{summary.total_inventory_items.toLocaleString()}</strong> items scanned
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}

          {/* Results Table */}
          {!loading && !error && data.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Showing top {data.length} brands by variance value:
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Brand</TableCell>
                    <TableCell align="right">Expected Value</TableCell>
                    <TableCell align="right">Actual Value</TableCell>
                    <TableCell align="right">Variance Value</TableCell>
                    <TableCell align="right">Variance %</TableCell>
                    <TableCell align="center">Items Progress</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.brand} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {item.brand}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.item_count} total items
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(item.expected_value)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(item.actual_value)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          sx={{ color: getVarianceColor(item.variance_value) }}
                        >
                          {formatCurrency(item.variance_value)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${item.variance_percent > 0 ? '+' : ''}${item.variance_percent}%`}
                          color={item.variance_percent > 0 ? 'success' : item.variance_percent < -10 ? 'error' : 'warning'}
                          icon={item.variance_percent > 0 ? <TrendingUp /> : <TrendingDown />}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption">
                            {item.scanned_count}/{item.item_count}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(item.scanned_count / item.item_count) * 100}
                            sx={{ width: 60, height: 6 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(item.brand)}
                          color="primary"
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}

          {/* Empty State */}
          {!loading && !error && selectedSessionId && hasInventory && data.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No variance data available. Click "Calculate Variance" to analyze current session data.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Brand Detail Dialog */}
      <BrandDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        sessionId={selectedSessionId}
        brand={selectedBrand}
      />
    </>
  );
}