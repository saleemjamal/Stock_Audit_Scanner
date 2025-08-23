'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Inventory2,
  CloudUpload,
  LocationOn,
  TrendingUp,
  Search,
  QrCode,
  Refresh,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase';
import { InventoryImport } from '@/components/inventory/InventoryImport';
import DashboardLayout from '@/components/DashboardLayout';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: 'scanner' | 'supervisor' | 'superuser';
  location_ids: number[];
}

interface Location {
  id: number;
  name: string;
}

interface InventoryStats {
  location_name: string;
  total_items: number;
  total_brands: number;
  total_barcodes: number;
  total_expected_value: number;
}

interface InventoryItem {
  item_code: string;
  barcode: string;
  brand: string;
  item_name: string;
  expected_quantity: number;
  unit_cost: number;
  created_at: string;
}

function InventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadUserAndLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadInventoryData();
    }
  }, [selectedLocation]);

  const loadUserAndLocations = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      setUser(profile);

      // Load locations
      let query = supabase
        .from('locations')
        .select('id, name')
        .eq('active', true)
        .order('name');

      // Filter by location for non-superusers
      if (profile.role !== 'superuser' && profile.location_ids?.length > 0) {
        query = query.in('id', profile.location_ids);
      }

      const { data: locationsData, error: locationsError } = await query;
      if (locationsError) throw locationsError;
      
      setLocations(locationsData || []);
      
      // Auto-select first location if available
      if (locationsData && locationsData.length > 0) {
        setSelectedLocation(locationsData[0].id.toString());
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryData = async () => {
    if (!selectedLocation) return;
    
    try {
      setLoading(true);
      
      // Get location name first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('name')
        .eq('id', selectedLocation)
        .single();

      const locationName = locationData?.name || 'Unknown';

      // Get inventory stats - Use database aggregation instead of client-side calculation
      const { data: aggregateStats, error: aggregateError } = await supabase
        .rpc('get_inventory_stats', { location_id_param: parseInt(selectedLocation) });
        
      if (aggregateError) {
        console.error('Aggregate stats error:', aggregateError);
        console.log('Falling back to chunked queries...');
        
        // Get accurate counts using database aggregation queries
        const { data: distinctItemCodes } = await supabase
          .from('inventory_items')
          .select('item_code')
          .eq('location_id', selectedLocation)
          .limit(60000);
          
        const { data: distinctBrands } = await supabase
          .from('inventory_items')
          .select('brand')
          .eq('location_id', selectedLocation)
          .limit(60000);
          
        const { count: totalCount } = await supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', selectedLocation);
          
        const uniqueItemCodes = new Set(distinctItemCodes?.map(item => item.item_code) || []);
        const uniqueBrands = new Set(distinctBrands?.map(item => item.brand) || []);
        
        console.log('Debug - Fallback counts - Items:', uniqueItemCodes.size, 'Brands:', uniqueBrands.size, 'Total:', totalCount);
        
        const stats: InventoryStats = {
          location_name: locationName,
          total_items: uniqueItemCodes.size,
          total_brands: uniqueBrands.size,
          total_barcodes: totalCount || 0,
          total_expected_value: 0, // Will calculate separately
        };
        
        setInventoryStats(stats);
        
        // Calculate total value separately in chunks
        let totalValue = 0;
        let offset = 0;
        const chunkSize = 10000;
        
        while (true) {
          const { data: valueChunk } = await supabase
            .from('inventory_items')
            .select('expected_quantity, unit_cost')
            .eq('location_id', selectedLocation)
            .range(offset, offset + chunkSize - 1);
            
          if (!valueChunk || valueChunk.length === 0) break;
          
          totalValue += valueChunk.reduce((sum, item) => 
            sum + (item.expected_quantity * item.unit_cost), 0
          );
          
          offset += chunkSize;
          if (valueChunk.length < chunkSize) break;
        }
        
        setInventoryStats(prev => prev ? { ...prev, total_expected_value: totalValue } : null);
      } else {
        // Use aggregated stats from database function
        const dbStats = aggregateStats?.[0];
        if (dbStats) {
          const stats: InventoryStats = {
            location_name: locationName,
            total_items: dbStats.unique_item_codes,
            total_brands: dbStats.unique_brands,
            total_barcodes: dbStats.total_barcodes,
            total_expected_value: dbStats.total_expected_value,
          };
          setInventoryStats(stats);
        }
      }

      // Get detailed inventory items (limited for performance)
      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('location_id', selectedLocation)
        .order('created_at', { ascending: false })
        .limit(500);

      if (itemsError) throw itemsError;
      setInventoryItems(itemsData || []);
      
    } catch (err: any) {
      console.error('Error loading inventory data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportComplete = () => {
    // Reload inventory data after successful import
    loadInventoryData();
  };

  const filteredItems = inventoryItems.filter(item =>
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2 />
          Inventory Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Import and manage expected inventory for variance analysis
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Location Selection and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Location</InputLabel>
                <Select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  label="Select Location"
                >
                  {locations.map((location) => (
                    <MenuItem key={location.id} value={location.id.toString()}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LocationOn fontSize="small" />
                        {location.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                {user?.role === 'superuser' && (
                  <InventoryImport 
                    locationId={selectedLocation} 
                    userRole={user.role}
                    onImportComplete={handleImportComplete}
                  />
                )}
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadInventoryData}
                  disabled={!selectedLocation}
                >
                  Refresh
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inventory Stats */}
      {selectedLocation && inventoryStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <QrCode color="primary" />
                  <Box>
                    <Typography variant="h4">{inventoryStats.total_items}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Unique Items
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Inventory2 color="info" />
                  <Box>
                    <Typography variant="h4">{inventoryStats.total_barcodes}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Barcodes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <TrendingUp color="success" />
                  <Box>
                    <Typography variant="h4">{inventoryStats.total_brands}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Brands
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationOn color="warning" />
                  <Box>
                    <Typography variant="h4">
                      ₹{inventoryStats.total_expected_value.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Expected Value
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Inventory Items Table */}
      {selectedLocation && inventoryItems.length > 0 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Inventory Items ({inventoryItems.length > 500 ? '500+ items' : `${inventoryItems.length} items`})
              </Typography>
              <TextField
                size="small"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Barcode</TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Expected Qty</TableCell>
                    <TableCell align="right">Unit Cost</TableCell>
                    <TableCell align="right">Expected Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow key={`${item.item_code}-${item.barcode}`} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.item_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.barcode}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell>{item.brand}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.item_name}
                      </TableCell>
                      <TableCell align="right">{item.expected_quantity}</TableCell>
                      <TableCell align="right">₹{item.unit_cost.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        ₹{(item.expected_quantity * item.unit_cost).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredItems.length === 0 && searchTerm && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No items found matching "{searchTerm}"
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedLocation && inventoryItems.length === 0 && !loading && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Inventory2 sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Inventory Data
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Import inventory data to enable variance analysis and DC management
              </Typography>
              {user?.role === 'superuser' && (
                <InventoryImport 
                  locationId={selectedLocation} 
                  userRole={user.role}
                  onImportComplete={handleImportComplete}
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

export default function InventoryPageWrapper() {
  return (
    <DashboardLayout>
      <InventoryPage />
    </DashboardLayout>
  );
}