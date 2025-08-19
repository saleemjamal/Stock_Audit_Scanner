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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
} from '@mui/material';
import {
  Assessment,
  FileDownload,
  CheckCircle,
  Warning,
  TrendingUp,
  TrendingDown,
  ErrorOutline,
  Inventory,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';

interface SessionOption {
  session_id: string;
  shortname: string;
  location_name: string;
  status: 'active' | 'completed';
  started_at: string;
  completed_at?: string;
  total_racks: number;
  total_scans: number;
}

interface VarianceMetadata {
  session_shortname: string;
  location_name: string;
  session_status: string;
  total_inventory_items: number;
  total_expected_quantity: number;
  total_actual_quantity: number;
  total_expected_value: number;
  total_actual_value: number;
  total_variance_value: number;
  total_variance_percent: number;
  missing_items: number;
  overage_items: number;
  shortage_items: number;
  match_items: number;
  generated_at: string;
}

interface VarianceItem {
  item_code: string;
  item_name: string;
  brand: string;
  expected_quantity: number;
  actual_quantity: number;
  variance_quantity: number;
  unit_cost: number;
  expected_value: number;
  actual_value: number;
  variance_value: number;
  status: string;
}

interface OverallVarianceReportProps {
  userRole: string;
}

export function OverallVarianceReport({ userRole }: OverallVarianceReportProps) {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [metadata, setMetadata] = useState<VarianceMetadata | null>(null);
  const [varianceItems, setVarianceItems] = useState<VarianceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasInventory, setHasInventory] = useState<boolean>(false);
  const [inventoryCount, setInventoryCount] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  
  // Pagination for preview table
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const supabase = createClient();

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      checkInventoryForSession();
      loadVarianceData();
    }
  }, [selectedSessionId]);

  // Early return AFTER all hooks
  if (userRole !== 'supervisor' && userRole !== 'superuser') {
    return (
      <Alert severity="warning">
        Overall Variance Reports are only available to Supervisors and Super Users.
      </Alert>
    );
  }

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .rpc('get_sessions_for_reports');
      
      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const checkInventoryForSession = async () => {
    if (!selectedSessionId) return;

    try {
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

  const loadVarianceData = async () => {
    if (!selectedSessionId || !hasInventory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get metadata
      const { data: metaData, error: metaError } = await supabase
        .rpc('get_variance_report_metadata', { session_id: selectedSessionId });
      
      if (metaError) throw metaError;
      
      // Get variance items (limit to first 100 for preview)
      const { data: itemsData, error: itemsError } = await supabase
        .rpc('get_overall_variance_report', { session_id: selectedSessionId });
      
      if (itemsError) throw itemsError;
      
      setMetadata(metaData && metaData.length > 0 ? metaData[0] : null);
      setVarianceItems(itemsData || []);
    } catch (error) {
      console.error('Failed to load variance data:', error);
      setError('Failed to load variance data');
    } finally {
      setLoading(false);
    }
  };

  const exportVarianceReport = async () => {
    if (!selectedSessionId) return;
    
    setExporting(true);
    try {
      const response = await fetch(`/api/variance-report?sessionId=${selectedSessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'variance-report.csv';

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting variance report:', error);
      setError(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);

  const formatNumber = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'Match': return 'success';
      case 'Missing': return 'error';
      case 'Shortage': return 'warning';
      case 'Overage': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Match': return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'Missing': return <ErrorOutline sx={{ fontSize: 16 }} />;
      case 'Shortage': return <TrendingDown sx={{ fontSize: 16 }} />;
      case 'Overage': return <TrendingUp sx={{ fontSize: 16 }} />;
      default: return undefined;
    }
  };

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);

  // Paginated items for preview table
  const paginatedItems = varianceItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(varianceItems.length / itemsPerPage);

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory color="primary" />
              <Typography variant="h6">Overall Variance Report</Typography>
            </Box>
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
                      onClick={exportVarianceReport}
                      disabled={exporting || loading}
                      startIcon={exporting ? <CircularProgress size={16} /> : <FileDownload />}
                    >
                      {exporting ? 'Generating...' : 'Download CSV Report'}
                    </Button>
                  }
                >
                  <Typography variant="body2">
                    <strong>Ready for variance analysis!</strong><br/>
                    {inventoryCount.toLocaleString()} inventory items loaded for this location.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="warning" icon={<ErrorOutline />}>
                  <Typography variant="body2">
                    <strong>No inventory data found</strong><br/>
                    Import expected inventory to enable variance analysis.
                    {userRole !== 'superuser' && ' Contact your Super User to import inventory data.'}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Metadata Summary */}
          {!loading && metadata && (
            <>
              {/* Key Metrics Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {metadata.total_inventory_items.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Items
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {formatCurrency(metadata.total_expected_value)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expected Value
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography 
                      variant="h4" 
                      color={metadata.total_variance_value >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(metadata.total_variance_value)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Variance Value
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography 
                      variant="h4" 
                      color={metadata.total_variance_percent >= 0 ? 'success.main' : 'error.main'}
                    >
                      {metadata.total_variance_percent > 0 ? '+' : ''}{metadata.total_variance_percent}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Variance %
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Status Summary */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                <Chip 
                  label={`Match: ${metadata.match_items}`} 
                  color="success" 
                  icon={<CheckCircle />}
                  size="small" 
                />
                <Chip 
                  label={`Missing: ${metadata.missing_items}`} 
                  color="error" 
                  icon={<ErrorOutline />}
                  size="small" 
                />
                <Chip 
                  label={`Shortage: ${metadata.shortage_items}`} 
                  color="warning" 
                  icon={<TrendingDown />}
                  size="small" 
                />
                <Chip 
                  label={`Overage: ${metadata.overage_items}`} 
                  color="info" 
                  icon={<TrendingUp />}
                  size="small" 
                />
              </Box>

              {/* Preview Table */}
              <Typography variant="h6" gutterBottom>
                Preview - Top Variance Items (Showing {paginatedItems.length} of {varianceItems.length} items)
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Name</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell align="right">Expected</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="right">Variance</TableCell>
                      <TableCell align="right">Variance Value</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No variance data available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item, index) => (
                        <TableRow key={item.item_code} hover>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {item.item_code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 200 }}>
                              {item.item_name.length > 30 ? `${item.item_name.substring(0, 30)}...` : item.item_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.brand}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {item.expected_quantity.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {item.actual_quantity.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              color={item.variance_quantity === 0 ? 'text.primary' : item.variance_quantity > 0 ? 'success.main' : 'error.main'}
                            >
                              {item.variance_quantity > 0 ? '+' : ''}{item.variance_quantity.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              fontWeight="bold"
                              color={item.variance_value === 0 ? 'text.primary' : item.variance_value > 0 ? 'success.main' : 'error.main'}
                            >
                              {formatCurrency(item.variance_value)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.status}
                              color={getStatusColor(item.status)}
                              size="small"
                              icon={getStatusIcon(item.status)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {varianceItems.length > itemsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}

              {/* Download Instructions */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Complete Report:</strong> Click "Download CSV Report" above to get the full variance report with all {metadata.total_inventory_items.toLocaleString()} items, 
                  including detailed variance calculations and summary statistics.
                </Typography>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}