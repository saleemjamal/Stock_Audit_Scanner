'use client'

import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode } from 'react'
import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext'

interface ThemeProviderProps {
  children: ReactNode
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <CustomThemeProvider>
      <CssBaseline />
      {children}
    </CustomThemeProvider>
  )
}