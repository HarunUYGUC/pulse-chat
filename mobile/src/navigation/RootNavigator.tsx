import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { startSignalRConnection } from '../services/signalr';
import { AuthNavigator } from './AuthNavigator';
import { DrawerNavigator } from './DrawerNavigator';
import { colors } from '../theme/colors';
import { MessageSquare } from 'lucide-react-native';

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, token, initAuth } = useAuthStore();
  const { fetchChannels } = useChatStore();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect to SignalR real-time hub
      startSignalRConnection(token).catch((err) => {
        console.error('Initial SignalR connection error:', err);
      });

      // Load initial channel list
      fetchChannels();
    }
  }, [isAuthenticated, token]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoCircle}>
          <MessageSquare color={colors.text} size={42} />
        </View>
        <Text style={styles.splashTitle}>PulseChat</Text>
        <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <DrawerNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  spinner: {
    marginTop: 24,
  },
});
