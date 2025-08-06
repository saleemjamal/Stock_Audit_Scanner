'use client'

import { Card, CardContent, Typography, Button, Box } from '@mui/material'

export default function PendingApprovals() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Pending Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Supervisor approval interface - Implementation in progress
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" size="small" disabled>
            View All Approvals
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}