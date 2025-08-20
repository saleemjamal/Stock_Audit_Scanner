'use client'

import React, { useState, useEffect } from 'react'
import {
    Container,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Box,
    Stepper,
    Step,
    StepLabel,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress
} from '@mui/material'
import { CameraAlt, Send, CheckCircle } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DamageCameraCapture from './DamageCameraCapture'
import MobileCameraInput from './MobileCameraInput'
import BarcodeScanner from './BarcodeScanner'
import { CapturedPhoto } from '@/services/DamageCameraService'

interface DamageReport {
    barcode: string;
    description: string;
    severity: 'minor' | 'medium' | 'severe' | 'total_loss';
    photos: CapturedPhoto[];
}

interface AuditSession {
    id: string;
    shortname: string;
    location_id: number;
    locations: { name: string };
}

const SEVERITY_OPTIONS = [
    { value: 'minor', label: 'Minor - Cosmetic damage only' },
    { value: 'medium', label: 'Medium - Functional impact' },
    { value: 'severe', label: 'Severe - Unusable/safety hazard' },
    { value: 'total_loss', label: 'Total Loss - Complete destruction' }
];

export default function DamageReportingPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [damageReport, setDamageReport] = useState<Partial<DamageReport>>({});
    const [activeSession, setActiveSession] = useState<AuditSession | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isMobile, setIsMobile] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadUserAndSession();
        
        // Detect mobile device
        const checkMobile = () => {
            const isTouchDevice = 'ontouchstart' in window;
            const isSmallScreen = window.innerWidth <= 768;
            const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            setIsMobile((isTouchDevice && isSmallScreen) || mobileUA);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const loadUserAndSession = async () => {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Please log in to report damage');
                return;
            }

            // Get user profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('email', user.email)
                .single();

            setCurrentUser(profile);

            // Load current active audit session
            const { data, error } = await supabase
                .from('audit_sessions')
                .select('id, shortname, location_id, locations(name)')
                .eq('status', 'active')
                .single();
                
            if (error) {
                setError('No active audit session found. Please start an audit session first.');
                return;
            }

            setActiveSession(data as unknown as AuditSession);
        } catch (error) {
            console.error('Error loading session:', error);
            setError('Failed to load audit session');
        }
    };

    const handleBarcodeScanned = (barcode: string) => {
        setDamageReport(prev => ({ ...prev, barcode }));
        setCurrentStep(1);
        setError(null);
    };

    const handlePhotosCapture = (photos: CapturedPhoto[]) => {
        setDamageReport(prev => ({ ...prev, photos }));
        setCurrentStep(2);
    };

    const handleSubmitReport = async () => {
        if (!damageReport.barcode || !damageReport.photos || !activeSession || !currentUser) {
            setError('Missing required information');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Create damage report record
            const { data: damageItem, error: reportError } = await supabase
                .from('damaged_items')
                .insert({
                    audit_session_id: activeSession.id,
                    barcode: damageReport.barcode,
                    damage_description: damageReport.description || null,
                    damage_severity: damageReport.severity || 'medium',
                    reported_by: currentUser.id
                })
                .select()
                .single();

            if (reportError) throw reportError;

            // 2. Upload photos to Supabase Storage
            const uploadPromises = damageReport.photos.map(async (photo, index) => {
                const fileName = `damage-${damageItem.id}-${index + 1}-${Date.now()}.jpg`;
                const blob = dataURLtoBlob(photo.dataUrl);

                const { error: uploadError } = await supabase.storage
                    .from('damage-photos')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('damage-photos')
                    .getPublicUrl(fileName);

                // Save image record
                return supabase
                    .from('damage_images')
                    .insert({
                        damaged_item_id: damageItem.id,
                        image_url: publicUrl,
                        image_filename: fileName,
                        image_order: index + 1,
                        file_size_bytes: photo.sizeKB * 1024,
                        mime_type: 'image/jpeg'
                    });
            });

            await Promise.all(uploadPromises);

            // Success - reset form
            setDamageReport({});
            setCurrentStep(0);
            setError(null);
            setSuccess(true);
            
            // Reset success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);

        } catch (error) {
            console.error('Error submitting damage report:', error);
            setError('Failed to submit damage report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const dataURLtoBlob = (dataURL: string): Blob => {
        const arr = dataURL.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const resetForm = () => {
        setDamageReport({});
        setCurrentStep(0);
        setError(null);
        setSuccess(false);
    };

    if (!activeSession) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="warning">
                    {error || 'Loading active session...'}
                </Alert>
            </Container>
        );
    }

    if (success) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Damage Report Submitted Successfully!
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Your damage report has been sent to super users for approval.
                        </Typography>
                        <Button variant="contained" onClick={resetForm}>
                            Report Another Item
                        </Button>
                    </CardContent>
                </Card>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>
                Report Damaged Item
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
                Reporting damage for: <strong>{activeSession.shortname}</strong> at{' '}
                <strong>{activeSession.locations.name}</strong>
            </Alert>

            <Card>
                <CardContent>
                    <Stepper activeStep={currentStep} sx={{ mb: 4 }}>
                        <Step>
                            <StepLabel>Scan Item Barcode</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Take Photos</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Add Details & Submit</StepLabel>
                        </Step>
                    </Stepper>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Step 1: Barcode Scanning */}
                    {currentStep === 0 && (
                        <BarcodeScanner 
                            onBarcodeScanned={handleBarcodeScanned}
                            placeholder="Scan or enter damaged item barcode..."
                        />
                    )}

                    {/* Step 2: Photo Capture */}
                    {currentStep === 1 && (
                        isMobile ? (
                            <MobileCameraInput
                                onPhotosCapture={handlePhotosCapture}
                                onCancel={() => setCurrentStep(0)}
                            />
                        ) : (
                            <DamageCameraCapture
                                onPhotosCapture={handlePhotosCapture}
                                onCancel={() => setCurrentStep(0)}
                            />
                        )
                    )}

                    {/* Step 3: Details & Submit */}
                    {currentStep === 2 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Damage Report Details
                            </Typography>
                            
                            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Barcode:</strong> {damageReport.barcode}
                                </Typography>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Photos:</strong> {damageReport.photos?.length} captured
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Total Size:</strong> {damageReport.photos?.reduce((sum, p) => sum + p.sizeKB, 0)}KB
                                </Typography>
                            </Box>

                            <FormControl fullWidth sx={{ mb: 3 }}>
                                <InputLabel>Damage Severity</InputLabel>
                                <Select
                                    value={damageReport.severity || 'medium'}
                                    onChange={(e) => setDamageReport(prev => ({ 
                                        ...prev, 
                                        severity: e.target.value as any 
                                    }))}
                                    label="Damage Severity"
                                >
                                    {SEVERITY_OPTIONS.map(option => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Damage Description (Optional)"
                                placeholder="Describe the damage in detail..."
                                value={damageReport.description || ''}
                                onChange={(e) => setDamageReport(prev => ({ 
                                    ...prev, 
                                    description: e.target.value 
                                }))}
                                sx={{ mb: 3 }}
                            />

                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                <Button onClick={() => setCurrentStep(1)} variant="outlined">
                                    Back to Photos
                                </Button>
                                <Button
                                    onClick={handleSubmitReport}
                                    variant="contained"
                                    startIcon={submitting ? <CircularProgress size={20} /> : <Send />}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Damage Report'}
                                </Button>
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Container>
    );
}