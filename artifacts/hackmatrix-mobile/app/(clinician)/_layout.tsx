import React from 'react';
import { Stack } from 'expo-router';
import { RoleGate } from '@/src/components/RoleGate';

export default function ClinicianLayout() {
  return (
    <RoleGate role="clinician"><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></RoleGate>
  );
}
