import { Feather } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

function NativePatientTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} />
        <NativeTabs.Trigger.Label>Records</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="qr">
        <NativeTabs.Trigger.Icon sf={{ default: 'qrcode', selected: 'qrcode' }} />
        <NativeTabs.Trigger.Label>My QR</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="access">
        <NativeTabs.Trigger.Icon sf={{ default: 'lock.shield', selected: 'lock.shield.fill' }} />
        <NativeTabs.Trigger.Label>Access</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicPatientTabs() {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 9, marginTop: 2 },
        tabBarStyle: {
          position: 'absolute',
          height: isWeb ? 84 : 58 + insets.bottom,
          paddingBottom: isWeb ? 34 : insets.bottom,
          paddingTop: 6,
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={85} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Feather name="home" size={19} color={color} /> }} />
      <Tabs.Screen name="records" options={{ title: 'Records', tabBarIcon: ({ color }) => <Feather name="file-text" size={19} color={color} /> }} />
      <Tabs.Screen name="qr" options={{ title: 'My QR', tabBarIcon: ({ color }) => <Feather name="grid" size={19} color={color} /> }} />
      <Tabs.Screen name="access" options={{ title: 'Access', tabBarIcon: ({ color }) => <Feather name="shield" size={19} color={color} /> }} />
    </Tabs>
  );
}

export default function PatientTabs() {
  return isLiquidGlassAvailable() ? <NativePatientTabs /> : <ClassicPatientTabs />;
}