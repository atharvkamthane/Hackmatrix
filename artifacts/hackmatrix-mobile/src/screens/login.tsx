import { Feather } from '@expo/vector-icons';
import { useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, InfoBanner } from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/src/types/models';

export function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const { startHostedAuth } = useHostedAuth();
  const { isReady, role, error, signIn, signOut } = useAppContext();
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loadingClerk, setLoadingClerk] = useState<'sign-in' | 'sign-up' | null>(null);
  const [clerkError, setClerkError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !role) return;
    router.replace((role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
  }, [isReady, role, router]);

  const continueToDemo = async () => {
    setLoadingDemo(true);
    try {
      await signIn(selectedRole);
      router.replace((selectedRole === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
    } finally {
      setLoadingDemo(false);
    }
  };

  const beginClerkAuth = async (mode: 'sign-in' | 'sign-up') => {
    setLoadingClerk(mode);
    setClerkError(null);
    try {
      if (Platform.OS === 'web') {
        if (mode === 'sign-in') clerk.openSignIn();
        else clerk.openSignUp();
        return;
      }
      await startHostedAuth({ mode });
    } catch (e) {
      setClerkError(e instanceof Error ? e.message : 'Authentication could not be completed.');
    } finally {
      setLoadingClerk(null);
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
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          A consent-first health platform where records are protected by verifiable access grants.
        </Text>
      </View>

      {/* Role Selection for Demo Mode */}
      <Text style={[styles.prompt, { color: colors.foreground }]}>Choose an access view to explore:</Text>

      <Pressable onPress={() => setSelectedRole('patient')} testID="select-patient-role">
        <Card style={[styles.roleCard, selectedRole === 'patient' && { borderColor: colors.primary, backgroundColor: colors.card }]}>
          <View style={[styles.roleIcon, { backgroundColor: colors.successSurface }]}>
            <Feather name="heart" size={19} color={colors.success} />
          </View>
          <View style={styles.roleCopy}>
            <Text style={[styles.roleTitle, { color: colors.foreground }]}>Patient Portal</Text>
            <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Manage health records, generate QR tokens, approve/revoke access</Text>
          </View>
          <Feather
            name={selectedRole === 'patient' ? 'check-circle' : 'circle'}
            size={20}
            color={selectedRole === 'patient' ? colors.primary : colors.border}
          />
        </Card>
      </Pressable>

      <Pressable onPress={() => setSelectedRole('clinician')} testID="select-clinician-role">
        <Card style={[styles.roleCard, selectedRole === 'clinician' && { borderColor: colors.primary, backgroundColor: colors.card }]}>
          <View style={[styles.roleIcon, { backgroundColor: colors.infoSurface }]}>
            <Feather name="briefcase" size={19} color={colors.info} />
          </View>
          <View style={styles.roleCopy}>
            <Text style={[styles.roleTitle, { color: colors.foreground }]}>Clinician Portal</Text>
            <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Scan patient QR codes, await consent, review clinical records</Text>
          </View>
          <Feather
            name={selectedRole === 'clinician' ? 'check-circle' : 'circle'}
            size={20}
            color={selectedRole === 'clinician' ? colors.primary : colors.border}
          />
        </Card>
      </Pressable>

      <View style={styles.actions}>
        <Button
          label={`Continue as ${selectedRole === 'patient' ? 'Patient' : 'Clinician'}`}
          icon="arrow-right"
          onPress={() => void continueToDemo()}
          loading={loadingDemo}
          testID="continue-to-demo"
        />

        {/* Clerk Authentication section */}
        {isSignedIn ? (
          <View style={{ gap: 8 }}>
            <InfoBanner
              title="Signed in via Clerk"
              body={error ?? 'Authenticated. If your account lacks server metadata role, use the view above to explore.'}
              tone={error ? 'warning' : 'info'}
              icon={error ? 'alert-circle' : 'shield'}
            />
            <Button label="Sign out of Clerk" icon="log-out" variant="outline" onPress={() => void signOut()} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {clerkError ? (
              <InfoBanner title="Authentication Note" body={clerkError} tone="warning" icon="alert-circle" />
            ) : null}
            <Button
              label="Sign in with Clerk"
              icon="log-in"
              variant="outline"
              onPress={() => void beginClerkAuth('sign-in')}
              loading={loadingClerk === 'sign-in'}
            />
          </View>
        )}
      </View>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Server roles are strictly enforced at the backend API boundary.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 23, paddingBottom: 16, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { marginBottom: 24 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -1 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 360 },
  prompt: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 10 },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12, marginBottom: 10 },
  roleIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roleCopy: { flex: 1, gap: 3 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  roleText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  actions: { marginTop: 14, gap: 10 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14, marginTop: 16 },
});
