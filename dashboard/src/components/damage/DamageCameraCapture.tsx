'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
    Box,
    Button,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Alert,
    CircularProgress,
    Paper
} from '@mui/material'
import { CameraAlt, Refresh } from '@mui/icons-material'
import { DamageCameraService, CapturedPhoto } from '@/services/DamageCameraService'

interface DamageCameraCaptureProps {
    onPhotosCapture: (photos: CapturedPhoto[]) => void;
    onCancel: () => void;
}

const PHOTO_INSTRUCTIONS = [
    {
        title: "Overall View",
        description: "Position the damaged item in the center of the frame. Take a wide shot showing the entire item."
    },
    {
        title: "Damage Close-up", 
        description: "Move closer and focus on the damaged area. Ensure the damage is clearly visible."
    },
    {
        title: "Side Angle",
        description: "Take a side view to show the depth and extent of the damage."
    }
];

export default function DamageCameraCapture({ onPhotosCapture, onCancel }: DamageCameraCaptureProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
    const [cameraReady, setCameraReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraService = useRef(new DamageCameraService());

    useEffect(() => {
        initializeCamera();
        return () => cameraService.current.stopCamera();
    }, []);

    const initializeCamera = async () => {
        try {
            const stream = await cameraService.current.initializeCamera();
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setCameraReady(true);
                setError(null);
            }
        } catch (error) {
            setError((error as Error).message);
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !cameraReady) return;

        setProcessing(true);
        try {
            // Capture raw photo
            const rawDataUrl = cameraService.current.capturePhoto(videoRef.current);
            
            // Compress to target size (250KB)
            const compressedDataUrl = await cameraService.current.compressImage(rawDataUrl, 250);
            
            const photo: CapturedPhoto = {
                dataUrl: compressedDataUrl,
                order: currentStep + 1,
                sizeKB: Math.round(cameraService.current.getImageSizeKB(compressedDataUrl)),
                timestamp: new Date().toISOString()
            };

            const newPhotos = [...photos, photo];
            setPhotos(newPhotos);

            // Move to next step or complete
            if (currentStep < 2) {
                setCurrentStep(currentStep + 1);
            } else {
                // All photos captured
                cameraService.current.stopCamera();
                onPhotosCapture(newPhotos);
            }
        } catch (error) {
            setError('Failed to capture photo. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const retakePhoto = () => {
        // Remove last photo and go back one step
        const newPhotos = photos.slice(0, -1);
        setPhotos(newPhotos);
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (error) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
                <Button onClick={onCancel} variant="outlined" sx={{ mr: 1 }}>
                    Cancel
                </Button>
                <Button onClick={initializeCamera} variant="contained">
                    Retry Camera Access
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Progress Stepper */}
            <Stepper activeStep={currentStep} sx={{ mb: 3 }}>
                {PHOTO_INSTRUCTIONS.map((instruction, index) => (
                    <Step key={index} completed={index < photos.length}>
                        <StepLabel>{instruction.title}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {/* Current Instruction */}
            {currentStep < 3 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Photo {currentStep + 1} of 3: {PHOTO_INSTRUCTIONS[currentStep].title}
                    </Typography>
                    <Typography variant="body2">
                        {PHOTO_INSTRUCTIONS[currentStep].description}
                    </Typography>
                </Alert>
            )}

            {/* Camera Feed */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Paper sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.200' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: '100%',
                            maxWidth: 640,
                            height: 'auto',
                            display: cameraReady ? 'block' : 'none'
                        }}
                    />
                    {!cameraReady && (
                        <Box sx={{ 
                            width: 640, 
                            height: 480, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center'
                        }}>
                            <CircularProgress />
                        </Box>
                    )}
                </Paper>
            </Box>

            {/* Photo Preview Row */}
            {photos.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mb: 3, justifyContent: 'center' }}>
                    {photos.map((photo, index) => (
                        <Box key={index} sx={{ textAlign: 'center' }}>
                            <img
                                src={photo.dataUrl}
                                alt={`Damage photo ${index + 1}`}
                                style={{
                                    width: 100,
                                    height: 75,
                                    objectFit: 'cover',
                                    borderRadius: 4,
                                    border: '2px solid green'
                                }}
                            />
                            <Typography variant="caption" display="block">
                                {photo.sizeKB}KB
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button onClick={onCancel} variant="outlined">
                    Cancel
                </Button>
                
                {photos.length > 0 && (
                    <Button onClick={retakePhoto} variant="outlined" startIcon={<Refresh />}>
                        Retake Last
                    </Button>
                )}

                <Button
                    onClick={capturePhoto}
                    variant="contained"
                    disabled={!cameraReady || processing}
                    startIcon={processing ? <CircularProgress size={20} /> : <CameraAlt />}
                >
                    {processing ? 'Processing...' : 
                     currentStep < 2 ? `Capture Photo ${currentStep + 1}` : 'Capture Final Photo'}
                </Button>
            </Box>
        </Box>
    );
}