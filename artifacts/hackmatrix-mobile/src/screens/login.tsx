import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { Button, Card, Field, InfoBanner, RoleLabel } from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/src/types/models';

type MainTab = 'demo' | 'clerk';
type DemoMode = 'personas' | 'custom';
type ClerkMode = 'signin' | 'signup';

interface Persona {
  id: string;
  name: string;
  role: Role;
  title: string;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}

const PRESET_PERSONAS: Persona[] = [
  {
    id: 'amara',
    name: 'Amara Shah',
    role: 'patient',
    title: 'Patient',
    detail: 'Mild asthma, Seasonal allergic rhinitis',
    icon: 'heart',
  },
  {
    id: 'david',
    name: 'David Miller',
    role: 'patient',
    title: 'Patient',
    detail: 'Hypertension, Cardiac monitoring & ECG',
    icon: 'activity',
  },
  {
    id: 'priya',
    name: 'Dr. Priya Nair',
    role: 'clinician',
    title: 'Clinician',
    detail: 'Harbor Health Clinic — Primary Care Physician',
    icon: 'briefcase',
  },
  {
    id: 'maya',
    name: 'Dr. Maya Chen',
    role: 'clinician',
    title: 'Clinician',
    detail: 'Harbor Health Clinic — Emergency Medicine',
    icon: 'shield',
  },
];

function extractClerkErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  if (typeof err === 'object' && err !== null) {
    if ('longMessage' in err && typeof (err as any).longMessage === 'string' && (err as any).longMessage) {
      return (err as any).longMessage;
    }
    if ('errors' in err && Array.isArray((err as any).errors)) {
      const firstErr = (err as any).errors[0];
      if (firstErr) {
        return firstErr.longMessage || firstErr.message || 'Authentication request failed.';
      }
    }
    if ('message' in err && typeof (err as any).message === 'string' && (err as any).message) {
      return (err as any).message;
    }
  }
  return err instanceof Error ? err.message : 'Invalid credentials or Clerk authentication failed.';
}

