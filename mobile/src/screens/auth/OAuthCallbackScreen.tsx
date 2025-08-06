import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { RouteProp } from '@react-navigation/native';

import { AuthStackParamList } from '../../navigation/AuthNavigator';

type OAuthCallbackScreenRouteProp = RouteProp<AuthStackParamList, 'OAuthCallback'>;

interface OAuthCallbackScreenProps {
  route: OAuthCallbackScreenRouteProp;
}

const OAuthCallbackScreen: React.FC<OAuthCallbackScreenProps> = ({ route }) => {
  const { token, error } = route.params;

  useEffect(() => {
    // Handle OAuth callback
    if (token) {
      console.log('OAuth success, token received');
      // Token will be handled by AuthProvider's auth state listener
    } else if (error) {
      console.error('OAuth error:', error);
      // Error will be handled by AuthProvider
    }
  }, [token, error]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1976d2" />
      <Text style={styles.text}>
        {error ? 'Authentication failed...' : 'Signing you in...'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default OAuthCallbackScreen;