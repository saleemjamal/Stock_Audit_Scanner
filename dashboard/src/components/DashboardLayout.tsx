'use client'

import { ReactNode, useState, useEffect } from 'react'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard,
  Assessment,
  People,
  Settings,
  ExitToApp,
  Notifications,
  LocationOn,
  Storage,
  CheckCircle,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const drawerWidth = 240

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('username, role, email')
          .eq('email', session.user.email)
          .single()
        
        setCurrentUser(userProfile)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navigationItems = [
    { text: 'Dashboard', icon: <Dashboard />, href: '/dashboard' },
    { text: 'Reports', icon: <Assessment />, href: '/dashboard/reports' },
    { text: 'Locations', icon: <LocationOn />, href: '/dashboard/locations' },
    { text: 'Audit Sessions', icon: <Storage />, href: '/dashboard/sessions' },
    { text: 'Approvals', icon: <CheckCircle />, href: '/dashboard/approvals' },
    { text: 'Users', icon: <People />, href: '/dashboard/users' },
    { text: 'Settings', icon: <Settings />, href: '/dashboard/settings' },
  ]

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Stock Audit
        </Typography>
      </Toolbar>
      <List>
        {navigationItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => router.push(item.href)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Stock Audit Dashboard
          </Typography>

          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton
            edge="end"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {currentUser?.username || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentUser?.role || 'Role'}
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <ExitToApp fontSize="small" />
          </ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>
    </Box>
  )
}