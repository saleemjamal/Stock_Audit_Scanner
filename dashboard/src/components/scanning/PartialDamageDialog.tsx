'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import { Warning, PhotoCamera, Close } from '@mui/icons-material';
import DamageCameraCapture from '@/components/damage/DamageCameraCapture';
import { CapturedPhoto } from '@/services/DamageCameraService';

interface PartialDamageDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: PartialDamageData) => Promise<void>;
  rackId: string;
  sessionId: string;
  userId: string;
}

export interface PartialDamageData {
  barcode: string;
  damageType: string;
  affectedUnits?: number;
  totalUnits?: number;
  severity: string;
  remarks: string;
  photos: CapturedPhoto[];
}

export default function PartialDamageDialog({
  open,
  onClose,
  onSave,
  rackId,
  sessionId,
  userId
}: PartialDamageDialogProps) {
  const [step, setStep] = useState<'form' | 'camera'>('form');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [barcode, setBarcode] = useState('');
  const [damageType, setDamageType] = useState('');
  const [affectedUnits, setAffectedUnits] = useState<number | ''>('');
  const [totalUnits, setTotalUnits] = useState<number | ''>('');
  const [severity, setSeverity] = useState('moderate');
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const resetForm = () => {
    setBarcode('');
    setDamageType('');
    setAffectedUnits('');
    setTotalUnits('');
    setSeverity('moderate');
    setRemarks('');
    setPhotos([]);
    setStep('form');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFormSubmit = () => {
    // Validate required fields
    if (!barcode.trim()) {
      setError('Barcode is required');
      return;
    }
    if (!damageType) {
      setError('Damage type is required');
      return;
    }
    if (!remarks.trim()) {
      setError('Description is required');
      return;
    }

    // Validate barcode format (10-12 digits)
    if (!/^\d{10,12}$/.test(barcode.trim())) {
      setError('Barcode must be 10-12 digits');
      return;
    }

    setError(null);
    setStep('camera');
  };

  const handlePhotosCapture = (capturedPhotos: CapturedPhoto[]) => {
    setPhotos(capturedPhotos);
    setStep('form');
  };

  const handleSave = async () => {
    if (photos.length === 0) {
      setError('3 photos are required for documentation');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data: PartialDamageData = {
        barcode: barcode.trim(),
        damageType,
        affectedUnits: affectedUnits || undefined,
        totalUnits: totalUnits || undefined,
        severity,
        remarks: remarks.trim(),
        photos
      };

      await onSave(data);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save partial damage record');
    } finally {
      setSaving(false);
    }
  };

  const damageTypeOptions = [
    { value: 'incomplete_set', label: 'Incomplete Set' },
    { value: 'partial_damage', label: 'Partial Damage' },
    { value: 'quality_issue', label: 'Quality Issue' },
    { value: 'packaging_issue', label: 'Packaging Issue' },
    { value: 'other', label: 'Other' }
  ];

  if (step === 'camera') {
    return (
      <Dialog open={open} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Document Partial Damage</Typography>
            <Button onClick={() => setStep('form')} startIcon={<Close />}>
              Back to Form
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DamageCameraCapture
            onPhotosCapture={handlePhotosCapture}
            onCancel={() => setStep('form')}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning color="warning" />
          <Typography variant="h6">Flag Partial Damage</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
          {/* Barcode Input */}
          <TextField
            label="Barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or enter barcode"
            autoFocus
            fullWidth
            required
            helperText="10-12 digit barcode"
          />

          {/* Damage Type */}
          <FormControl required fullWidth>
            <InputLabel>Damage Type</InputLabel>
            <Select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              label="Damage Type"
            >
              {damageTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Units (Optional) */}
          <Box display="flex" gap={2}>
            <TextField
              label="Affected Units"
              type="number"
              value={affectedUnits}
              onChange={(e) => setAffectedUnits(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="e.g., 2"
              inputProps={{ min: 0 }}
              helperText="Optional"
            />
            <TextField
              label="Total Units"
              type="number"
              value={totalUnits}
              onChange={(e) => setTotalUnits(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="e.g., 6"
              inputProps={{ min: 1 }}
              helperText="Optional"
            />
          </Box>

          {/* Severity */}
          <FormControl>
            <FormLabel component="legend">Severity</FormLabel>
            <RadioGroup
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              row
            >
              <FormControlLabel 
                value="minor" 
                control={<Radio />} 
                label="Minor" 
              />
              <FormControlLabel 
                value="moderate" 
                control={<Radio />} 
                label="Moderate" 
              />
              <FormControlLabel 
                value="severe" 
                control={<Radio />} 
                label="Severe" 
              />
            </RadioGroup>
          </FormControl>

          {/* Description */}
          <TextField
            label="Description"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            multiline
            rows={3}
            placeholder="Describe the issue (e.g., 2 glasses broken in 6-piece set, box water damaged, etc.)"
            required
            fullWidth
          />

          {/* Photo Status */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Documentation Photos
            </Typography>
            {photos.length === 0 ? (
              <Alert severity="info">
                3 photos required for documentation
              </Alert>
            ) : (
              <Box display="flex" gap={1}>
                <Chip 
                  label={`${photos.length}/3 photos captured`}
                  color="success"
                  icon={<PhotoCamera />}
                />
                <Button 
                  size="small" 
                  onClick={() => setStep('camera')}
                  variant="outlined"
                >
                  Retake Photos
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        
        {photos.length === 0 ? (
          <Button 
            onClick={handleFormSubmit}
            variant="contained"
            startIcon={<PhotoCamera />}
            disabled={!barcode.trim() || !damageType || !remarks.trim()}
          >
            Take Photos
          </Button>
        ) : (
          <Button 
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : undefined}
          >
            {saving ? 'Saving...' : 'Save Partial Damage'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}