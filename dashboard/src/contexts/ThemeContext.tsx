'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { lightTheme, darkTheme } from '@/lib/theme'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggleTheme: () => void
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>('light')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Load theme preference from localStorage - prioritize user choice
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setMode(savedTheme)
    } else {
      // Only auto-detect system preference if no saved preference exists
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const systemMode = prefersDark ? 'dark' : 'light'
      setMode(systemMode)
      // Save the detected preference so it's consistent next time
      localStorage.setItem('theme-mode', systemMode)
    }
    setIsInitialized(true)
  }, [])

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
    localStorage.setItem('theme-mode', newMode)
  }

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode)
    localStorage.setItem('theme-mode', newMode)
  }

  const theme = mode === 'light' ? lightTheme : darkTheme

  // Don't render until theme is properly initialized to prevent flash
  if (!isInitialized) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}