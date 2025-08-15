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
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  QrCodeScanner,
  AdminPanelSettings,
  ExpandLess,
  ExpandMore,
  HelpOutline,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'

const drawerWidth = 240
const miniDrawerWidth = 60

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { mode } = useTheme()

  useEffect(() => {
    loadCurrentUser()
    // Load admin section state from localStorage
    const savedAdminOpen = localStorage.getItem('adminSectionOpen')
    if (savedAdminOpen !== null) {
      setAdminOpen(JSON.parse(savedAdminOpen))
    }
    // Load sidebar state from localStorage
    const savedSidebarOpen = localStorage.getItem('sidebarOpen')
    if (savedSidebarOpen !== null) {
      setSidebarOpen(JSON.parse(savedSidebarOpen))
    }
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

  const handleSidebarToggle = () => {
    const newSidebarOpen = !sidebarOpen
    setSidebarOpen(newSidebarOpen)
    localStorage.setItem('sidebarOpen', JSON.stringify(newSidebarOpen))
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

  const handleAdminToggle = () => {
    const newAdminOpen = !adminOpen
    setAdminOpen(newAdminOpen)
    localStorage.setItem('adminSectionOpen', JSON.stringify(newAdminOpen))
  }

  const handleHelpOpen = () => {
    setHelpOpen(true)
    setAnchorEl(null) // Close profile menu
  }

  const handleHelpClose = () => {
    setHelpOpen(false)
  }

  const getNavigationItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <Dashboard />, href: '/dashboard' },
    ]

    // Add scanning for all users who can scan (scanner, supervisor, superuser)
    if (currentUser && ['scanner', 'supervisor', 'superuser'].includes(currentUser.role)) {
      baseItems.push({ text: 'Scanning', icon: <QrCodeScanner />, href: '/dashboard/scanning' })
    }

    // Add other items based on role
    if (currentUser && ['supervisor', 'superuser'].includes(currentUser.role)) {
      baseItems.push(
        { text: 'Approvals', icon: <CheckCircle />, href: '/dashboard/approvals' },
        { text: 'Reports', icon: <Assessment />, href: '/dashboard/reports' },
      )
    }

    // Settings for all users
    if (currentUser) {
      baseItems.push({ text: 'Settings', icon: <Settings />, href: '/dashboard/settings' })
    }

    return baseItems
  }

  const getAdminItems = () => {
    if (currentUser?.role !== 'superuser') return []
    
    return [
      { text: 'Audit Sessions', icon: <Storage />, href: '/dashboard/sessions' },
      { text: 'Locations', icon: <LocationOn />, href: '/dashboard/locations' },
      { text: 'Users', icon: <People />, href: '/dashboard/users' },
    ]
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Simplified Header */}
      <Box sx={{ p: sidebarOpen ? 2 : 1, display: 'flex', flexDirection: 'column', alignItems: sidebarOpen ? 'flex-start' : 'center' }}>
        {sidebarOpen ? (
          <>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 0.5 }}>
              Stock Audit
            </Typography>
            {currentUser && (
              <Typography variant="caption" sx={{ 
                textTransform: 'uppercase', 
                fontWeight: 'medium',
                color: 'text.secondary'
              }}>
                {currentUser.role}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: '1rem' }}>
            SA
          </Typography>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, px: 1 }}>
        <List disablePadding>
          {/* Main Navigation Items */}
          {getNavigationItems().map((item, index) => {
            const isActive = typeof window !== 'undefined' && window.location.pathname === item.href
            
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton 
                  onClick={() => router.push(item.href)}
                  sx={{
                    mx: 1,
                    my: 0.5,
                    borderRadius: 2,
                    minHeight: 48,
                    backgroundColor: isActive ? 'action.selected' : 'transparent',
                    color: isActive ? 'text.primary' : 'text.primary',
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: sidebarOpen ? 2 : 1,
                    '&:hover': {
                      backgroundColor: isActive ? 'action.selected' : 'action.hover',
                    },
                    '& .MuiListItemIcon-root': {
                      color: isActive ? 'text.primary' : 'text.secondary',
                      minWidth: sidebarOpen ? 40 : 'unset',
                      mr: sidebarOpen ? 1 : 0,
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: sidebarOpen ? 40 : 'unset', mr: sidebarOpen ? 1 : 0 }}>
                    {item.icon}
                  </ListItemIcon>
                  {sidebarOpen && (
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 'medium' : 'regular'
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            )
          })}

          {/* Admin Section - Superuser Only */}
          {currentUser?.role === 'superuser' && sidebarOpen && (
            <>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={handleAdminToggle}
                  sx={{
                    mx: 1,
                    my: 0.5,
                    borderRadius: 2,
                    minHeight: 48,
                    backgroundColor: 'grey.50',
                    '&:hover': {
                      backgroundColor: 'grey.100',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <AdminPanelSettings />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Admin"
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 'medium'
                    }}
                  />
                  {adminOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>

              <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {getAdminItems().map((item) => {
                    const isActive = typeof window !== 'undefined' && window.location.pathname === item.href
                    
                    return (
                      <ListItem key={item.text} disablePadding>
                        <ListItemButton 
                          onClick={() => router.push(item.href)}
                          sx={{
                            mx: 1,
                            my: 0.5,
                            ml: 4, // Indent sub-items
                            borderRadius: 2,
                            minHeight: 40,
                            backgroundColor: isActive ? 'action.selected' : 'transparent',
                            color: isActive ? 'text.primary' : 'text.primary',
                            '&:hover': {
                              backgroundColor: isActive ? 'action.selected' : 'action.hover',
                            },
                            '& .MuiListItemIcon-root': {
                              color: isActive ? 'text.primary' : 'text.secondary',
                              minWidth: 32,
                            }
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.text}
                            primaryTypographyProps={{
                              fontSize: '0.8125rem',
                              fontWeight: isActive ? 'medium' : 'regular'
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    )
                  })}
                </List>
              </Collapse>
            </>
          )}
        </List>
      </Box>

      {/* Simplified Footer */}
      {sidebarOpen && (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            Version 1.0
          </Typography>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          width: { sm: `calc(100% - ${sidebarOpen ? drawerWidth : miniDrawerWidth}px)` },
          ml: { sm: `${sidebarOpen ? drawerWidth : miniDrawerWidth}px` },
          bgcolor: 'background.default',
          color: 'text.primary',
          boxShadow: 'none',
          transition: 'width 0.3s ease, margin-left 0.3s ease',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            edge="start"
            onClick={handleSidebarToggle}
            sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
          >
            <MenuIcon />
          </IconButton>
          
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
        sx={{ width: { sm: sidebarOpen ? drawerWidth : miniDrawerWidth }, flexShrink: { sm: 0 } }}
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
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: sidebarOpen ? drawerWidth : miniDrawerWidth,
              transition: 'width 0.3s ease',
              overflowX: 'hidden',
            },
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
          width: { sm: `calc(100% - ${sidebarOpen ? drawerWidth : miniDrawerWidth}px)` },
          transition: 'width 0.3s ease',
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
        <MenuItem onClick={handleHelpOpen}>
          <ListItemIcon>
            <HelpOutline fontSize="small" />
          </ListItemIcon>
          Help & Support
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <ExitToApp fontSize="small" />
          </ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onClose={handleHelpClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpOutline />
            Help & Support
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  How to Start Scanning?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  1. Navigate to the <strong>Scanning</strong> section from the sidebar<br/>
                  2. Select your <strong>Location</strong> from the dropdown<br/>
                  3. Choose an <strong>Available Rack</strong> to start scanning<br/>
                  4. Use the barcode input field or connect a USB scanner<br/>
                  5. Scan items one by one - each scan is automatically saved<br/>
                  6. Click <strong>"Complete Rack"</strong> when finished
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Rack Selection
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  • <strong>Available</strong>: Ready for scanning<br/>
                  • <strong>Assigned</strong>: Currently being worked on<br/>
                  • <strong>Ready for Approval</strong>: Completed, awaiting supervisor review<br/>
                  • <strong>Rejected</strong>: Needs rework (only original scanner can re-select)<br/>
                  • <strong>Approved</strong>: Completed and approved<br/><br/>
                  <em>Tip: Rejected racks show in red with the reason for rejection</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Approval Process
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>For Supervisors/Superusers:</strong><br/>
                  1. Go to <strong>Approvals</strong> section<br/>
                  2. Review racks in "Ready for Approval" status<br/>
                  3. Click on a rack to see detailed scan list<br/>
                  4. Click <strong>✓ Approve</strong> to accept the rack<br/>
                  5. View approved racks in the dashboard<br/><br/>
                  <em>Approved racks are final and cannot be modified</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Rejection Workflow
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Rejecting a Rack:</strong><br/>
                  1. In Approvals, click <strong>✗ Reject</strong> on a rack<br/>
                  2. Enter a detailed reason for rejection<br/>
                  3. Click "Reject Rack" to confirm<br/><br/>
                  <strong>Reworking Rejected Racks:</strong><br/>
                  • Only the original scanner can rework rejected racks<br/>
                  • Rejected racks appear with red styling and reason<br/>
                  • Original scanner can add/remove scans and re-submit<br/>
                  • Other scanners will see "assigned to [scanner name]" message
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Audit Session Management
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>For Superusers:</strong><br/>
                  1. Go to <strong>Admin → Audit Sessions</strong><br/>
                  2. Click "Create New Session" to start an audit<br/>
                  3. Select location and set total rack count<br/>
                  4. Add more racks using "Add Racks" if needed<br/>
                  5. Close session when audit is complete<br/><br/>
                  <em>Only one active session allowed at a time per location</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Reporting & Analytics
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Available Reports:</strong><br/>
                  • <strong>Session Progress</strong>: Overall completion status<br/>
                  • <strong>Scanner Performance</strong>: Individual productivity metrics<br/>
                  • <strong>Quality Reports</strong>: Approval vs rejection rates<br/>
                  • <strong>Detailed Scan Lists</strong>: Item-level data export<br/><br/>
                  Access reports from the <strong>Reports</strong> section in the sidebar
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  Understanding KPIs
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Dashboard KPIs Explained:</strong><br/>
                  • <strong>Session Progress</strong>: Completed racks vs total racks<br/>
                  • <strong>Pending Approvals</strong>: Racks awaiting supervisor review<br/>
                  • <strong>Active Scanners</strong>: Users who scanned in last 2 hours<br/>
                  • <strong>Quality Rate</strong>: Percentage of racks approved vs rejected<br/><br/>
                  <em>Progress bars show performance relative to targets</em>
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleHelpClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}