'use client'

import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip } from '@mui/material'

export default function RecentActivity() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Activity
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time activity feed - Implementation in progress
        </Typography>
      </CardContent>
    </Card>
  )
}