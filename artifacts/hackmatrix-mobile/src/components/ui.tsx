import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/src/types/models';

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  showRoleSwitch = true,
  back = false,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  showRoleSwitch?: boolean;
  back?: boolean;
  contentStyle?: ViewStyle;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role, signOut } = useAppContext();
  const router = useRouter();
  const webTop = Platform.OS === 'web' ? 67 : 10;
  const bottomSpace = Platform.OS === 'web' ? 110 : 104 + insets.bottom;
  const handleSignOut = async () => {
    await signOut();
    router.replace('/' as never);
  };
  const body = (
    <View style={[styles.content, { paddingTop: insets.top + webTop, paddingBottom: bottomSpace }, contentStyle]}>
      <View style={styles.brandRow}>
        <View style={styles.brandLockup}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.backButton}
              testID="screen-back"
            >
              <Feather name="arrow-left" size={17} color={colors.foreground} />
            </Pressable>
          ) : null}
          <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={15} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>HackMatrix</Text>
        </View>
        {showRoleSwitch && role ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => void handleSignOut()}
            testID="sign-out"
            style={[styles.roleChip, { backgroundColor: colors.secondary }]}
          >
            <Feather name="log-out" size={13} color={colors.primary} />
            <Text style={[styles.roleChipText, { color: colors.secondaryForeground }]}>
              Sign out
            </Text>
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {scroll ? (
        <KeyboardAwareScrollViewCompat
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {body}
        </KeyboardAwareScrollViewCompat>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>{body}</ScrollView>
      )}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'quiet';
  icon?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const tone = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary, textColor: colors.primaryForeground },
    secondary: { backgroundColor: colors.secondary, borderColor: colors.secondary, textColor: colors.secondaryForeground },
    outline: { backgroundColor: colors.card, borderColor: colors.border, textColor: colors.foreground },
    danger: { backgroundColor: colors.destructive, borderColor: colors.destructive, textColor: colors.destructiveForeground },
    quiet: { backgroundColor: 'transparent', borderColor: 'transparent', textColor: colors.primary },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={tone.textColor} /> : null}
      {!loading && icon ? <Feather name={icon} size={16} color={tone.textColor} /> : null}
      <Text style={[styles.buttonText, { color: tone.textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const colors = useColors();
  const palette = {
    neutral: { background: colors.muted, text: colors.mutedForeground },
    success: { background: colors.successSurface, text: colors.success },
    warning: { background: colors.warningSurface, text: colors.warning },
    danger: { background: colors.destructive, text: colors.destructiveForeground },
    info: { background: colors.infoSurface, text: colors.info },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        {...props}
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.input, color: colors.foreground },
          props.style,
        ]}
      />
      {error ? <Text style={[styles.fieldHint, { color: colors.destructive }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

export function InfoBanner({
  title,
  body,
  tone = 'info',
  icon = 'info',
}: {
  title: string;
  body: string;
  tone?: 'info' | 'warning' | 'success';
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  const palette = {
    info: { background: colors.infoSurface, foreground: colors.info },
    warning: { background: colors.warningSurface, foreground: colors.warning },
    success: { background: colors.successSurface, foreground: colors.success },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.background }]}>
      <Feather name={icon} size={17} color={palette.foreground} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, { color: palette.foreground }]}>{title}</Text>
        <Text style={[styles.bannerBody, { color: palette.foreground }]}>{body}</Text>
      </View>
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.keyValue}>
      <Text style={[styles.keyLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.keyText, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

export function RoleLabel({ role }: { role: Role }) {
  const colors = useColors();
  return (
    <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>
      {role === 'patient' ? 'PATIENT DEMO' : 'CLINICIAN DEMO'}
    </Text>
  );
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(12, 28, 25, 0.42)' }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalIcon, { backgroundColor: destructive ? colors.warningSurface : colors.successSurface }]}>
            <Feather
              name={destructive ? 'alert-triangle' : 'shield'}
              size={20}
              color={destructive ? colors.warning : colors.success}
            />
          </View>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>{description}</Text>
          <Button
            label={confirmLabel}
            onPress={() => void onConfirm()}
            variant={destructive ? 'danger' : 'primary'}
          />
          <Button label="Not now" onPress={onCancel} variant="quiet" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 0.1 },
  roleChip: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  roleChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  heading: { marginBottom: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 35, letterSpacing: -0.7 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 7 },
  card: { borderRadius: 18, borderWidth: 1, padding: 17, marginBottom: 13 },
  button: { minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  sectionText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.2 },
  field: { gap: 7, marginBottom: 15 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  emptyState: { alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingVertical: 24, paddingHorizontal: 22, marginBottom: 14 },
  emptyIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, textAlign: 'center' },
  emptyDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 270 },
  banner: { flexDirection: 'row', gap: 11, borderRadius: 14, padding: 14, marginBottom: 14, alignItems: 'flex-start' },
  bannerCopy: { flex: 1, gap: 3 },
  bannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  bannerBody: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, opacity: 0.9 },
  keyValue: { gap: 4, marginVertical: 6 },
  keyLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  keyText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 11 },
  roleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1 },
  modalBackdrop: { flex: 1, padding: 22, justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, padding: 21 },
  modalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26 },
  modalDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 18 },
});
