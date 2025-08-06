import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/auth/LoginScreen';
import OAuthCallbackScreen from '../screens/auth/OAuthCallbackScreen';

export type AuthStackParamList = {
  Login: undefined;
  OAuthCallback: { 
    token?: string; 
    error?: string; 
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#ffffff' },
      }}
      initialRouteName="Login"
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen 
        name="OAuthCallback" 
        component={OAuthCallbackScreen}
        options={{
          animationEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;