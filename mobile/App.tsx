import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as StoreProvider } from 'react-redux';
import FlashMessage from 'react-native-flash-message';

// Global error handlers for debugging
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError('🚨 CONSOLE ERROR:', ...args);
  if (args[0] && args[0].toString().includes('RN')) {
    originalConsoleError('📱 React Native Error Details:', JSON.stringify(args, null, 2));
  }
};

// Catch unhandled promise rejections
const handleUnhandledRejection = (event) => {
  console.error('💥 UNHANDLED PROMISE REJECTION:', event.reason);
  console.error('Promise rejection stack:', event.reason?.stack);
};

// Catch uncaught JavaScript errors
const handleUncaughtError = (error, isFatal) => {
  console.error('💥 UNCAUGHT JS ERROR (Fatal:', isFatal, '):', error);
  console.error('Error stack:', error.stack);
};

import { ErrorUtils } from 'react-native';

// Your existing sync error handler
if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
  ErrorUtils.setGlobalHandler(handleUncaughtError);
}

// Catch unhandled promise rejections (modern, engine-agnostic)
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (event: any) => {
    // Prevent default noisy logs
    if (typeof event.preventDefault === 'function') event.preventDefault();

    const reason = event?.reason;
    const error =
      reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));

    // Reuse your global handler; second arg if you want to mark as fatal/non-fatal
    handleUncaughtError(error, /* isUnhandledPromise */ true);
  });
}

import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import AuthProvider from './src/components/AuthProvider';
import SyncManager from './src/components/SyncManager';
import DatabaseProvider from './src/components/DatabaseProvider';
import NotificationProvider from './src/components/NotificationProvider';
import { theme } from './src/utils/theme';

const App: React.FC = () => {
  useEffect(() => {
    console.log('🚀 App.tsx: Starting app initialization...');
    
    // Set status bar style
    try {
      StatusBar.setBarStyle('dark-content', true);
      StatusBar.setBackgroundColor('#ffffff', true);
      console.log('✅ App.tsx: Status bar configured');
    } catch (error) {
      console.error('❌ App.tsx: Status bar configuration failed:', error);
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StoreProvider store={store}>
        <PaperProvider theme={theme}>
          <DatabaseProvider>
            <AuthProvider>
              <SyncManager>
                <NotificationProvider>
                  <StatusBar 
                    barStyle="dark-content" 
                    backgroundColor="#ffffff" 
                    translucent={false}
                  />
                  <AppNavigator />
                  <FlashMessage 
                    position="top" 
                    style={{ paddingTop: StatusBar.currentHeight }}
                  />
                </NotificationProvider>
              </SyncManager>
            </AuthProvider>
          </DatabaseProvider>
        </PaperProvider>
      </StoreProvider>
    </View>
  );
};

export default App;