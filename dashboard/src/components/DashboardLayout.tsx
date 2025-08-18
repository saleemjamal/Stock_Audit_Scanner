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
  Warning,
  Gavel,
  Add,
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
  const [damageOpen, setDamageOpen] = useState(false)
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
    // Load damage section state from localStorage
    const savedDamageOpen = localStorage.getItem('damageSectionOpen')
    if (savedDamageOpen !== null) {
      setDamageOpen(JSON.parse(savedDamageOpen))
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

  const handleDamageToggle = () => {
    const newDamageOpen = !damageOpen
    setDamageOpen(newDamageOpen)
    localStorage.setItem('damageSectionOpen', JSON.stringify(newDamageOpen))
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
      baseItems.push(
        { text: 'Scanning', icon: <QrCodeScanner />, href: '/dashboard/scanning' }
      )
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

  const getDamageItems = () => {
    const items = []
    
    // All users who can scan can report damage
    if (currentUser && ['scanner', 'supervisor', 'superuser'].includes(currentUser.role)) {
      items.push({ text: 'Report Damage', icon: <Warning />, href: '/dashboard/damage' })
    }
    
    // Supervisors and super users can create add-ons
    if (currentUser && ['supervisor', 'superuser'].includes(currentUser.role)) {
      items.push({ text: 'Add-ons', icon: <Add />, href: '/dashboard/add-ons' })
    }
    
    // Note: All approvals are now consolidated in the main Approvals page with tabs
    
    return items
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

          {/* Damage Section - All users who can scan */}
          {currentUser && ['scanner', 'supervisor', 'superuser'].includes(currentUser.role) && sidebarOpen && getDamageItems().length > 0 && (
            <>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={handleDamageToggle}
                  sx={{
                    mx: 1,
                    my: 0.5,
                    borderRadius: 2,
                    minHeight: 48,
                    backgroundColor: 'warning.50',
                    '&:hover': {
                      backgroundColor: 'warning.100',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Warning />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Damage & Add-ons"
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 'medium'
                    }}
                  />
                  {damageOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>

              <Collapse in={damageOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {getDamageItems().map((item) => {
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
                  🚀 Getting Started with Scanning
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Mobile App & Web Dashboard:</strong><br/>
                  1. Navigate to the <strong>Scanning</strong> section from the sidebar<br/>
                  2. Select your <strong>Location</strong> from the dropdown<br/>
                  3. Choose an <strong>Available Rack</strong> to start scanning<br/>
                  4. Use barcode input field, USB scanner, or scan rack barcode (DDMM-###)<br/>
                  5. Scan items one by one - each scan is saved instantly<br/>
                  6. Review scans and delete mistakes before submitting<br/>
                  7. Click <strong>"Complete Rack"</strong> when finished<br/><br/>
                  <em>💡 Tip: Web scanning supports USB scanners for faster input</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  📋 Unified Approvals System
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Role-Based Access:</strong><br/>
                  • <strong>Supervisors</strong>: See Racks tab only<br/>
                  • <strong>Super Users</strong>: See all tabs (Racks, Damage, Add-ons)<br/><br/>
                  
                  <strong>Racks Tab:</strong><br/>
                  1. Review racks in "Ready for Approval" status<br/>
                  2. Click rack number to see detailed scan list<br/>
                  3. Click <strong>✓ Approve</strong> or <strong>✗ Reject</strong><br/>
                  4. Rejected racks require detailed reason<br/><br/>
                  
                  <strong>Damage Tab (Super Users Only):</strong><br/>
                  • Review damaged item reports with 3 photos<br/>
                  • Approve for stock removal or reject with reason<br/><br/>
                  
                  <strong>Add-ons Tab (Super Users Only):</strong><br/>
                  • Review new product documentation requests<br/>
                  • Approve for manual goods inward process
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  📦 Add-Ons System (Supervisors+)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Creating Add-On Requests:</strong><br/>
                  1. Go to <strong>Damage & Add-ons → Add-ons</strong><br/>
                  2. Fill required fields: Brand*, Item Name*, Quantity*, Reason*<br/>
                  3. Add optional pricing: Cost Price, Selling Price (₹)<br/>
                  4. Take <strong>3 photos</strong>: Overall view, close-up details, side angle<br/>
                  5. Submit for super user approval<br/><br/>
                  
                  <strong>When to Use Add-ons:</strong><br/>
                  • Items found at location without barcodes<br/>
                  • New products not in the system<br/>
                  • Items needing manual goods inward process<br/><br/>
                  
                  <em>💡 Tip: All 3 photos are required before submission</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  🔧 Damage Reporting System
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Reporting Damaged Items:</strong><br/>
                  1. Go to <strong>Damage & Add-ons → Report Damage</strong><br/>
                  2. Scan or enter barcode of damaged item<br/>
                  3. Select damage severity: Minor, Moderate, Severe<br/>
                  4. Describe the damage in detail<br/>
                  5. Take <strong>3 photos</strong>: Overall view, close-up details, side angle<br/>
                  6. Estimate loss value (optional)<br/>
                  7. Submit for super user approval<br/><br/>
                  
                  <strong>Camera Requirements:</strong><br/>
                  • Requires HTTPS connection or localhost<br/>
                  • Each photo compressed to 250KB automatically<br/>
                  • Progressive capture guides you through each angle<br/><br/>
                  
                  <em>📸 Camera works on Chrome, Edge, Firefox</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  🎯 Rack Management & Status
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Rack Statuses:</strong><br/>
                  • <strong>Available</strong>: Ready for scanning (green)<br/>
                  • <strong>Assigned</strong>: Currently being worked on (blue)<br/>
                  • <strong>Ready for Approval</strong>: Completed, awaiting review (orange)<br/>
                  • <strong>Rejected</strong>: Needs rework with reason (red)<br/>
                  • <strong>Approved</strong>: Completed and approved (green)<br/><br/>
                  
                  <strong>Rack Barcode Scanning:</strong><br/>
                  • Format: DDMM-### (e.g., 1808-001 for Aug 18, rack 1)<br/>
                  • Scan rack barcode to auto-select and start scanning<br/>
                  • Works on both mobile and web interfaces<br/><br/>
                  
                  <strong>Rejection Workflow:</strong><br/>
                  • Only original scanner can rework rejected racks<br/>
                  • Rejected racks show reason and return to available list<br/>
                  • Scanner can add/remove scans and re-submit
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  📊 Comprehensive Reporting System
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Four Report Types:</strong><br/>
                  
                  <strong>1. Scans Tab:</strong><br/>
                  • Session progress and completion rates<br/>
                  • Individual rack CSV exports with full scan lists<br/>
                  • Include/exclude active racks option<br/><br/>
                  
                  <strong>2. Racks Tab:</strong><br/>
                  • Detailed rack analysis with scanner assignments<br/>
                  • Individual rack reports for physical verification<br/>
                  • Status filtering and progress tracking<br/><br/>
                  
                  <strong>3. Damage Tab:</strong><br/>
                  • Damage reports with status filtering<br/>
                  • Summary statistics and estimated losses<br/>
                  • Photo counts and approval status<br/><br/>
                  
                  <strong>4. Add-ons Tab:</strong><br/>
                  • Add-on requests with cost/selling price totals<br/>
                  • Status filtering (Pending, Approved, Rejected)<br/>
                  • Complete product documentation export<br/><br/>
                  
                  <em>💾 All reports export as CSV with full data</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  🛠 Admin Features (Super Users)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Audit Session Management:</strong><br/>
                  1. Go to <strong>Admin → Audit Sessions</strong><br/>
                  2. Create new sessions with location and rack count<br/>
                  3. Add more racks during active sessions<br/>
                  4. Close sessions when audit complete<br/><br/>
                  
                  <strong>User Management:</strong><br/>
                  • Add users with Google email addresses only<br/>
                  • Assign roles: Scanner, Supervisor, Super User<br/>
                  • Set location access permissions<br/>
                  • Force delete users with test data cleanup<br/><br/>
                  
                  <strong>Location Management:</strong><br/>
                  • Create and manage store locations<br/>
                  • Enable/disable locations<br/>
                  • Assign users to specific locations<br/><br/>
                  
                  <em>🔒 Only super users have full admin access</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  🎮 Dashboard KPIs & Performance
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Real-Time KPIs:</strong><br/>
                  • <strong>Session Progress</strong>: Completed racks vs total racks<br/>
                  • <strong>Pending Approvals</strong>: Racks awaiting supervisor review<br/>
                  • <strong>Active Scanners</strong>: Users who scanned in last 2 hours<br/>
                  • <strong>Quality Rate</strong>: Approval vs rejection percentage<br/><br/>
                  
                  <strong>Scanner Status Widget:</strong><br/>
                  • Real-time scan counts per session (not lifetime)<br/>
                  • Scans per hour performance calculation<br/>
                  • Live updates during scanning activities<br/><br/>
                  
                  <strong>Rack Map View:</strong><br/>
                  • Visual rack status with real scanner names<br/>
                  • Actual scan counts (no placeholder data)<br/>
                  • Color-coded status indicators<br/><br/>
                  
                  <em>📈 All metrics are session-scoped for accurate reporting</em>
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" fontWeight="medium">
                  🚨 Troubleshooting & Tips
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  <strong>Camera Issues:</strong><br/>
                  • Ensure HTTPS connection (not HTTP)<br/>
                  • Allow camera permissions in browser<br/>
                  • Close other apps using the camera<br/>
                  • Supported browsers: Chrome, Edge, Firefox<br/><br/>
                  
                  <strong>USB Scanner Setup:</strong><br/>
                  • Configure scanner to send barcode only (no Enter key)<br/>
                  • For Android: Enable USB OTG in device settings<br/>
                  • Set app battery to "Unrestricted" for consistent power<br/><br/>
                  
                  <strong>Performance Tips:</strong><br/>
                  • Scan queue processes every 15 seconds automatically<br/>
                  • Queue status badge shows sync progress<br/>
                  • Use barcode search in review screens to find specific items<br/>
                  • Single rack focus prevents confusion during scanning<br/><br/>
                  
                  <strong>Role Access:</strong><br/>
                  • Scanners: Mobile app + limited web dashboard scanning<br/>
                  • Supervisors: All scanner features + rack approvals + damage/add-ons creation<br/>
                  • Super Users: Full system access + damage/add-on approvals + admin features<br/><br/>
                  
                  <em>💡 Contact system admin if authentication or permissions issues persist</em>
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