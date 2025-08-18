// Camera service for damage photo capture
// Handles camera initialization, photo capture, and image compression

export interface CapturedPhoto {
    dataUrl: string;
    order: number;
    sizeKB: number;
    timestamp: string;
}

export class DamageCameraService {
    private stream: MediaStream | null = null;
    private canvas: HTMLCanvasElement | null = null;

    constructor() {
        this.stream = null;
        this.canvas = null;
    }

    // Initialize camera with optimal settings for damage documentation
    async initializeCamera(): Promise<MediaStream> {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not supported in this browser');
            }

            // Check if HTTPS is enabled (required for camera access)
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                throw new Error('Camera access requires HTTPS connection');
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    facingMode: 'environment', // Prefer back camera if available
                    aspectRatio: 16/9
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            return this.stream;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            
            // Provide specific error messages for common issues
            if ((error as any).name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera permissions and refresh.');
            } else if ((error as any).name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a camera and refresh.');
            } else if ((error as any).name === 'NotSupportedError') {
                throw new Error('Camera not supported by this browser. Use Chrome, Edge, or Firefox.');
            } else if ((error as Error).message.includes('HTTPS')) {
                throw new Error('Camera requires secure connection (HTTPS). Please use HTTPS URL.');
            } else {
                throw new Error(`Camera unavailable: ${(error as Error).message}`);
            }
        }
    }

    // Capture photo from video stream
    capturePhoto(videoElement: HTMLVideoElement): string {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
        }

        const video = videoElement;
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Cannot get canvas context');
        }

        ctx.drawImage(video, 0, 0);
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // Compress image to target size
    async compressImage(dataUrl: string, targetSizeKB: number = 250): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }

                // Calculate optimal dimensions (max 1200x800)
                const maxWidth = 1200;
                const maxHeight = 800;
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Start with quality 0.8, reduce if needed
                let quality = 0.8;
                let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // Reduce quality until under target size
                while (this.getImageSizeKB(compressedDataUrl) > targetSizeKB && quality > 0.3) {
                    quality -= 0.1;
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(compressedDataUrl);
            };
            img.src = dataUrl;
        });
    }

    // Calculate image size in KB
    getImageSizeKB(dataUrl: string): number {
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        return (base64Length * 0.75) / 1024; // Base64 to bytes to KB
    }

    // Cleanup camera resources
    stopCamera(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // Convert data URL to Blob for upload
    dataURLtoBlob(dataURL: string): Blob {
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
    }
}