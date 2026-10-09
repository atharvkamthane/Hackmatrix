import React from 'react';
import { Stack } from 'expo-router';

export default function ClinicianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}