'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  ImageList,
  ImageListItem,
} from '@mui/material';
import {
  Close,
  Receipt,
  LocalShipping,
  Inventory,
  Photo,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';

interface DeliveryChallanViewProps {
  open: boolean;
  onClose: () => void;
  dcId: string;
}

interface DCDetails {
  id: string;
  audit_session_id: string;
  dc_number: string;
  dc_date: string;
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
  items?: DCItem[];
}

interface DCItem {
  id: string;
  item_code: string;
  quantity: number;
  item_name?: string;
  brand?: string;
  unit_cost?: number;
  mapped_barcodes?: string[];
}

export function DeliveryChallanView({ open, onClose, dcId }: DeliveryChallanViewProps) {
  const [loading, setLoading] = useState(true);
  const [dcDetails, setDcDetails] = useState<DCDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    if (dcId) {
      loadDCDetails();
    }
  }, [dcId]);

  const loadDCDetails = async () => {
    try {
      setLoading(true);
      
      // Load DC details
      const { data: dcData, error: dcError } = await supabase
        .from('delivery_challans')
        .select(`
          *,
          creator:users!delivery_challans_created_by_fkey(full_name, email),
          session:audit_sessions(
            shortname,
            location:locations(name)
          )
        `)
        .eq('id', dcId)
        .single();

      if (dcError) throw dcError;

      // Load DC items
      const { data: itemsData, error: itemsError } = await supabase
        .from('dc_items')
        .select('*')
        .eq('dc_id', dcId)
        .order('item_code');

      if (itemsError) throw itemsError;

      setDcDetails({
        ...dcData,
        items: itemsData || [],
      });
    } catch (err: any) {
      console.error('Error loading DC details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalValue = () => {
    if (!dcDetails?.items) return 0;
    return dcDetails.items.reduce((sum, item) => 
      sum + (item.quantity * (item.unit_cost || 0)), 0
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!dcDetails) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <LocalShipping />
            <Typography variant="h6">Delivery Challan Details</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* DC Information */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    DC Number
                  </Typography>
                  <Typography variant="h6">
                    {dcDetails.dc_number}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1">
                    {dcDetails.dc_date ? new Date(dcDetails.dc_date).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Session
                  </Typography>
                  <Typography variant="body1">
                    {dcDetails.session?.shortname} - {dcDetails.session?.location?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {dcDetails.creator?.full_name}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Summary Stats */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                  <Typography variant="h4" color="primary">
                    {dcDetails.total_items}
                  </Typography>
                  <Typography variant="caption">Total Items</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                  <Typography variant="h4" color="info.main">
                    {dcDetails.total_quantity}
                  </Typography>
                  <Typography variant="caption">Total Quantity</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                  <Typography variant="h4" color="success.main">
                    ₹{calculateTotalValue().toFixed(2)}
                  </Typography>
                  <Typography variant="caption">Total Value</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                  <Typography variant="h4" color="warning.main">
                    {dcDetails.items?.reduce((sum, item) => 
                      sum + (item.mapped_barcodes?.length || 0), 0
                    )}
                  </Typography>
                  <Typography variant="caption">Mapped Barcodes</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>

          {/* Items Table */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory />
              Items
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Unit Cost</TableCell>
                    <TableCell align="right">Total Value</TableCell>
                    <TableCell>Barcodes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dcDetails.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.item_code}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.item_name || '-'}</TableCell>
                      <TableCell>{item.brand || '-'}</TableCell>
                      <TableCell align="center">{item.quantity}</TableCell>
                      <TableCell align="right">
                        {item.unit_cost ? `₹${item.unit_cost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {item.unit_cost ? `₹${(item.quantity * item.unit_cost).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {item.mapped_barcodes?.map((barcode, idx) => (
                          <Chip
                            key={idx}
                            label={barcode}
                            size="small"
                            variant="outlined"
                            sx={{ m: 0.25, fontFamily: 'monospace', fontSize: '0.75rem' }}
                          />
                        )) || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3}>
                      <strong>Total</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{dcDetails.total_quantity}</strong>
                    </TableCell>
                    <TableCell />
                    <TableCell align="right">
                      <strong>₹{calculateTotalValue().toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* DC Images */}
          {dcDetails.image_urls && dcDetails.image_urls.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Photo />
                DC Images
              </Typography>
              <ImageList cols={3} gap={8}>
                {dcDetails.image_urls.map((url, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={url}
                      alt={`DC Image ${index + 1}`}
                      loading="lazy"
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.open(url, '_blank')}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}