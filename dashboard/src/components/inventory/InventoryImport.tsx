'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Alert,
  LinearProgress,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { CloudUpload, Info, CheckCircle, Error } from '@mui/icons-material';

interface InventoryImportProps {
  locationId: string;
  userRole: string;
  onImportComplete?: () => void;
}

export function InventoryImport({ locationId, userRole, onImportComplete }: InventoryImportProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Early return if not superuser
  if (userRole !== 'superuser') return null;
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size and warn for large files
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      console.log(`Large file detected: ${fileSizeMB.toFixed(1)}MB`);
    }

    setUploading(true);
    setUploadProgress(null);
    setError(null);
    setSuccess(null);
    setValidationErrors([]);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('locationId', locationId);
    
    try {
      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        const message = result.message || `Successfully imported ${result.imported} items`;
        const details = result.duplicatesFound > 0 ? ` (Processed ${result.totalBatches} batches, resolved ${result.duplicatesFound} duplicates)` : ` (Processed ${result.totalBatches} batches)`;
        setSuccess(message + details);
        onImportComplete?.();
        // Auto close after 5 seconds for large uploads
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
        }, 5000);
      } else {
        setError(result.error || 'Import failed');
        // Handle both old and new error format
        if (result.summary) {
          setError(`${result.error}\n${result.summary}`);
        }
        if (result.details && Array.isArray(result.details)) {
          setValidationErrors(result.details);
        }
        // Log stats for debugging
        if (result.stats) {
          console.log('Validation stats:', result.stats);
        }
      }
    } catch (err) {
      setError('Network error during upload');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setOpen(false);
      setError(null);
      setSuccess(null);
      setValidationErrors([]);
      setUploadProgress(null);
    }
  };
  
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => setOpen(true)}
        size="small"
      >
        Import Inventory
      </Button>
      
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload />
            Import Expected Inventory
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Instructions */}
          <Alert severity="info" sx={{ mb: 2 }} icon={<Info />}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              CSV Format Requirements:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Chip label="item_code" size="small" variant="outlined" />
              <Chip label="barcode" size="small" variant="outlined" color="primary" />
              <Chip label="brand" size="small" variant="outlined" />
              <Chip label="item_name" size="small" variant="outlined" />
              <Chip label="expected_quantity" size="small" variant="outlined" />
              <Chip label="unit_cost" size="small" variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              • item_code must be exactly 5 characters<br/>
              • barcode is required (any length)<br/>
              • Maximum file size: 10MB<br/>
              • Supports CSV and Excel files (.csv, .xlsx, .xls)<br/>
              • Excel format preserves barcode precision<br/>
              • Large files (&gt;5MB/10K+ items) may take longer to process<br/>
              • Duplicate barcodes for same location will be updated
            </Typography>
          </Alert>

          {/* Sample CSV format */}
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Sample CSV:
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.8rem',
                backgroundColor: 'rgba(0,0,0,0.04)',
                padding: 1,
                borderRadius: 1
              }}
            >
              item_code,barcode,brand,item_name,expected_quantity,unit_cost<br/>
              12345,123456789012,Nike,Air Max 90,25,8999.00<br/>
              12345,123456789013,Nike,Air Max 90 Box,5,89990.00<br/>
              23456,234567890123,Adidas,Stan Smith,20,6999.00
            </Typography>
          </Alert>
          
          {/* Error Messages */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} icon={<Error />}>
              {error}
              {validationErrors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Validation Errors:
                  </Typography>
                  <List dense>
                    {validationErrors.slice(0, 10).map((err, index) => (
                      <ListItem key={index} sx={{ py: 0.25 }}>
                        <ListItemText 
                          primary={err} 
                          primaryTypographyProps={{ 
                            variant: 'caption',
                            color: 'error.main'
                          }}
                        />
                      </ListItem>
                    ))}
                    {validationErrors.length > 10 && (
                      <ListItem sx={{ py: 0.25 }}>
                        <ListItemText 
                          primary={`... and ${validationErrors.length - 10} more errors`}
                          primaryTypographyProps={{ 
                            variant: 'caption',
                            color: 'error.main',
                            fontStyle: 'italic'
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
              {success}
            </Alert>
          )}
          
          {/* File Upload */}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          
          <label htmlFor="csv-upload">
            <Button
              variant="contained"
              component="span"
              disabled={uploading}
              fullWidth
              startIcon={<CloudUpload />}
              sx={{ py: 2 }}
            >
              {uploading ? 'Uploading...' : 'Select CSV or Excel File'}
            </Button>
          </label>
          
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Processing CSV file...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Large files may take 30-60 seconds. Please wait...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={uploading}>
            {success ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}