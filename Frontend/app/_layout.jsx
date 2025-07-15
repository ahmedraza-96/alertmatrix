// Import polyfills first
import '../polyfills';

import { AuthProvider } from '../contexts/AuthContext';
import { Stack } from 'expo-router';
import { AlertProvider } from '../contexts/AlertContext';
import React from 'react';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

// Enable screens for better performance and compatibility
enableScreens();

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Error caught by boundary:', error);
    console.log('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ textAlign: 'center' }}>{this.state.error?.message || 'Unknown error'}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <AlertProvider>
            <Stack>
            <Stack.Screen
              name="index"
              options={{ headerShown: false }} // Sign in screen
            />
            
            <Stack.Screen
              name="sign-up"
              options={{ headerShown: false }} // Sign Up screen
            />
            <Stack.Screen
              name="dashboard"
              options={{ headerShown: false }} // Dashboard screen
            />
            <Stack.Screen
              name="active-alarms"
              options={{ headerShown: false }} // Active alarms screen
            />
            <Stack.Screen
              name="generated-alerts"
              options={{ headerShown: false }} // Generated alarms screen
            />
            <Stack.Screen
              name="live-footage"
              options={{ headerShown: false }} // Live footage screen
            />
            <Stack.Screen
              name="reports"
              options={{ headerShown: false }} // Reports screen
            />
                      </Stack>
          </AlertProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}