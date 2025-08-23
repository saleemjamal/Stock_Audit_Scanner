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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
} from '@mui/material';
import {
  LocalShipping,
  FileDownload,
  QrCode,
  CheckCircle,
  Warning,
  Receipt,
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

interface DCItem {
  dc_number: string;
  item_code: string;
  item_name: string;
  brand: string;
  quantity: number;
  selected_barcode: string;
  total_barcodes: number;
}

interface DCSummary {
  total_dcs: number;
  total_items: number;
  total_quantity: number;
  total_barcodes_to_add: number;
  items_with_barcode: number;
  items_without_barcode: number;
}

export function DCItemsReport() {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [dcItems, setDcItems] = useState<DCItem[]>([]);
  const [summary, setSummary] = useState<DCSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadDCItems();
    }
  }, [selectedSessionId]);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      
      // Get user profile for location filtering
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, location_ids')
        .eq('id', user?.id)
        .single();
      
      if (profileError) throw profileError;

      // Load sessions
      let query = supabase
        .from('audit_sessions')
        .select(`
          id,
          shortname,
          location_id,
          status,
          started_at,
          completed_at,
          total_rack_count,
          locations(name)
        `)
        .order('created_at', { ascending: false });

      // Filter by location for non-superusers
      if (profile.role !== 'superuser' && profile.location_ids?.length > 0) {
        query = query.in('location_id', profile.location_ids);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get scan counts for each session
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session) => {
          const { count } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true })
            .eq('audit_session_id', session.id);

          return {
            session_id: session.id,
            shortname: session.shortname || 'N/A',
            location_name: (session as any).locations?.name || 'Unknown',
            status: session.status as 'active' | 'completed',
            started_at: session.started_at,
            completed_at: session.completed_at,
            total_racks: session.total_rack_count,
            total_scans: count || 0,
          };
        })
      );

      setSessions(sessionsWithCounts);
    } catch (err: any) {
      console.error('Error loading sessions:', err);
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadDCItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load DC items report
      const { data: items, error: itemsError } = await supabase
        .rpc('get_dc_items_report', { p_session_id: selectedSessionId });

      if (itemsError) throw itemsError;

      // Load DC summary
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_dc_barcode_summary', { p_session_id: selectedSessionId });

      if (summaryError) throw summaryError;

      setDcItems(items || []);
      setSummary(summaryData?.[0] || null);
    } catch (err: any) {
      console.error('Error loading DC items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportDCBarcodes = async () => {
    try {
      setExporting(true);
      
      // Get DC items as individual barcodes
      const { data, error } = await supabase
        .rpc('get_dc_items_as_barcodes', { p_session_id: selectedSessionId });

      if (error) throw error;

      // Convert to CSV (single column)
      const csv = data.map((row: any) => row.barcode).join('\n');
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Get session name for filename
      const session = sessions.find(s => s.session_id === selectedSessionId);
      const filename = `dc_items_${session?.shortname || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
      
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting DC barcodes:', err);
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loadingSessions) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {/* Session Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping />
            DC Items Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Generate barcode list from Delivery Challans for inclusion in stock audit report
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Select Audit Session</InputLabel>
            <Select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              label="Select Audit Session"
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
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {selectedSessionId && !loading && summary && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Receipt color="primary" />
                    <Box>
                      <Typography variant="h4">{summary.total_dcs}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Delivery Challans
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <QrCode color="info" />
                    <Box>
                      <Typography variant="h4">{summary.total_barcodes_to_add}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Barcodes to Add
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" />
                    <Box>
                      <Typography variant="h4">{summary.items_with_barcode}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Items with Barcode
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Warning color="warning" />
                    <Box>
                      <Typography variant="h4">{summary.items_without_barcode}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Missing Barcode
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* DC Items Table */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">DC Items Detail</Typography>
                <Button
                  variant="contained"
                  startIcon={<FileDownload />}
                  onClick={exportDCBarcodes}
                  disabled={exporting || summary.total_barcodes_to_add === 0}
                >
                  Export Barcodes CSV
                </Button>
              </Box>

              {dcItems.length === 0 ? (
                <Alert severity="info">
                  No delivery challans found for this session
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>DC Number</TableCell>
                        <TableCell>Item Code</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Brand</TableCell>
                        <TableCell align="center">Quantity</TableCell>
                        <TableCell>Selected Barcode</TableCell>
                        <TableCell align="center">Barcode Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dcItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip label={item.dc_number} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {item.item_code}
                            </Typography>
                          </TableCell>
                          <TableCell>{item.item_name || '-'}</TableCell>
                          <TableCell>{item.brand || '-'}</TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell>
                            {item.selected_barcode ? (
                              <Chip
                                icon={<QrCode />}
                                label={item.selected_barcode}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="No barcode"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {item.selected_barcode ? item.quantity : 0}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={6} align="right">
                          <strong>Total Barcodes to Export:</strong>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={summary.total_barcodes_to_add}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {summary.items_without_barcode > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {summary.items_without_barcode} item(s) don't have barcodes selected and won't be included in the export
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      )}
    </>
  );
}