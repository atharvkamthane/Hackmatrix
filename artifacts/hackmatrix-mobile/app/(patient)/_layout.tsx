import React from 'react';
import { Stack } from 'expo-router';
import { RoleGate } from '@/src/components/RoleGate';

export default function PatientLayout() {
  return (
    <RoleGate role="patient"><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></RoleGate>
  );
}
