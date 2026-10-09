import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, InfoBanner, RoleLabel } from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/src/types/models';

export function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady, role, signIn } = useAppContext();
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady || !role) return;
    router.replace((role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
  }, [isReady, role, router]);

  const continueToDemo = async () => {
    setLoading(true);
    try {
      await signIn(selectedRole);
      router.replace((selectedRole === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
    } finally {
      setLoading(false);
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
        <RoleLabel role="patient" />
        <Text style={[styles.title, { color: colors.foreground }]}>Your health,{'\n'}in trusted hands.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          A shared care space where you decide when your records are shared.
        </Text>
      </View>
      <Text style={[styles.prompt, { color: colors.foreground }]}>Choose a demo role</Text>
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
          loading={loading}
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 23, paddingBottom: 16, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 44 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { marginBottom: 27 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 39, letterSpacing: -1.3, marginTop: 13 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 11, maxWidth: 320 },
  prompt: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 11 },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12, marginBottom: 10 },
  roleIcon: { width: 43, height: 43, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleCopy: { flex: 1, gap: 4 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  roleText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  actions: { marginTop: 12, gap: 15 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 8 },
});