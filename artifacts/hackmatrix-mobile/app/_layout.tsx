import React, { useEffect } from 'react';
import { LogBox, StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProvider } from '@/src/context/AppContext';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

// Suppress known non-fatal development notices from overlaying LogBox in Expo
LogBox.ignoreLogs([
  'Clerk: Clerk has been loaded with development keys',
  '"shadow*" style props are deprecated',
]);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(clinician)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!clerkPublishableKey) {
    return (
      <SafeAreaProvider>
        <View style={styles.configurationMessage}>
          <Text style={styles.configurationText}>
            Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to enable HackMatrix sign-in.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const content = (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
                {content}
              </ClerkProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configurationMessage: { flex: 1, justifyContent: 'center', padding: 24 },
  configurationText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
});
