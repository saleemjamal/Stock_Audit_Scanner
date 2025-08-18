'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
    TextField, 
    Typography, 
    Box, 
    Alert, 
    Paper,
    Button
} from '@mui/material'
import { QrCodeScanner, Keyboard } from '@mui/icons-material'

interface BarcodeScannerProps {
    onBarcodeScanned: (barcode: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function BarcodeScanner({ 
    onBarcodeScanned, 
    placeholder = "Scan or enter barcode...",
    disabled = false 
}: BarcodeScannerProps) {
    const [barcode, setBarcode] = useState('');
    const [lastScanTime, setLastScanTime] = useState(0);
    const [scannerDetected, setScannerDetected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto-focus the input
        if (inputRef.current && !disabled) {
            inputRef.current.focus();
        }
    }, [disabled]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setBarcode(value);

        // Auto-detect USB scanner input (typically fast typing)
        const now = Date.now();
        if (value.length > 8 && (now - lastScanTime) < 100) {
            setScannerDetected(true);
        }
        setLastScanTime(now);
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        const cleanBarcode = barcode.trim();
        
        if (cleanBarcode.length < 8) {
            alert('Barcode must be at least 8 digits');
            return;
        }

        // Validate barcode format (digits only)
        if (!/^\d+$/.test(cleanBarcode)) {
            alert('Barcode must contain only numbers');
            return;
        }

        onBarcodeScanned(cleanBarcode);
        setBarcode('');
        setScannerDetected(false);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCodeScanner />
                Scan Damaged Item Barcode
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use a USB barcode scanner or type the barcode manually
            </Typography>

            {scannerDetected && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    USB Scanner detected! Press Enter or click Submit to continue.
                </Alert>
            )}

            <Paper sx={{ p: 2, mb: 2 }}>
                <TextField
                    ref={inputRef}
                    fullWidth
                    label="Barcode"
                    placeholder={placeholder}
                    value={barcode}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={disabled}
                    InputProps={{
                        startAdornment: scannerDetected ? <QrCodeScanner color="primary" /> : <Keyboard />
                    }}
                    helperText={`${barcode.length} characters entered${barcode.length > 0 && barcode.length < 8 ? ' (minimum 8 required)' : ''}`}
                />
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                        variant="contained" 
                        onClick={handleSubmit}
                        disabled={disabled || barcode.trim().length < 8}
                    >
                        Submit Barcode
                    </Button>
                </Box>
            </Paper>

            <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                    <strong>Important:</strong> Only scan items that are actually damaged. 
                    All damage reports require super user approval before stock removal.
                </Typography>
            </Alert>
        </Box>
    );
}