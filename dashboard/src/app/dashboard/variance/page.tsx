'use client';

import { useEffect, useState } from 'react';
import { Box, Container, Typography, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { BrandVarianceReport } from '@/components/reports/BrandVarianceReport';
import { Assessment } from '@mui/icons-material';

export default function BrandVariancePage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
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
            Access denied. Brand Variance analysis is only available to Supervisors and Super Users.
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
              Brand Variance Analysis
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Compare expected inventory against actual scan counts to identify overages, shortages, and missing items
            </Typography>
          </Box>
        </Box>

        <BrandVarianceReport userRole={userProfile.role} />
      </Container>
    </DashboardLayout>
  );
}