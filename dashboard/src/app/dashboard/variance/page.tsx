'use client';

import { useEffect, useState } from 'react';
import { Box, Container, Typography, Alert, Tabs, Tab, Card } from '@mui/material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { BrandVarianceReport } from '@/components/reports/BrandVarianceReport';
import { OverallVarianceReport } from '@/components/reports/OverallVarianceReport';
import { Assessment, TrendingUp, Analytics } from '@mui/icons-material';

export default function VariancePage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (!session) {
        router.push('/auth/login');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        router.push('/auth/login');
        return;
      }

      // Check if user has access to variance features
      if (profile.role !== 'supervisor' && profile.role !== 'superuser') {
        router.push('/dashboard'); // Redirect to main dashboard
        return;
      }

      setUserProfile(profile);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 0:
        return <BrandVarianceReport userRole={userProfile.role} />;
      case 1:
        return <OverallVarianceReport userRole={userProfile.role} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Loading...
          </Typography>
        </Container>
      </DashboardLayout>
    );
  }

  if (!userProfile) {
    return null; // Will redirect in useEffect
  }

  // Double-check access (should be handled by auth check above)
  if (userProfile.role !== 'supervisor' && userProfile.role !== 'superuser') {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">
            Access denied. Variance analysis is only available to Supervisors and Super Users.
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Assessment color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
              Variance Analysis
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Compare expected inventory against actual scan counts to identify overages, shortages, and missing items
            </Typography>
          </Box>
        </Box>

        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 60,
                textTransform: 'none',
                fontSize: '1rem',
              }
            }}
          >
            <Tab 
              label="Brand Variance"
              icon={<TrendingUp />}
              iconPosition="start"
              value={0}
            />
            <Tab 
              label="Overall Variance"
              icon={<Analytics />}
              iconPosition="start"
              value={1}
            />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {renderTabContent()}
      </Container>
    </DashboardLayout>
  );
}