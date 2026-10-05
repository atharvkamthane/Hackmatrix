import { Feather } from '@expo/vector-icons';
import { useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, InfoBanner } from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';

export function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const { startHostedAuth } = useHostedAuth();
  const { isReady, role, error } = useAppContext();
  const [loading, setLoading] = useState<'sign-in' | 'sign-up' | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isReady || !role) return;
    router.replace((role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
  }, [isLoaded, isReady, isSignedIn, role, router]);

  const beginAuthentication = async (mode: 'sign-in' | 'sign-up') => {
    setLoading(mode);
    try {
      // Hosted auth is native-only. On web Clerk opens its web sign-in/sign-up
      // experience, whose HTTP callback is valid for this browser origin.
      if (Platform.OS === 'web') {
        if (mode === 'sign-in') clerk.openSignIn();
        else clerk.openSignUp();
        return;
      }
      await startHostedAuth({ mode });
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Feather name="activity" size={19} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.brandName, { color: colors.foreground }]}>HackMatrix</Text>
      </View>
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>SECURE HEALTH ACCESS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Your health, in trusted hands.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A shared care space where your records are protected by your authenticated account.</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Sign in" icon="log-in" onPress={() => void beginAuthentication('sign-in')} loading={loading === 'sign-in'} />
        <Button label="Create an account" icon="user-plus" variant="outline" onPress={() => void beginAuthentication('sign-up')} loading={loading === 'sign-up'} />
        {error ? <InfoBanner title="Account access unavailable" body={error} tone="warning" icon="alert-circle" /> : null}
        <InfoBanner title="Roles are assigned by HackMatrix" body="Your patient or clinician access is determined by the server after you sign in. This device cannot choose or change your role." tone="info" icon="shield" />
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>ADMIN access is available in the separate web experience.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 23, paddingBottom: 16, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 44 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { marginBottom: 32 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 39, letterSpacing: -1.3 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 11, maxWidth: 340 },
  actions: { gap: 12 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 16 },
});
