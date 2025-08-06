import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as StoreProvider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FlashMessage from 'react-native-flash-message';

import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import AuthProvider from './src/components/AuthProvider';
import SyncManager from './src/components/SyncManager';
import DatabaseProvider from './src/components/DatabaseProvider';
import NotificationProvider from './src/components/NotificationProvider';
import { theme } from './src/utils/theme';

const App: React.FC = () => {
  useEffect(() => {
    // Set status bar style
    StatusBar.setBarStyle('dark-content', true);
    StatusBar.setBackgroundColor('#ffffff', true);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
};

export default App;