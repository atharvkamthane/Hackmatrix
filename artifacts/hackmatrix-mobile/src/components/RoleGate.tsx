import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppContext } from '@/src/context/AppContext';
import type { Role } from '@/src/types/models';

/** Client-side navigation guard. The API remains the authority for all data. */
export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { isReady, role: authenticatedRole } = useAppContext();
  if (!isReady) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (authenticatedRole !== role) return <Redirect href="/" />;
  return <>{children}</>;
}
