'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Chip,
  CircularProgress,
  Button,
  Alert,
} from '@mui/material';
import { Refresh, TrendingUp, TrendingDown, Assessment, ErrorOutline } from '@mui/icons-material';
import { createClient } from '@/lib/supabase';

interface BrandVariance {
  brand: string;
  expected_value: number;
  actual_value: number;
  variance_value: number;
  variance_percent: number;
  item_count: number;
  scanned_count: number;
}

interface BrandVarianceLiveProps {
  sessionId: string | undefined;
  userRole: string;
}

export function BrandVarianceLive({ sessionId, userRole }: BrandVarianceLiveProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrandVariance[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInventory, setHasInventory] = useState<boolean | null>(null);

  const supabase = createClient();

  const checkInventoryData = async () => {
    if (!sessionId) return;

    try {
      // Get session location to check for inventory
      const { data: session, error: sessionError } = await supabase
        .from('audit_sessions')
        .select('location_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        setHasInventory(false);
        return;
      }

      // Check if inventory exists for this location
      const { count, error: countError } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', session.location_id);

      if (countError) {
        console.error('Error checking inventory:', countError);
        setHasInventory(false);
        return;
      }

      setHasInventory((count || 0) > 0);
    } catch (error) {
      console.error('Error checking inventory data:', error);
      setHasInventory(false);
    }
  };

  const fetchVariance = async () => {
    if (!sessionId || !hasInventory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: varianceData, error } = await supabase
        .rpc('get_live_brand_variance_widget', { session_id: sessionId });
      
      if (error) throw error;
      
      setData(varianceData || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch variance:', error);
      setError('Failed to load variance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      checkInventoryData();
    }
  }, [sessionId]);

  useEffect(() => {
    if (hasInventory === true && data.length === 0) {
      fetchVariance();
    }
  }, [hasInventory]);

  // Only show to supervisor and superuser
  if (!sessionId || (userRole !== 'supervisor' && userRole !== 'superuser')) {
    return null;
  }
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'success.main';
    if (variance < -1000) return 'error.main';
    return 'warning.main';
  };

  const getVarianceIcon = (variance: number) => {
    return variance > 0 ? <TrendingUp /> : <TrendingDown />;
  };

  // Show nothing if no inventory data
  if (hasInventory === false) {
    return null;
  }

  // Show loading state while checking inventory
  if (hasInventory === null) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={20} />
          </Box>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Assessment color="primary" />
            <Typography variant="h6">Brand Variance</Typography>
            <Chip 
              label="Live" 
              color="info" 
              size="small" 
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
            <IconButton 
              onClick={fetchVariance} 
              disabled={loading} 
              size="small"
              color="primary"
            >
              <Refresh sx={{ 
                animation: loading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorOutline />}>
            {error}
          </Alert>
        )}
        
        {!loading && !error && data.length === 0 && (
          <Box textAlign="center" py={3}>
            <Typography color="text.secondary" variant="body2" mb={2}>
              Click refresh to calculate brand variance
            </Typography>
            <Button 
              variant="outlined" 
              onClick={fetchVariance}
              startIcon={<Refresh />}
              size="small"
            >
              Calculate Variance
            </Button>
          </Box>
        )}
        
        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        )}
        
        {!loading && !error && data.map((item, index) => (
          <Box 
            key={item.brand} 
            sx={{ 
              py: 1.5,
              px: 1,
              borderRadius: 1,
              backgroundColor: index % 2 === 0 ? 'action.hover' : 'transparent',
              borderBottom: index === data.length - 1 ? 'none' : '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box flex={1}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {item.brand}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.scanned_count}/{item.item_count} items scanned
                </Typography>
                {item.scanned_count < item.item_count && (
                  <Chip 
                    label={`${item.item_count - item.scanned_count} missing`}
                    color="warning"
                    size="small"
                    sx={{ ml: 1, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              
              <Box textAlign="right">
                <Typography 
                  variant="body2" 
                  sx={{ color: getVarianceColor(item.variance_value) }}
                  fontWeight="bold"
                >
                  {formatCurrency(item.variance_value)}
                </Typography>
                <Chip
                  size="small"
                  label={`${item.variance_percent > 0 ? '+' : ''}${item.variance_percent}%`}
                  color={item.variance_percent > 0 ? 'success' : item.variance_percent < -10 ? 'error' : 'warning'}
                  icon={getVarianceIcon(item.variance_value)}
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>
            </Box>

            {/* Expected vs Actual values */}
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="caption" color="text.secondary">
                Expected: {formatCurrency(item.expected_value)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Actual: {formatCurrency(item.actual_value)}
              </Typography>
            </Box>
          </Box>
        ))}

        {!loading && !error && data.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Showing top 5 brands by variance value. Positive = overage, Negative = shortage.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}