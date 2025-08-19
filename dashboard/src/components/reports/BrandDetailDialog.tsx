'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
} from '@mui/material';
import { Download, Close, TrendingUp, TrendingDown, Assessment } from '@mui/icons-material';
import { createClient } from '@/lib/supabase';

interface BrandDetailItem {
  item_code: string;
  item_name: string;
  expected_quantity: number;
  actual_quantity: number;
  variance_quantity: number;
  unit_cost: number;
  variance_value: number;
  status: string;
}

interface BrandDetailProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  brand: string;
}

export function BrandDetailDialog({ open, onClose, sessionId, brand }: BrandDetailProps) {
  const [items, setItems] = useState<BrandDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  
  useEffect(() => {
    if (open && brand && sessionId) {
      fetchBrandDetail();
    }
  }, [open, brand, sessionId]);
  
  const fetchBrandDetail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .rpc('get_brand_detail_variance', { 
          session_id: sessionId,
          brand_name: brand 
        });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Failed to fetch brand detail:', error);
      setError('Failed to load brand details');
    } finally {
      setLoading(false);
    }
  };
  
  const exportToCSV = () => {
    const headers = [
      'Item Code', 'Item Name', 'Expected Qty', 'Actual Qty', 
      'Variance Qty', 'Unit Cost (₹)', 'Variance Value (₹)', 'Status'
    ];
    
    const csvRows = [
      headers.join(','),
      ...items.map(item => [
        item.item_code,
        `"${item.item_name}"`,
        item.expected_quantity,
        item.actual_quantity,
        item.variance_quantity,
        item.unit_cost,
        item.variance_value.toFixed(2),
        item.status
      ].join(','))
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${brand.replace(/[^a-zA-Z0-9]/g, '_')}_variance_detail_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Match': return 'success';
      case 'Overage': return 'info';
      case 'Shortage': return 'warning';
      case 'Missing': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Match': return '✅';
      case 'Overage': return '📈';
      case 'Shortage': return '📉';
      case 'Missing': return '❌';
      default: return '❓';
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);

  // Calculate totals
  const totalExpected = items.reduce((sum, item) => sum + item.expected_quantity, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actual_quantity, 0);
  const totalVarianceQty = items.reduce((sum, item) => sum + item.variance_quantity, 0);
  const totalVarianceValue = items.reduce((sum, item) => sum + item.variance_value, 0);
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            <Typography variant="h6">
              {brand} - Variance Detail
            </Typography>
            {!loading && items.length > 0 && (
              <Chip
                label={`${items.length} items`}
                color="primary"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          <Box>
            {!loading && items.length > 0 && (
              <Button 
                startIcon={<Download />} 
                onClick={exportToCSV}
                variant="outlined"
                size="small"
                sx={{ mr: 1 }}
              >
                Export CSV
              </Button>
            )}
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && items.length === 0 && (
          <Alert severity="info">
            No variance data found for brand "{brand}". This could mean:
            <ul>
              <li>No inventory data has been imported for this brand</li>
              <li>No items from this brand have been scanned yet</li>
            </ul>
          </Alert>
        )}

        {!loading && items.length > 0 && (
          <>
            {/* Summary Statistics */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Expected</Typography>
                  <Typography variant="h6">{totalExpected.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Actual</Typography>
                  <Typography variant="h6">{totalActual.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Quantity Variance</Typography>
                  <Typography 
                    variant="h6" 
                    color={totalVarianceQty >= 0 ? 'success.main' : 'error.main'}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {totalVarianceQty >= 0 ? <TrendingUp /> : <TrendingDown />}
                    {totalVarianceQty > 0 ? '+' : ''}{totalVarianceQty.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Value Variance</Typography>
                  <Typography 
                    variant="h6" 
                    color={totalVarianceValue >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(totalVarianceValue)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Items Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Expected</TableCell>
                    <TableCell align="right">Actual</TableCell>
                    <TableCell align="right">Variance Qty</TableCell>
                    <TableCell align="right">Unit Cost</TableCell>
                    <TableCell align="right">Variance Value</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow 
                      key={item.item_code} 
                      hover
                      sx={{ 
                        backgroundColor: item.status === 'Missing' ? 'error.lighter' : 
                                        item.status === 'Shortage' ? 'warning.lighter' :
                                        item.status === 'Overage' ? 'info.lighter' : 'transparent'
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight="bold">
                          {item.item_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {item.item_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {item.expected_quantity.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {item.actual_quantity.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={item.variance_quantity < 0 ? 'error.main' : 
                                 item.variance_quantity > 0 ? 'success.main' : 'text.primary'}
                        >
                          {item.variance_quantity > 0 ? '+' : ''}{item.variance_quantity.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(item.unit_cost)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={item.variance_value < 0 ? 'error.main' : 
                                 item.variance_value > 0 ? 'success.main' : 'text.primary'}
                        >
                          {formatCurrency(item.variance_value)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${getStatusIcon(item.status)} ${item.status}`}
                          color={getStatusColor(item.status)}
                          size="small"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}