export function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { isReady, role, isUnprovisioned, provisionSelf, signInDemo, signInProduction, signOut, error, clearError } = useAppContext();

  // Top Tabs: Clerk Production vs Demo Sandbox
  const [mainTab, setMainTab] = useState<MainTab>('clerk');

  // Tab 1 (Demo) State
  const [demoMode, setDemoMode] = useState<DemoMode>('personas');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('amara');
  const [customRole, setCustomRole] = useState<Role>('patient');
  const [customName, setCustomName] = useState('');
  const [customDetail, setCustomDetail] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);

  // Tab 2 (Clerk) State
  const [clerkMode, setClerkMode] = useState<ClerkMode>('signin');
  const [clerkLoading, setClerkLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [clerkEmail, setClerkEmail] = useState('');
  const [clerkPassword, setClerkPassword] = useState('');
  const [clerkError, setClerkError] = useState<string | null>(null);
  const [clerkNotice, setClerkNotice] = useState<string | null>(null);

  // Clerk Provisioning State
  const [provisionRole, setProvisionRole] = useState<'PATIENT' | 'CLINICIAN'>('PATIENT');
  const [provisionName, setProvisionName] = useState('');
  const [provisionDetail, setProvisionDetail] = useState('');
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Clerk Sign In 2FA / Device Trust
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [codeResent, setCodeResent] = useState(false);
  const [verificationTarget, setVerificationTarget] = useState('');

  // Clerk In-App Sign Up State
  const [signUpRole, setSignUpRole] = useState<Role>('patient');
  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpNeedsVerification, setSignUpNeedsVerification] = useState(false);
  const [signUpCode, setSignUpCode] = useState('');
  const [signUpCodeLoading, setSignUpCodeLoading] = useState(false);

  const activeClerkEmail =
    clerk.user?.primaryEmailAddress?.emailAddress ??
    clerk.session?.user?.primaryEmailAddress?.emailAddress ??
    (clerk.session ? 'Active session' : null);

  useEffect(() => {
    if (clerk.user && !provisionName) {
      const name = `${clerk.user.firstName || ''} ${clerk.user.lastName || ''}`.trim();
      if (name) setProvisionName(name);
    }
  }, [clerk.user, provisionName]);

  useEffect(() => {
    if (!isReady || !role) return;
    router.replace((role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
  }, [isReady, role, router]);

  // Demo: Enter with selected persona
  const handleLaunchPersona = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    const persona = PRESET_PERSONAS.find((p) => p.id === selectedPersonaId) || PRESET_PERSONAS[0];
    setDemoLoading(true);
    try {
      await signInDemo(persona.role, { name: persona.name, detail: persona.detail });
      router.replace((persona.role === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
    } catch {
      // Handled by context
    } finally {
      setDemoLoading(false);
    }
  };

  // Demo: Enter with custom user profile
  const handleLaunchCustomUser = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);

    const name = customName.trim();
    if (name.length < 2) {
      setClerkError('Please enter a full name (minimum 2 characters).');
      return;
    }
    const detail = customDetail.trim();
    if (!detail) {
      setClerkError(
        customRole === 'patient'
          ? 'Please specify a medical condition or note for this demo patient.'
          : 'Please specify a clinical department or specialty for this demo clinician.'
      );
      return;
    }

    setDemoLoading(true);
    try {
      await signInDemo(customRole, { name, detail });
      router.replace((customRole === 'patient' ? '/(patient)/(tabs)' : '/(clinician)/(tabs)') as never);
    } catch {
      // Handled by context
    } finally {
      setDemoLoading(false);
    }
  };

  // Clerk: Continue active session
  const handleContinueActiveSession = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    setClerkLoading(true);
    try {
      if (clerk.session && clerk.setActive) {
        await clerk.setActive({ session: clerk.session.id });
      }
      await signInProduction();
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setClerkLoading(false);
    }
  };

  // Clerk: Self-provision for testing
  const handleSelfProvision = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    if (!provisionName.trim()) {
      setClerkError('Please enter your full name to complete provisioning.');
      return;
    }
    setProvisionLoading(true);
    try {
      await provisionSelf(provisionRole, provisionName.trim(), provisionDetail.trim() || undefined);
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setProvisionLoading(false);
    }
  };

  // Clerk: Sign out active session
  const handleClerkSignOut = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    setSignOutLoading(true);
    try {
      await signOut();
      setNeedsVerification(false);
      setVerificationCode('');
      setClerkNotice('Signed out of previous account. You can now sign in or register.');
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setSignOutLoading(false);
    }
  };

  const getActiveSignUp = () => {
    return (signUp as any) || (clerk as any)?.client?.signUp || (clerk as any)?.signUp;
  };

  const getActiveSignIn = () => {
    return (signIn as any) || (clerk as any)?.client?.signIn || (clerk as any)?.signIn;
  };

  // Clerk: Sign In
  const handleClerkSignIn = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    setCodeResent(false);

    if (!clerkEmail.trim() || !clerkPassword) {
      setClerkError('Please enter both your email address and password.');
      return;
    }

    const activeSignIn = getActiveSignIn();
    if (!activeSignIn) {
      setClerkError('Clerk authentication service is still initializing. Please wait a moment and try again.');
      return;
    }

    setClerkLoading(true);
    try {
      let result: any;
      try {
        result = await activeSignIn.create({
          identifier: clerkEmail.trim(),
          password: clerkPassword,
        });
      } catch (firstErr: unknown) {
        const msg = extractClerkErrorMessage(firstErr);
        if (msg.toLowerCase().includes('already signed in') || msg.toLowerCase().includes('session')) {
          if (clerk.signOut) {
            await clerk.signOut();
          }
          const retrySignIn = getActiveSignIn();
          if (!retrySignIn) {
            throw firstErr;
          }
          result = await retrySignIn.create({
            identifier: clerkEmail.trim(),
            password: clerkPassword,
          });
        } else {
          throw firstErr;
        }
      }

      const status = result?.status || activeSignIn?.status;
      const createdSessionId = result?.createdSessionId || activeSignIn?.createdSessionId;

      if (status === 'complete') {
        if (createdSessionId && clerk.setActive) {
          await clerk.setActive({ session: createdSessionId });
        }
        await signInProduction();
      } else if (status === 'needs_client_trust' || status === 'needs_second_factor') {
        const secondFactors = result?.supportedSecondFactors || activeSignIn?.supportedSecondFactors || [];
        const emailFactor = secondFactors.find((f: any) => f.strategy === 'email_code');
        const target = emailFactor?.safeIdentifier || clerkEmail.trim();
        setVerificationTarget(target);
        setNeedsVerification(true);
      } else {
        setClerkError(`Additional verification required: ${status || 'unknown'}`);
      }
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setClerkLoading(false);
    }
  };

  // Clerk: Verify Sign In 2FA Code
  const handleVerifyCode = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);
    setCodeResent(false);

    if (!verificationCode.trim()) {
      setClerkError('Please enter the verification code sent to your email.');
      return;
    }

    const activeSignIn = getActiveSignIn();
    if (!activeSignIn) {
      setClerkError('Clerk authentication service is still initializing. Please wait a moment and retry.');
      return;
    }

    setVerificationLoading(true);
    try {
      let completeResult: any;
      try {
        if (typeof activeSignIn.attemptSecondFactor === 'function') {
          completeResult = await activeSignIn.attemptSecondFactor({
            strategy: 'email_code',
            code: verificationCode.trim(),
          });
        } else {
          throw new Error('Second factor verification method not available.');
        }
      } catch (secondFactorErr: any) {
        if (typeof activeSignIn.attemptFirstFactor === 'function') {
          completeResult = await activeSignIn.attemptFirstFactor({
            strategy: 'email_code',
            code: verificationCode.trim(),
          });
        } else {
          throw secondFactorErr;
        }
      }

      const status = completeResult?.status || activeSignIn?.status;
      const createdSessionId = completeResult?.createdSessionId || activeSignIn?.createdSessionId;

      if (status === 'complete') {
        if (createdSessionId && clerk.setActive) {
          await clerk.setActive({ session: createdSessionId });
        }
        await signInProduction();
      } else {
        setClerkError(`Verification incomplete (${status || 'unknown'}). Please check code.`);
      }
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setVerificationLoading(false);
    }
  };

  // Clerk: Resend Sign In 2FA Code
  const handleResendCode = async () => {
    clearError();
    setClerkError(null);

    const activeSignIn = getActiveSignIn();
    if (!activeSignIn) {
      setClerkError('Clerk authentication service is still initializing. Please wait a moment and retry.');
      return;
    }

    setVerificationLoading(true);
    try {
      if (typeof activeSignIn.prepareSecondFactor === 'function') {
        await activeSignIn.prepareSecondFactor({ strategy: 'email_code' });
      } else if (typeof activeSignIn.prepareFirstFactor === 'function') {
        const factors = (activeSignIn as any).supportedFirstFactors;
        const emailFactor = factors?.find((f: any) => f.strategy === 'email_code');
        await (activeSignIn as any).prepareFirstFactor({
          strategy: 'email_code',
          ...(emailFactor?.emailAddressId ? { emailAddressId: emailFactor.emailAddressId } : {}),
        });
      }
      setCodeResent(true);
      setClerkNotice(`A fresh verification code was sent to ${verificationTarget || clerkEmail.trim()}.`);
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setVerificationLoading(false);
    }
  };

  // Clerk: In-App Sign Up (Create New User)
  const handleClerkSignUp = async () => {
    clearError();
    setClerkError(null);
    setClerkNotice(null);

    if (!signUpEmail.trim() || !signUpPassword) {
      setClerkError('Please provide an email address and password for registration.');
      return;
    }
    if (signUpPassword.length < 8) {
      setClerkError('Password must be at least 8 characters long.');
      return;
    }

    const activeSignUp = getActiveSignUp();
    if (!activeSignUp) {
      setClerkError('Clerk authentication service is still initializing. Please wait a moment and try again.');
      return;
    }

    setSignUpLoading(true);
    try {
      if (clerk.session || clerk.user) {
        try {
          await clerk.signOut();
        } catch {
          // ignore
        }
      }

      const result = await activeSignUp.create({
        emailAddress: signUpEmail.trim(),
        password: signUpPassword,
        firstName: signUpFirstName.trim() || undefined,
        lastName: signUpLastName.trim() || undefined,
        unsafeMetadata: {
          requestedRole: signUpRole.toUpperCase(),
        },
      });

      if (result?.error) {
        setClerkError(extractClerkErrorMessage(result.error));
        return;
      }

      const currentStatus = result?.status || activeSignUp?.status;
      const currentSessionId = result?.createdSessionId || activeSignUp?.createdSessionId;
      const unverified = result?.unverifiedFields || activeSignUp?.unverifiedFields;

      if (currentStatus === 'complete') {
        if (currentSessionId && clerk.setActive) {
          await clerk.setActive({ session: currentSessionId });
        }
        try {
          await signInProduction();
        } catch {
          setClerkNotice(
            'Account Created: Your Clerk account is verified. HackMatrix production access requires server-side administrative provisioning before clinical access is granted.'
          );
        }
      } else if (currentStatus === 'missing_requirements' || unverified?.includes('email_address') || !currentStatus || currentStatus === 'unverified') {
        if (typeof activeSignUp.prepareEmailAddressVerification === 'function') {
          await activeSignUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
        } else if (activeSignUp.verifications?.sendEmailCode) {
          await activeSignUp.verifications.sendEmailCode();
        }
        setSignUpNeedsVerification(true);
      } else {
        setClerkNotice(`Registration status: ${currentStatus}. Proceeding...`);
      }
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setSignUpLoading(false);
    }
  };

  // Clerk: Verify New User Email Code
  const handleVerifySignUpCode = async () => {
    clearError();
    setClerkError(null);
    if (!signUpCode.trim()) {
      setClerkError('Please enter the registration verification code.');
      return;
    }

    const activeSignUp = getActiveSignUp();
    if (!activeSignUp) {
      setClerkError('Clerk authentication service is still initializing. Please wait a moment and try again.');
      return;
    }

    setSignUpCodeLoading(true);
    try {
      let completeSignUp: any;
      if (typeof activeSignUp.attemptEmailAddressVerification === 'function') {
        completeSignUp = await activeSignUp.attemptEmailAddressVerification({
          code: signUpCode.trim(),
        });
      } else if (activeSignUp.verifications?.verifyEmailCode) {
        completeSignUp = await activeSignUp.verifications.verifyEmailCode({
          code: signUpCode.trim(),
        });
      }

      if (completeSignUp?.error) {
        setClerkError(extractClerkErrorMessage(completeSignUp.error));
        return;
      }

      const currentStatus = completeSignUp?.status || activeSignUp?.status;
      const currentSessionId = completeSignUp?.createdSessionId || activeSignUp?.createdSessionId;

      if (currentStatus === 'complete' || (completeSignUp && !completeSignUp.error)) {
        if (currentSessionId && clerk.setActive) {
          await clerk.setActive({ session: currentSessionId });
        }
        try {
          await signInProduction();
        } catch {
          setClerkNotice(
            'Registration Verified: Your email is verified. HackMatrix production access requires server-side administrative provisioning before clinical access is granted.'
          );
        }
      } else {
        setClerkError(`Registration incomplete (${currentStatus || 'verification_pending'}). Check code and retry.`);
      }
    } catch (err: unknown) {
      setClerkError(extractClerkErrorMessage(err));
    } finally {
      setSignUpCodeLoading(false);
    }
  };

  const displayedError = clerkError || error;
  const activePersona = PRESET_PERSONAS.find((p) => p.id === selectedPersonaId) || PRESET_PERSONAS[0];

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

      {/* Main Tab Switcher: Clerk Production vs Demo Sandbox */}
      <View style={[styles.tabContainer, { backgroundColor: colors.muted }]}>
        <Pressable
          style={[
            styles.tabButton,
            mainTab === 'clerk' && [styles.tabButtonActive, { backgroundColor: colors.card }],
          ]}
          onPress={() => {
            setMainTab('clerk');
            clearError();
            setClerkError(null);
          }}
          testID="tab-clerk"
        >
          <Feather
            name="lock"
            size={14}
            color={mainTab === 'clerk' ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: mainTab === 'clerk' ? colors.foreground : colors.mutedForeground },
            ]}
          >
            Clerk Auth
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            mainTab === 'demo' && [styles.tabButtonActive, { backgroundColor: colors.card }],
          ]}
          onPress={() => {
            setMainTab('demo');
            clearError();
            setClerkError(null);
          }}
          testID="tab-demo"
        >
          <Feather
            name="zap"
            size={14}
            color={mainTab === 'demo' ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: mainTab === 'demo' ? colors.foreground : colors.mutedForeground },
            ]}
          >
            Demo Sandbox
          </Text>
        </Pressable>
      </View>

      {displayedError ? (
        <View style={styles.errorContainer}>
          <InfoBanner
            title="Authentication Error"
            body={displayedError}
            tone="warning"
            icon="alert-octagon"
          />
        </View>
      ) : null}

      {/* ========================================================= */}
      {/* TAB 1: INSTANT SANDBOX (ZERO-CREDENTIAL USER MANAGEMENT)  */}
      {/* ========================================================= */}
      {mainTab === 'demo' ? (
        <View style={styles.tabContent}>
          {/* Submode Switcher: Preset Personas vs Create Custom User */}
          <View style={[styles.subTabContainer, { borderColor: colors.border }]}>
            <Pressable
              style={[
                styles.subTabButton,
                demoMode === 'personas' && [styles.subTabButtonActive, { backgroundColor: colors.secondary }],
              ]}
              onPress={() => setDemoMode('personas')}
            >
              <Feather
                name="users"
                size={13}
                color={demoMode === 'personas' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.subTabText,
                  { color: demoMode === 'personas' ? colors.primary : colors.mutedForeground },
                ]}
              >
                Sample Personas
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.subTabButton,
                demoMode === 'custom' && [styles.subTabButtonActive, { backgroundColor: colors.secondary }],
              ]}
              onPress={() => setDemoMode('custom')}
            >
              <Feather
                name="user-plus"
                size={13}
                color={demoMode === 'custom' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.subTabText,
                  { color: demoMode === 'custom' ? colors.primary : colors.mutedForeground },
                ]}
              >
                + Create Custom User
              </Text>
            </Pressable>
          </View>

          {/* Submode A: Preset Personas */}
          {demoMode === 'personas' ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.prompt, { color: colors.foreground }]}>
                Choose a pre-configured patient or clinician:
              </Text>

              {PRESET_PERSONAS.map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                const isPat = persona.role === 'patient';
                return (
                  <Pressable key={persona.id} onPress={() => setSelectedPersonaId(persona.id)}>
                    <Card
                      style={[
                        styles.roleCard,
                        isSelected && { borderColor: colors.primary, backgroundColor: colors.card },
                      ]}
                    >
                      <View
                        style={[
                          styles.roleIcon,
                          { backgroundColor: isPat ? colors.successSurface : colors.infoSurface },
                        ]}
                      >
                        <Feather
                          name={persona.icon}
                          size={18}
                          color={isPat ? colors.success : colors.info}
                        />
                      </View>
                      <View style={styles.roleCopy}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.roleTitle, { color: colors.foreground }]}>{persona.name}</Text>
                          <Text
                            style={[
                              styles.roleBadge,
                              {
                                backgroundColor: isPat ? colors.successSurface : colors.infoSurface,
                                color: isPat ? colors.success : colors.info,
                              },
                            ]}
                          >
                            {persona.title}
                          </Text>
                        </View>
                        <Text style={[styles.roleText, { color: colors.mutedForeground }]}>
                          {persona.detail}
                        </Text>
                      </View>
                      <Feather
                        name={isSelected ? 'check-circle' : 'circle'}
                        size={20}
                        color={isSelected ? colors.primary : colors.border}
                      />
                    </Card>
                  </Pressable>
                );
              })}

              <View style={styles.actions}>
                <Button
                  label={`Launch as ${activePersona.name} (${activePersona.title})`}
                  icon="arrow-right"
                  onPress={() => void handleLaunchPersona()}
                  loading={demoLoading}
                  testID="launch-persona-button"
                />
              </View>
            </View>
          ) : (
            /* Submode B: Create Custom User Profile */
            <Card style={styles.clerkCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View style={[styles.codeIcon, { backgroundColor: colors.infoSurface }]}>
                  <Feather name="user-plus" size={18} color={colors.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.clerkTitle, { color: colors.foreground }]}>Create Custom Profile</Text>
                  <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                    Instantly create a new patient or clinician without passwords or email verification.
                  </Text>
                </View>
              </View>

              {/* Role Picker */}
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose Role</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[
                    styles.roleTogglePill,
                    { borderColor: colors.border },
                    customRole === 'patient' && {
                      backgroundColor: colors.successSurface,
                      borderColor: colors.success,
                    },
                  ]}
                  onPress={() => setCustomRole('patient')}
                >
                  <Feather
                    name="heart"
                    size={14}
                    color={customRole === 'patient' ? colors.success : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.roleToggleText,
                      { color: customRole === 'patient' ? colors.success : colors.mutedForeground },
                    ]}
                  >
                    Patient Profile
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.roleTogglePill,
                    { borderColor: colors.border },
                    customRole === 'clinician' && {
                      backgroundColor: colors.infoSurface,
                      borderColor: colors.info,
                    },
                  ]}
                  onPress={() => setCustomRole('clinician')}
                >
                  <Feather
                    name="briefcase"
                    size={14}
                    color={customRole === 'clinician' ? colors.info : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.roleToggleText,
                      { color: customRole === 'clinician' ? colors.info : colors.mutedForeground },
                    ]}
                  >
                    Clinician Profile
                  </Text>
                </Pressable>
              </View>

              <Field
                label={customRole === 'patient' ? 'Patient Full Name' : 'Clinician Name'}
                placeholder={customRole === 'patient' ? 'e.g. Atharv Kamthane' : 'e.g. Dr. Atharv Kamthane'}
                value={customName}
                onChangeText={setCustomName}
                autoCapitalize="words"
              />

              <Field
                label={customRole === 'patient' ? 'Medical Condition (Optional)' : 'Hospital / Department (Optional)'}
                placeholder={
                  customRole === 'patient'
                    ? 'e.g. Type 2 Diabetes, Cardiac history'
                    : 'e.g. Harbor Health Clinic — Cardiology'
                }
                value={customDetail}
                onChangeText={setCustomDetail}
              />

              <Button
                label={`Create & Launch as ${customRole === 'patient' ? 'Patient' : 'Clinician'}`}
                icon="arrow-right"
                onPress={() => void handleLaunchCustomUser()}
                loading={demoLoading}
                testID="create-custom-user-button"
              />
            </Card>
          )}

          <InfoBanner
            title="Instant local sandbox"
            body="Creates patient or clinician data directly in local storage. Zero dashboards, zero passwords, and zero email OTPs required."
            tone="info"
            icon="shield"
          />
        </View>
      ) : null}

      {/* ========================================================= */}
      {/* TAB 2: CLERK PRODUCTION AUTH & IN-APP ACCOUNT REGISTRATION */}
      {/* ========================================================= */}
      {mainTab === 'clerk' ? (
        <View style={styles.tabContent}>
          {clerkNotice ? (
            <InfoBanner title="Notice" body={clerkNotice} tone="info" icon="info" />
          ) : null}

          {/* Submode Switcher: Sign In vs Create New Clerk Account */}
          <View style={[styles.subTabContainer, { borderColor: colors.border }]}>
            <Pressable
              style={[
                styles.subTabButton,
                clerkMode === 'signin' && [styles.subTabButtonActive, { backgroundColor: colors.secondary }],
              ]}
              onPress={() => {
                setClerkMode('signin');
                setClerkError(null);
              }}
            >
              <Feather
                name="log-in"
                size={13}
                color={clerkMode === 'signin' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.subTabText,
                  { color: clerkMode === 'signin' ? colors.primary : colors.mutedForeground },
                ]}
              >
                Sign In
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.subTabButton,
                clerkMode === 'signup' && [styles.subTabButtonActive, { backgroundColor: colors.secondary }],
              ]}
              onPress={() => {
                setClerkMode('signup');
                setClerkError(null);
              }}
            >
              <Feather
                name="user-plus"
                size={13}
                color={clerkMode === 'signup' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.subTabText,
                  { color: clerkMode === 'signup' ? colors.primary : colors.mutedForeground },
                ]}
              >
                Create New Account
              </Text>
            </Pressable>
          </View>

          {/* CLERK MODE 1: SIGN IN */}
          {clerkMode === 'signin' ? (
            <>
              {activeClerkEmail && isUnprovisioned ? (
                <Card style={styles.clerkCard}>
                  <View style={styles.verificationHeader}>
                    <View style={[styles.codeIcon, { backgroundColor: colors.infoSurface }]}>
                      <Feather name="user-check" size={20} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clerkTitle, { color: colors.foreground }]}>
                        Account Provisioning Required
                      </Text>
                      <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                        Logged in as {activeClerkEmail}
                      </Text>
                    </View>
                  </View>
                  <InfoBanner
                    title="Clinical Record Not Linked"
                    body="Your Clerk account is authenticated, but this user is not yet provisioned in HackMatrix clinical records. In development mode, you can self-provision as a test patient or test clinician below."
                    tone="info"
                    icon="shield"
                  />
                  <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 4 }]}>
                    Select role to provision:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <Pressable
                      style={[
                        styles.roleTogglePill,
                        {
                          borderColor: provisionRole === 'PATIENT' ? colors.primary : colors.border,
                          backgroundColor: provisionRole === 'PATIENT' ? colors.secondary : 'transparent',
                        },
                      ]}
                      onPress={() => setProvisionRole('PATIENT')}
                      testID="provision-role-patient"
                    >
                      <Feather name="heart" size={15} color={provisionRole === 'PATIENT' ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.roleToggleText, { color: provisionRole === 'PATIENT' ? colors.primary : colors.foreground }]}>
                        Test Patient
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.roleTogglePill,
                        {
                          borderColor: provisionRole === 'CLINICIAN' ? colors.primary : colors.border,
                          backgroundColor: provisionRole === 'CLINICIAN' ? colors.secondary : 'transparent',
                        },
                      ]}
                      onPress={() => setProvisionRole('CLINICIAN')}
                      testID="provision-role-clinician"
                    >
                      <Feather name="briefcase" size={15} color={provisionRole === 'CLINICIAN' ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.roleToggleText, { color: provisionRole === 'CLINICIAN' ? colors.primary : colors.foreground }]}>
                        Test Clinician
                      </Text>
                    </Pressable>
                  </View>
                  <Field
                    label="Full Name"
                    placeholder={provisionRole === 'PATIENT' ? 'e.g. John Doe' : 'e.g. Dr. Jane Smith'}
                    value={provisionName}
                    onChangeText={setProvisionName}
                    testID="provision-name-input"
                  />
                  <Field
                    label={provisionRole === 'PATIENT' ? 'Medical Note / Condition' : 'Department / Specialty'}
                    placeholder={provisionRole === 'PATIENT' ? 'e.g. Asthma, Hypertension' : 'e.g. Harbor Health Clinic — Primary Care'}
                    value={provisionDetail}
                    onChangeText={setProvisionDetail}
                    testID="provision-detail-input"
                  />
                  <Button
                    label={`Complete Provisioning & Enter as ${provisionRole === 'PATIENT' ? 'Patient' : 'Clinician'}`}
                    icon="check"
                    onPress={() => void handleSelfProvision()}
                    loading={provisionLoading}
                    testID="self-provision-button"
                  />
                  <Button
                    label="Sign out / Switch account"
                    icon="log-out"
                    variant="outline"
                    onPress={() => void handleClerkSignOut()}
                    loading={signOutLoading}
                    testID="clerk-sign-out-button"
                  />
                </Card>
              ) : activeClerkEmail && !needsVerification ? (
                <Card style={styles.activeAccountCard}>
                  <View style={styles.activeAccountHeader}>
                    <View style={[styles.codeIcon, { backgroundColor: colors.infoSurface }]}>
                      <Feather name="user-check" size={18} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activeAccountLabel, { color: colors.mutedForeground }]}>
                        Active Clerk Session
                      </Text>
                      <Text style={[styles.activeAccountEmail, { color: colors.foreground }]}>
                        {activeClerkEmail}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.activeAccountActions}>
                    <Button
                      label="Continue as this user"
                      icon="arrow-right"
                      onPress={() => void handleContinueActiveSession()}
                      loading={clerkLoading}
                      testID="continue-active-user-button"
                    />
                    <Button
                      label="Sign out / Switch account"
                      icon="log-out"
                      variant="outline"
                      onPress={() => void handleClerkSignOut()}
                      loading={signOutLoading}
                      testID="clerk-sign-out-button"
                    />
                  </View>
                </Card>
              ) : null}

              {needsVerification ? (
                <Card style={styles.clerkCard}>
                  <View style={styles.verificationHeader}>
                    <View style={[styles.codeIcon, { backgroundColor: colors.infoSurface }]}>
                      <Feather name="shield" size={20} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clerkTitle, { color: colors.foreground }]}>
                        Device Verification Required
                      </Text>
                      <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                        Clerk sent a 6-digit verification code to {verificationTarget || clerkEmail.trim()}. Enter the code below.
                      </Text>
                    </View>
                  </View>

                  <Field
                    label="Verification Code"
                    placeholder="Enter 6-digit code (e.g. 123456)"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Button
                    label="Verify & Complete Sign In"
                    icon="check-circle"
                    onPress={() => void handleVerifyCode()}
                    loading={verificationLoading}
                    testID="verify-code-button"
                  />

                  <View style={styles.verificationActions}>
                    <Pressable
                      onPress={() => void handleResendCode()}
                      style={styles.textLinkButton}
                      disabled={verificationLoading}
                    >
                      <Text style={[styles.textLink, { color: colors.primary }]}>
                        {codeResent ? 'Code resent! Check inbox' : 'Resend verification code'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setNeedsVerification(false);
                        setVerificationCode('');
                        setClerkError(null);
                      }}
                      style={styles.textLinkButton}
                      disabled={verificationLoading}
                    >
                      <Text style={[styles.textLink, { color: colors.mutedForeground }]}>
                        Back to sign in
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <Card style={styles.clerkCard}>
                  <Text style={[styles.clerkTitle, { color: colors.foreground }]}>
                    {activeClerkEmail ? 'Sign in as different user' : 'Healthcare Identity Login'}
                  </Text>
                  <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                    Enter your Clerk credentials. Roles and organization access are server-controlled.
                  </Text>

                  <Field
                    label="Email Address"
                    placeholder="e.g. user@hackmatrix.org"
                    value={clerkEmail}
                    onChangeText={setClerkEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />

                  <Field
                    label="Password"
                    placeholder="Enter your password"
                    value={clerkPassword}
                    onChangeText={setClerkPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Button
                    label="Sign in with Clerk"
                    icon="lock"
                    onPress={() => void handleClerkSignIn()}
                    loading={clerkLoading}
                    testID="sign-in-clerk-button"
                  />
                </Card>
              )}
            </>
          ) : (
            /* CLERK MODE 2: CREATE NEW CLERK ACCOUNT (SIGN UP) */
            <>
              {signUpNeedsVerification ? (
                <Card style={styles.clerkCard}>
                  <View style={styles.verificationHeader}>
                    <View style={[styles.codeIcon, { backgroundColor: colors.infoSurface }]}>
                      <Feather name="mail" size={20} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clerkTitle, { color: colors.foreground }]}>
                        Verify Email Address
                      </Text>
                      <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                        Clerk sent a 6-digit verification code to {signUpEmail.trim()}. Enter it below to activate your new account.
                      </Text>
                    </View>
                  </View>

                  <Field
                    label="Verification Code"
                    placeholder="Enter 6-digit code"
                    value={signUpCode}
                    onChangeText={setSignUpCode}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Button
                    label="Verify & Complete Account Setup"
                    icon="check-circle"
                    onPress={() => void handleVerifySignUpCode()}
                    loading={signUpCodeLoading}
                    testID="verify-signup-button"
                  />

                  <View style={styles.verificationActions}>
                    <Pressable
                      onPress={() => {
                        setSignUpNeedsVerification(false);
                        setSignUpCode('');
                      }}
                      style={styles.textLinkButton}
                    >
                      <Text style={[styles.textLink, { color: colors.mutedForeground }]}>
                        Back to registration form
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <Card style={styles.clerkCard}>
                  <Text style={[styles.clerkTitle, { color: colors.foreground }]}>
                    Create New Healthcare Account
                  </Text>
                  <Text style={[styles.clerkDescription, { color: colors.mutedForeground }]}>
                    Create a new user directly in Clerk without opening the web dashboard.
                  </Text>

                  {/* Role picker */}
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Designated Role</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[
                        styles.roleTogglePill,
                        { borderColor: colors.border },
                        signUpRole === 'patient' && {
                          backgroundColor: colors.successSurface,
                          borderColor: colors.success,
                        },
                      ]}
                      onPress={() => setSignUpRole('patient')}
                    >
                      <Feather
                        name="heart"
                        size={14}
                        color={signUpRole === 'patient' ? colors.success : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.roleToggleText,
                          { color: signUpRole === 'patient' ? colors.success : colors.mutedForeground },
                        ]}
                      >
                        Patient
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.roleTogglePill,
                        { borderColor: colors.border },
                        signUpRole === 'clinician' && {
                          backgroundColor: colors.infoSurface,
                          borderColor: colors.info,
                        },
                      ]}
                      onPress={() => setSignUpRole('clinician')}
                    >
                      <Feather
                        name="briefcase"
                        size={14}
                        color={signUpRole === 'clinician' ? colors.info : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.roleToggleText,
                          { color: signUpRole === 'clinician' ? colors.info : colors.mutedForeground },
                        ]}
                      >
                        Clinician
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="First Name"
                        placeholder="e.g. Atharv"
                        value={signUpFirstName}
                        onChangeText={setSignUpFirstName}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Last Name"
                        placeholder="e.g. Kamthane"
                        value={signUpLastName}
                        onChangeText={setSignUpLastName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <Field
                    label="Email Address"
                    placeholder="e.g. user@hackmatrix.org"
                    value={signUpEmail}
                    onChangeText={setSignUpEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />

                  <Field
                    label="Password (min 8 characters)"
                    placeholder="Create a secure password"
                    value={signUpPassword}
                    onChangeText={setSignUpPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Button
                    label="Register & Create Clerk Account"
                    icon="user-plus"
                    onPress={() => void handleClerkSignUp()}
                    loading={signUpLoading}
                    testID="register-clerk-button"
                  />
                </Card>
              )}
            </>
          )}

          <InfoBanner
            title="Clerk Cloud Authentication"
            body="Creates real accounts in your Clerk instance. If email verification is enabled on your Clerk project, a verification code will be sent to the email."
            tone="info"
            icon="shield"
          />
        </View>
      ) : null}

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        ADMIN access is available in the separate web experience.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPage: { flexGrow: 1, paddingHorizontal: 23, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { marginBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 37, letterSpacing: -1.2, marginTop: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 320 },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  subTabContainer: {
    flexDirection: 'row',
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
    marginBottom: 10,
    gap: 2,
  },
  subTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 7,
  },
  subTabButtonActive: {
    elevation: 1,
  },
  subTabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  tabContent: {
    gap: 8,
  },
  errorContainer: { marginBottom: 14 },
  prompt: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8 },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12, marginBottom: 10 },
  roleIcon: { width: 43, height: 43, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleCopy: { flex: 1, gap: 4 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  roleBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  roleText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  actions: { marginTop: 8, gap: 14 },
  activeAccountCard: { padding: 14, gap: 10, marginBottom: 8 },
  activeAccountHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeAccountLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  activeAccountEmail: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 2 },
  activeAccountActions: { gap: 8, marginTop: 4 },
  clerkCard: { padding: 16, gap: 12, marginBottom: 12 },
  clerkTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  clerkDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginBottom: 4 },
  verificationHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  codeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  verificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  textLinkButton: { paddingVertical: 6, paddingHorizontal: 4 },
  textLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 2 },
  roleTogglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleToggleText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 18 },
});