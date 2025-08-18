'use client'

import DashboardLayout from '@/components/DashboardLayout'
import DamageReportingPage from '@/components/damage/DamageReportingPage'

export default function DamagePage() {
  return (
    <DashboardLayout>
      <DamageReportingPage />
    </DashboardLayout>
  )
}