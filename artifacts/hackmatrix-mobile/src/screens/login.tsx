import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/expo/legacy';
import { Button, Card, InfoBanner, RoleLabel } from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/src/types/models';

export function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady, role, signInDemo, signInProduction, error, clearError } = useAppContext();
  const { isLoaded: clerkLoaded, signIn, setActive } = useSignIn();
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !role) return;
    router.replace((role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
  }, [isReady, role, router]);

  const continueToDemo = async () => {
    clearError();
    setDemoLoading(true);
    try {
      await signInDemo(selectedRole);
      router.replace((selectedRole === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
    } catch {
      // Error handled by context
    } finally {
      setDemoLoading(false);
    }
  };

  const handleProductionSignIn = async () => {
    clearError();
    setSignInError(null);
    setProdLoading(true);
    try {
      if (!clerkLoaded || !signIn || !setActive) {
        throw new Error('The identity provider is not ready. Please try again.');
      }
      const result = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });
      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('This account requires an additional verification step that is not configured in this client.');
      }
      await setActive({ session: result.createdSessionId });
      await signInProduction();
    } catch (cause) {
      setSignInError(cause instanceof Error ? cause.message : 'Sign-in could not be completed.');
    } finally {
      setProdLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollPage,
        { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Feather name="activity" size={19} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.brandName, { color: colors.foreground }]}>HackMatrix</Text>
      </View>

      <View style={styles.hero}>
        <RoleLabel role="patient" />
        <Text style={[styles.title, { color: colors.foreground }]}>Your health,{'\n'}in trusted hands.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          A shared care space where you decide when your records are shared.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <InfoBanner
            title="Authentication Error"
            body={error}
            tone="warning"
            icon="alert-octagon"
          />
        </View>
      ) : null}
      {signInError ? <View style={styles.errorContainer}><InfoBanner title="Sign-in failed" body={signInError} tone="warning" icon="alert-circle" /></View> : null}

      {/* Production Authentication Boundary */}
      <View style={styles.sectionHeader}>
        <Feather name="lock" size={14} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Production Identity</Text>
      </View>

      <Card style={styles.prodCard}>
        <Text style={[styles.prodTitle, { color: colors.foreground }]}>Verified Healthcare Login</Text>
        <Text style={[styles.prodDescription, { color: colors.mutedForeground }]}>
          Authenticates through Clerk. Roles and permissions are server-controlled by the backend.
        </Text>
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmailAddress}
          placeholder="Email address"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.credentialInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={emailAddress}
        />
        <TextInput
          accessibilityLabel="Password"
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={[styles.credentialInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={password}
        />
        <Button
          label="Sign in with Verified Identity"
          icon="shield"
          onPress={() => void handleProductionSignIn()}
          loading={prodLoading}
          testID="sign-in-production"
        />
      </Card>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>OR TEST IN DEMO MODE</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Demo Sandbox Boundary */}
      <Text style={[styles.prompt, { color: colors.foreground }]}>Choose a demo sandbox role</Text>
      <Pressable onPress={() => setSelectedRole('patient')} testID="select-patient-role">
        <Card style={[styles.roleCard, selectedRole === 'patient' && { borderColor: colors.primary, backgroundColor: colors.card }]}>
          <View style={[styles.roleIcon, { backgroundColor: colors.successSurface }]}>
            <Feather name="heart" size={19} color={colors.success} />
          </View>
          <View style={styles.roleCopy}>
            <Text style={[styles.roleTitle, { color: colors.foreground }]}>Patient</Text>
            <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Manage records and control access</Text>
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
            <Text style={[styles.roleTitle, { color: colors.foreground }]}>Clinician</Text>
            <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Request consent before viewing records</Text>
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
          label="Continue to demo"
          icon="arrow-right"
          onPress={() => void continueToDemo()}
          loading={demoLoading}
          testID="continue-to-demo"
        />
        <InfoBanner
          title="Demo environment"
          body="Uses synthetic sample data and local mock sign-in. No credentials or real patient information are collected."
          tone="info"
          icon="shield"
        />
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>ADMIN access is available in the separate web experience.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPage: { flexGrow: 1, paddingHorizontal: 23, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 39, letterSpacing: -1.3, marginTop: 13 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 11, maxWidth: 320 },
  errorContainer: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  prodCard: { padding: 14, gap: 10, marginBottom: 16 },
  credentialInput: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 13 },
  prodTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  prodDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.5 },
  prompt: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 11 },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12, marginBottom: 10 },
  roleIcon: { width: 43, height: 43, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleCopy: { flex: 1, gap: 4 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  roleText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  actions: { marginTop: 12, gap: 15 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 16 },
});