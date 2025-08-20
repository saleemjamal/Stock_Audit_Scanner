'use client'

// Simple device fingerprinting for multi-device detection
export const deviceDetection = {
  // Generate a simple device fingerprint
  generateDeviceId(): string {
    if (typeof window === 'undefined') return 'server'
    
    const components = [
      navigator.userAgent,
      screen.width.toString(),
      screen.height.toString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ]
    
    // Simple hash function
    const fingerprint = components.join('|')
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  },

  // Get human-readable device info
  getDeviceInfo(): string {
    if (typeof window === 'undefined') return 'Unknown Device'
    
    const ua = navigator.userAgent
    let browser = 'Unknown Browser'
    let os = 'Unknown OS'
    
    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Edg')) browser = 'Edge'
    
    // Detect OS
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Macintosh')) os = 'Mac'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    
    // Detect device type
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const deviceType = isMobile ? 'Mobile' : 'Desktop'
    
    return `${browser} ${deviceType} (${os})`
  },

  // Store current device session
  storeDeviceSession(userId: string): void {
    if (typeof window === 'undefined') return
    
    const deviceId = this.generateDeviceId()
    const deviceInfo = this.getDeviceInfo()
    const sessionData = {
      deviceId,
      deviceInfo,
      userId,
      timestamp: Date.now(),
      lastActivity: Date.now()
    }
    
    localStorage.setItem('device_session', JSON.stringify(sessionData))
    // Also store in a shared key for cross-tab detection
    localStorage.setItem(`user_session_${userId}`, JSON.stringify(sessionData))
  },

  // Check for other device sessions
  checkForOtherDevices(userId: string): { hasOtherDevice: boolean; otherDeviceInfo?: string } {
    if (typeof window === 'undefined') return { hasOtherDevice: false }
    
    const currentDeviceId = this.generateDeviceId()
    const storedSession = localStorage.getItem(`user_session_${userId}`)
    
    if (!storedSession) {
      return { hasOtherDevice: false }
    }
    
    try {
      const sessionData = JSON.parse(storedSession)
      const isOtherDevice = sessionData.deviceId !== currentDeviceId
      const isRecent = (Date.now() - sessionData.lastActivity) < (30 * 60 * 1000) // 30 minutes
      
      return {
        hasOtherDevice: isOtherDevice && isRecent,
        otherDeviceInfo: isOtherDevice ? sessionData.deviceInfo : undefined
      }
    } catch {
      return { hasOtherDevice: false }
    }
  },

  // Update activity timestamp
  updateActivity(userId: string): void {
    if (typeof window === 'undefined') return
    
    const sessionKey = `user_session_${userId}`
    const storedSession = localStorage.getItem(sessionKey)
    
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession)
        sessionData.lastActivity = Date.now()
        localStorage.setItem(sessionKey, JSON.stringify(sessionData))
      } catch {
        // If parsing fails, create new session
        this.storeDeviceSession(userId)
      }
    } else {
      this.storeDeviceSession(userId)
    }
  },

  // Clear device session on logout
  clearDeviceSession(userId: string): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('device_session')
    localStorage.removeItem(`user_session_${userId}`)
  },

  // Set up storage event listener for cross-tab detection
  setupStorageListener(userId: string, onOtherDeviceDetected: (deviceInfo: string) => void): () => void {
    if (typeof window === 'undefined') return () => {}
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `user_session_${userId}` && event.newValue) {
        try {
          const sessionData = JSON.parse(event.newValue)
          const currentDeviceId = this.generateDeviceId()
          
          if (sessionData.deviceId !== currentDeviceId) {
            onOtherDeviceDetected(sessionData.deviceInfo)
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }
}