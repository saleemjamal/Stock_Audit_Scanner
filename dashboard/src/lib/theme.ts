import { createTheme } from '@mui/material/styles'

// Default MUI color palettes with theming infrastructure
const LIGHT_COLORS = {
  // MUI default light palette
  PRIMARY: '#1976d2',
  PRIMARY_LIGHT: '#42a5f5',
  PRIMARY_DARK: '#1565c0',
  
  // Secondary and accent colors
  SECONDARY: '#dc004e',
  SUCCESS: '#2e7d32',
  WARNING: '#ed6c02', 
  ERROR: '#d32f2f',
  INFO: '#0288d1',
  
  // Background and surfaces
  BACKGROUND: '#fafafa',
  SURFACE: '#ffffff',
  SURFACE_VARIANT: '#f5f5f5',
  
  // Text colors
  TEXT_PRIMARY: '#212121',
  TEXT_SECONDARY: '#757575',
  TEXT_MUTED: '#9e9e9e',
  
  // Borders and dividers
  BORDER: '#e0e0e0',
  DIVIDER: '#e0e0e0',
} as const

const DARK_COLORS = {
  // MUI default dark palette
  PRIMARY: '#90caf9',
  PRIMARY_LIGHT: '#e3f2fd',
  PRIMARY_DARK: '#42a5f5',
  
  // Secondary and accent colors
  SECONDARY: '#f48fb1',
  SUCCESS: '#66bb6a',
  WARNING: '#ffa726',
  ERROR: '#f44336',
  INFO: '#29b6f6',
  
  // Background and surfaces
  BACKGROUND: '#121212',
  SURFACE: '#1e1e1e',
  SURFACE_VARIANT: '#2d2d2d',
  
  // Text colors
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: '#aaaaaa',
  TEXT_MUTED: '#888888',
  
  // Borders and dividers
  BORDER: '#333333',
  DIVIDER: '#333333',
} as const

// Function to create theme with specific color palette
const createCustomTheme = (colors: typeof LIGHT_COLORS | typeof DARK_COLORS) => createTheme({
  palette: {
    primary: {
      main: colors.PRIMARY,
      light: colors.PRIMARY_LIGHT,
      dark: colors.PRIMARY_DARK,
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.SECONDARY,
      contrastText: '#ffffff',
    },
    success: {
      main: colors.SUCCESS,
      contrastText: '#ffffff',
    },
    warning: {
      main: colors.WARNING,
      contrastText: '#ffffff',
    },
    error: {
      main: colors.ERROR,
      contrastText: '#ffffff',
    },
    info: {
      main: colors.INFO,
      contrastText: '#ffffff',
    },
    background: {
      default: colors.BACKGROUND,
      paper: colors.SURFACE,
    },
    text: {
      primary: colors.TEXT_PRIMARY,
      secondary: colors.TEXT_SECONDARY,
    },
    divider: colors.DIVIDER,
    // Custom palette extensions
    grey: {
      50: colors.BACKGROUND,
      100: colors.SURFACE_VARIANT,
      200: colors.BORDER,
      300: colors.DIVIDER,
      400: colors.TEXT_MUTED,
      500: colors.TEXT_SECONDARY,
      600: colors.TEXT_PRIMARY,
      700: colors.PRIMARY_DARK,
      800: colors.SECONDARY,
      900: colors.PRIMARY,
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontWeight: 500,
          textTransform: 'none',
          fontSize: '0.875rem',
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            backgroundColor: 'action.hover',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          border: 'none',
          backgroundColor: 'background.paper',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: 'none',
          boxShadow: 'none',
          backgroundColor: 'background.paper',
        },
        elevation1: {
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.75rem',
          height: 24,
        },
        colorPrimary: {
          backgroundColor: 'primary.main',
          color: '#ffffff',
        },
        colorSecondary: {
          backgroundColor: 'secondary.main',
          color: '#ffffff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: 'none',
          backgroundColor: 'background.default',
          color: 'text.primary',
          '&.MuiAppBar-colorPrimary': {
            backgroundColor: 'background.default',
            color: 'text.primary',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          boxShadow: 'none',
          backgroundColor: 'background.default',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&.Mui-selected': {
            backgroundColor: 'action.selected',
            color: 'text.primary',
            '&:hover': {
              backgroundColor: 'action.selected',
            },
            '& .MuiListItemIcon-root': {
              color: 'text.primary',
            },
          },
        },
      },
    },
  },
})

// Export both light and dark themes
export const lightTheme = createCustomTheme(LIGHT_COLORS)
export const darkTheme = createCustomTheme(DARK_COLORS)

// Default theme (light)
export const theme = lightTheme