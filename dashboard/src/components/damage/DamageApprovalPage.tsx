'use client'

import React, { useState, useEffect } from 'react'
import {
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    ImageList,
    ImageListItem,
    Alert,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    IconButton,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material'
import { CheckCircle, Cancel, Visibility, Refresh } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface PendingDamageReport {
    damage_id: string;
    barcode: string;
    damage_description: string;
    damage_severity: string;
    reported_by_name: string;
    reported_at: string;
    session_shortname: string;
    location_name: string;
    image_count: number;
}

interface DamageImage {
    id: string;
    image_url: string;
    image_order: number;
}

export default function DamageApprovalPage() {
    const [pendingReports, setPendingReports] = useState<PendingDamageReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<PendingDamageReport | null>(null);
    const [reportImages, setReportImages] = useState<DamageImage[]>([]);
    const [rejectionDialog, setRejectionDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
    const [allImages, setAllImages] = useState<Record<string, DamageImage[]>>({});

    const supabase = createClient();

    useEffect(() => {
        loadUserAndReports();
    }, []);

    // Load images when reports load
    useEffect(() => {
        if (pendingReports.length > 0) {
            loadAllImages();
        }
    }, [pendingReports]);

    const loadUserAndReports = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('Not authenticated');
                return;
            }

            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('email', user.email)
                .single();

            setCurrentUser(profile);

            if (profile?.role === 'superuser') {
                await loadPendingReports(profile.id);
            }
        } catch (error) {
            console.error('Error loading user:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPendingReports = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .rpc('get_pending_damage_reports', {
                    p_user_id: userId
                });

            if (error) throw error;
            setPendingReports(data || []);
        } catch (error) {
            console.error('Error loading pending reports:', error);
        }
    };

    const loadReportImages = async (damageId: string) => {
        try {
            const { data, error } = await supabase
                .from('damage_images')
                .select('*')
                .eq('damaged_item_id', damageId)
                .order('image_order');

            if (error) throw error;
            setReportImages(data || []);
        } catch (error) {
            console.error('Error loading images:', error);
        }
    };

    const loadAllImages = async () => {
        if (pendingReports.length === 0) return;
        
        try {
            const imagePromises = pendingReports.map(async (report) => {
                const { data } = await supabase
                    .from('damage_images')
                    .select('*')
                    .eq('damaged_item_id', report.damage_id)
                    .order('image_order');
                return { damageId: report.damage_id, images: data || [] };
            });

            const results = await Promise.all(imagePromises);
            const imageMap: Record<string, DamageImage[]> = {};
            results.forEach(r => {
                imageMap[r.damageId] = r.images;
            });
            setAllImages(imageMap);
        } catch (error) {
            console.error('Error loading all images:', error);
        }
    };

    const handleViewReport = async (report: PendingDamageReport) => {
        setSelectedReport(report);
        await loadReportImages(report.damage_id);
    };

    const handleApprove = async () => {
        if (!selectedReport || !currentUser) return;

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('damaged_items')
                .update({
                    status: 'approved',
                    approved_by: currentUser.id,
                    approved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedReport.damage_id);

            if (error) throw error;

            setSelectedReport(null);
            await loadPendingReports(currentUser.id);
            
            alert('Damage report approved successfully');
        } catch (error) {
            console.error('Error approving report:', error);
            alert('Failed to approve report');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedReport || !rejectionReason.trim() || !currentUser) return;

        setProcessing(true);
        try {
            // Update damage report as rejected (for audit trail and scanner action list)
            const { error: updateError } = await supabase
                .from('damaged_items')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason,
                    approved_by: currentUser.id,
                    approved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedReport.damage_id);

            if (updateError) throw updateError;

            setRejectionDialog(false);
            setSelectedReport(null);
            setRejectionReason('');
            await loadPendingReports(currentUser.id);
            
            alert('Damage rejected - Scanner should add this item to final rack as partial damage');
        } catch (error) {
            console.error('Error rejecting damage:', error);
            alert('Failed to reject damage report');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkApprove = async () => {
        if (!currentUser || selectedReports.size === 0) return;

        setProcessing(true);
        try {
            for (const damageId of Array.from(selectedReports)) {
                await supabase.rpc('approve_damage_report', {
                    p_damage_id: damageId,
                    p_approved_by: currentUser.id,
                    p_remove_from_stock: false
                });
            }

            setSelectedReports(new Set());
            await loadPendingReports(currentUser.id);
            alert(`${selectedReports.size} damage reports approved successfully`);
        } catch (error) {
            console.error('Error bulk approving reports:', error);
            alert('Failed to approve reports');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkReject = async () => {
        if (!currentUser || selectedReports.size === 0) return;
        const reason = prompt('Please provide a rejection reason for all selected items:');
        if (!reason?.trim()) return;

        setProcessing(true);
        try {
            for (const damageId of Array.from(selectedReports)) {
                await supabase
                    .from('damaged_items')
                    .update({
                        status: 'rejected',
                        rejection_reason: reason,
                        approved_by: currentUser.id,
                        approved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', damageId);
            }

            setSelectedReports(new Set());
            await loadPendingReports(currentUser.id);
            alert(`${selectedReports.size} damage reports rejected`);
        } catch (error) {
            console.error('Error bulk rejecting reports:', error);
            alert('Failed to reject reports');
        } finally {
            setProcessing(false);
        }
    };

    const handleQuickApprove = async (damageId: string) => {
        if (!currentUser) return;

        setProcessing(true);
        try {
            await supabase.rpc('approve_damage_report', {
                p_damage_id: damageId,
                p_approved_by: currentUser.id,
                p_remove_from_stock: false
            });

            await loadPendingReports(currentUser.id);
            alert('Damage report approved successfully');
        } catch (error) {
            console.error('Error approving report:', error);
            alert('Failed to approve report');
        } finally {
            setProcessing(false);
        }
    };

    const getSeverityColor = (severity: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
        switch (severity) {
            case 'minor': return 'info';
            case 'medium': return 'warning';
            case 'severe': return 'error';
            case 'total_loss': return 'error';
            default: return 'default';
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (!currentUser || currentUser.role !== 'superuser') {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">
                    Access denied. Super user role required for damage approvals.
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Damage Report Approvals
                </Typography>
                <Button
                    startIcon={<Refresh />}
                    onClick={() => loadPendingReports(currentUser.id)}
                    variant="outlined"
                >
                    Refresh
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
                Super user approval required for all damage reports before items can be removed from stock.
            </Alert>

            {pendingReports.length === 0 ? (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">
                            No pending damage reports
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Box>
                    {/* View toggle and bulk actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                onClick={handleBulkApprove}
                                disabled={selectedReports.size === 0 || processing}
                            >
                                Approve Selected ({selectedReports.size})
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={handleBulkReject}
                                disabled={selectedReports.size === 0 || processing}
                            >
                                Reject Selected
                            </Button>
                        </Box>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(e, v) => v && setViewMode(v)}
                        >
                            <ToggleButton value="list">List</ToggleButton>
                            <ToggleButton value="cards">Cards</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {viewMode === 'list' ? (
                        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedReports.size === pendingReports.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedReports(new Set(pendingReports.map(r => r.damage_id)))
                                                    } else {
                                                        setSelectedReports(new Set())
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>Barcode</TableCell>
                                        <TableCell>Severity</TableCell>
                                        <TableCell>Reporter</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Photos</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pendingReports.map((report) => (
                                        <TableRow key={report.damage_id}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedReports.has(report.damage_id)}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedReports)
                                                        if (e.target.checked) {
                                                            newSelected.add(report.damage_id)
                                                        } else {
                                                            newSelected.delete(report.damage_id)
                                                        }
                                                        setSelectedReports(newSelected)
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                    {report.barcode}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={report.damage_severity}
                                                    color={getSeverityColor(report.damage_severity)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{report.reported_by_name}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {report.damage_description || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    {allImages[report.damage_id]?.map((img, idx) => (
                                                        <img
                                                            key={idx}
                                                            src={img.image_url}
                                                            style={{
                                                                width: 40,
                                                                height: 40,
                                                                objectFit: 'cover',
                                                                cursor: 'pointer',
                                                                border: '1px solid #ddd'
                                                            }}
                                                            onClick={() => window.open(img.image_url, '_blank')}
                                                        />
                                                    )) || <Typography variant="caption">Loading...</Typography>}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() => handleQuickApprove(report.damage_id)}
                                                    >
                                                        <CheckCircle />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleViewReport(report)}
                                                    >
                                                        <Cancel />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        // Keep existing card view as option
                        <Grid container spacing={3}>
                            {pendingReports.map((report) => (
                                <Grid item xs={12} md={6} lg={4} key={report.damage_id}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace' }}>
                                                    {report.barcode}
                                                </Typography>
                                                <Chip
                                                    label={report.damage_severity}
                                                    color={getSeverityColor(report.damage_severity)}
                                                    size="small"
                                                    sx={{ textTransform: 'capitalize' }}
                                                />
                                            </Box>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                <strong>Reported by:</strong> {report.reported_by_name}
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                <strong>Location:</strong> {report.location_name} ({report.session_shortname})
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                <strong>Date:</strong> {new Date(report.reported_at).toLocaleDateString()}
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                <strong>Photos:</strong> {report.image_count} attached
                                            </Typography>

                                            {report.damage_description && (
                                                <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                                                    "{report.damage_description}"
                                                </Typography>
                                            )}

                                            <Box sx={{ mt: 2 }}>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<Visibility />}
                                                    onClick={() => handleViewReport(report)}
                                                    size="small"
                                                    fullWidth
                                                >
                                                    Review & Approve
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>
            )}

            {/* Report Detail Dialog */}
            <Dialog 
                open={!!selectedReport} 
                onClose={() => setSelectedReport(null)}
                maxWidth="md"
                fullWidth
            >
                {selectedReport && (
                    <>
                        <DialogTitle>
                            Damage Report Review - {selectedReport.barcode}
                        </DialogTitle>
                        <DialogContent>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Report Details
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Barcode:</strong> {selectedReport.barcode}
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Severity:</strong> {selectedReport.damage_severity}
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Reported by:</strong> {selectedReport.reported_by_name}
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Location:</strong> {selectedReport.location_name}
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Session:</strong> {selectedReport.session_shortname}
                                    </Typography>
                                    <Typography variant="body2" gutterBottom>
                                        <strong>Date:</strong> {new Date(selectedReport.reported_at).toLocaleString()}
                                    </Typography>
                                    {selectedReport.damage_description && (
                                        <>
                                            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                                                Description
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                                "{selectedReport.damage_description}"
                                            </Typography>
                                        </>
                                    )}
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Damage Photos ({reportImages.length})
                                    </Typography>
                                    {reportImages.length > 0 ? (
                                        <ImageList cols={2} rowHeight={120}>
                                            {reportImages.map((image) => (
                                                <ImageListItem key={image.id}>
                                                    <img
                                                        src={image.image_url}
                                                        alt={`Damage photo ${image.image_order}`}
                                                        loading="lazy"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => window.open(image.image_url, '_blank')}
                                                    />
                                                </ImageListItem>
                                            ))}
                                        </ImageList>
                                    ) : (
                                        <Typography color="text.secondary">No photos available</Typography>
                                    )}
                                </Grid>
                            </Grid>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setSelectedReport(null)}>
                                Close
                            </Button>
                            <Button
                                onClick={() => setRejectionDialog(true)}
                                color="error"
                                startIcon={<Cancel />}
                            >
                                Reject
                            </Button>
                            <Button
                                onClick={handleApprove}
                                color="success"
                                variant="contained"
                                disabled={processing}
                                startIcon={processing ? <CircularProgress size={16} /> : <CheckCircle />}
                            >
                                {processing ? 'Approving...' : 'Approve'}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>


            {/* Rejection Dialog */}
            <Dialog open={rejectionDialog} onClose={() => setRejectionDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Reject Damage Report</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Rejected items should be added to the final rack by a scanner as partial damage.
                    </Alert>

                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Rejection Reason"
                        placeholder="Why is this damage report being rejected? (e.g., item is sellable with minor issues, return to distributor, etc.)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectionDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleReject} 
                        color="error" 
                        variant="contained"
                        disabled={!rejectionReason.trim() || processing}
                        startIcon={processing ? <CircularProgress size={20} /> : undefined}
                    >
                        {processing ? 'Rejecting...' : 'Reject Damage Report'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}