'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
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
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import {
  Close,
  Add,
  Delete,
  PhotoCamera,
  Receipt,
  Search,
  CheckCircle,
  QrCode,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';

interface DeliveryChallanEntryProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess: () => void;
}

interface DCItem {
  item_code: string;
  quantity: number;
  item_name?: string;
  brand?: string;
  unit_cost?: number;
  mapped_barcodes?: string[];
  selected_barcode?: string;
}

export function DeliveryChallanEntry({ open, onClose, sessionId, onSuccess }: DeliveryChallanEntryProps) {
  const [dcNumber, setDcNumber] = useState('');
  const [dcDate, setDcDate] = useState(new Date().toISOString().split('T')[0]);
  const [dcType, setDcType] = useState<'sample' | 'replacement'>('sample');
  const [items, setItems] = useState<DCItem[]>([]);
  const [currentItemCode, setCurrentItemCode] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('1');
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (images.length + files.length > 3) {
      setError('Maximum 3 images allowed');
      return;
    }
    setImages([...images, ...files.slice(0, 3 - images.length)]);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const lookupItemCode = async () => {
    if (!currentItemCode || currentItemCode.length !== 5) {
      setLookupError('Item code must be 5 characters');
      return;
    }

    try {
      setLookupError(null);
      
      // Get location_id from session
      const { data: sessionData, error: sessionError } = await supabase
        .from('audit_sessions')
        .select('location_id')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Look up item details from inventory_items
      const { data: itemData, error: itemError } = await supabase
        .from('inventory_items')
        .select('item_code, item_name, brand, unit_cost, barcode')
        .eq('item_code', currentItemCode)
        .eq('location_id', sessionData.location_id);

      if (itemError) throw itemError;

      if (!itemData || itemData.length === 0) {
        setLookupError('Item code not found in inventory');
        return;
      }

      // Aggregate data from multiple barcodes with same item_code
      const firstItem = itemData[0];
      const barcodes = itemData.map(item => item.barcode).filter(Boolean);

      // Default to first barcode if only one exists, otherwise let user select
      const selectedBarcode = barcodes.length === 1 ? barcodes[0] : undefined;

      const newItem: DCItem = {
        item_code: currentItemCode,
        quantity: parseInt(currentQuantity) || 1,
        item_name: firstItem.item_name,
        brand: firstItem.brand,
        unit_cost: firstItem.unit_cost,
        mapped_barcodes: barcodes,
        selected_barcode: selectedBarcode,
      };

      setItems([...items, newItem]);
      setCurrentItemCode('');
      setCurrentQuantity('1');
    } catch (err: any) {
      console.error('Error looking up item:', err);
      setLookupError(err.message);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateSelectedBarcode = (index: number, barcode: string) => {
    const updatedItems = [...items];
    updatedItems[index].selected_barcode = barcode;
    setItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (!dcNumber) {
      setError('DC number is required');
      return;
    }

    if (items.length === 0) {
      setError('At least one item is required');
      return;
    }

    // Validate that all items have selected barcodes
    const itemsWithoutBarcodes = items.filter(item => !item.selected_barcode);
    if (itemsWithoutBarcodes.length > 0) {
      setError(`Please select barcodes for all items. Missing barcodes for: ${itemsWithoutBarcodes.map(item => item.item_code).join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Upload images if any
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileName = `dc/${sessionId}/${dcNumber}/${Date.now()}_${image.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('damage-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('damage-images')
          .getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      }

      // Create DC record
      const { data: dcData, error: dcError } = await supabase
        .from('delivery_challans')
        .insert({
          audit_session_id: sessionId,
          dc_number: dcNumber,
          dc_date: dcDate,
          dc_type: dcType,
          image_urls: imageUrls,
          total_items: items.length,
          total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
          created_by: user?.id,
        })
        .select()
        .single();

      if (dcError) throw dcError;

      // Create DC items
      const dcItems = items.map(item => ({
        dc_id: dcData.id,
        item_code: item.item_code,
        quantity: item.quantity,
        item_name: item.item_name,
        brand: item.brand,
        unit_cost: item.unit_cost,
        mapped_barcodes: item.mapped_barcodes || [],
        selected_barcode: item.selected_barcode,
      }));

      const { error: itemsError } = await supabase
        .from('dc_items')
        .insert(dcItems);

      if (itemsError) throw itemsError;

      onSuccess();
    } catch (err: any) {
      console.error('Error creating DC:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Create Delivery Challan</Typography>
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
          {/* DC Details */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="DC Number"
              value={dcNumber}
              onChange={(e) => setDcNumber(e.target.value)}
              required
              helperText="Enter the delivery challan number"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="date"
              label="DC Date"
              value={dcDate}
              onChange={(e) => setDcDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>DC Type</InputLabel>
              <Select
                value={dcType}
                onChange={(e) => setDcType(e.target.value as 'sample' | 'replacement')}
                label="DC Type"
              >
                <MenuItem value="sample">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">Sample</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Items sent to customers for evaluation
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="replacement">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">Replacement</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Items sent to vendors for replacement/repair
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Image Upload */}
          <Grid item xs={12}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                DC Images (Optional, Max 3)
              </Typography>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 3}
              >
                Upload Images
              </Button>
              <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                {images.map((image, index) => (
                  <Chip
                    key={index}
                    label={image.name}
                    onDelete={() => removeImage(index)}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Item Entry */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Add Items
            </Typography>
            <Box display="flex" gap={2} mb={2}>
              <TextField
                label="Item Code"
                value={currentItemCode}
                onChange={(e) => setCurrentItemCode(e.target.value.toUpperCase())}
                placeholder="5 chars"
                inputProps={{ maxLength: 5 }}
                size="small"
                sx={{ width: 150 }}
              />
              <TextField
                label="Quantity"
                type="number"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                size="small"
                sx={{ width: 100 }}
                inputProps={{ min: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={lookupItemCode}
                disabled={!currentItemCode || currentItemCode.length !== 5}
              >
                Add Item
              </Button>
            </Box>
            {lookupError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {lookupError}
              </Alert>
            )}
          </Grid>

          {/* Items Table */}
          {items.length > 0 && (
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell>Selected Barcode</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.item_name || '-'}</TableCell>
                        <TableCell>{item.brand || '-'}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell>
                          {item.mapped_barcodes && item.mapped_barcodes.length > 1 ? (
                            <FormControl size="small" fullWidth error={!item.selected_barcode}>
                              <Select
                                value={item.selected_barcode || ''}
                                onChange={(e) => updateSelectedBarcode(index, e.target.value)}
                                displayEmpty
                                startAdornment={<QrCode sx={{ mr: 1, fontSize: 16 }} />}
                              >
                                <MenuItem value="" disabled>
                                  Select barcode
                                </MenuItem>
                                {item.mapped_barcodes.map((barcode) => (
                                  <MenuItem key={barcode} value={barcode}>
                                    {barcode}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <Chip
                              icon={<QrCode />}
                              label={item.selected_barcode || 'No barcode'}
                              size="small"
                              variant="outlined"
                              color={item.selected_barcode ? 'success' : 'error'}
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeItem(index)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}>
                        <strong>Total</strong>
                      </TableCell>
                      <TableCell align="center">
                        <strong>
                          {items.reduce((sum, item) => sum + item.quantity, 0)}
                        </strong>
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            loading || 
            !dcNumber || 
            items.length === 0 || 
            items.some(item => !item.selected_barcode)
          }
          startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
        >
          Create DC
        </Button>
      </DialogActions>
    </Dialog>
  );
}