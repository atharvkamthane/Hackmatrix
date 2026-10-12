import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  InfoBanner,
  Screen,
  SectionTitle,
} from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { services } from '@/src/services';
import type {
  AccessGrant,
  AccessHistoryEntry,
  AccessRequest,
  Condition,
  DemoState,
  Encounter,
  Observation,
  PatientProfile,
  PatientQrToken,
  Prescription,
} from '@/src/types/models';
import { formatDate, formatDateTime, timeLeft } from '@/src/utils/format';

function ItemHeading({
  icon,
  title,
  caption,
  trailing,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  caption?: string;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={itemStyles.row}>
      <View style={[itemStyles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <View style={itemStyles.copy}>
        <Text style={[itemStyles.title, { color: colors.foreground }]}>{title}</Text>
        {caption ? <Text style={[itemStyles.caption, { color: colors.mutedForeground }]}>{caption}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

function RequestCard({
  request,
  onApprove,
  onDeny,
}: {
  request: AccessRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const colors = useColors();
  const pending = request.status === 'pending';
  const statusTone = request.status === 'approved' ? 'success' : request.status === 'denied' ? 'danger' : 'warning';
  return (
    <Card>
      <View style={itemStyles.cardTop}>
        <View style={itemStyles.copy}>
          <Text style={[itemStyles.title, { color: colors.foreground }]}>{request.clinicianName}</Text>
          <Text style={[itemStyles.caption, { color: colors.mutedForeground }]}>{request.organization}</Text>
        </View>
        <Badge label={request.status} tone={statusTone} />
      </View>
      <Divider />
      <Text style={[itemStyles.label, { color: colors.mutedForeground }]}>Requested access</Text>
      <View style={itemStyles.scopeWrap}>
        {request.scopes.map((scope) => <Badge key={scope} label={scope} tone="info" />)}
      </View>
      <Text style={[itemStyles.caption, { color: colors.mutedForeground, marginTop: 11 }]}>
        {request.durationMinutes} minute access window · Requested {formatDateTime(request.createdAt)}
      </Text>
      {pending ? (
        <View style={itemStyles.actions}>
          <View style={itemStyles.action}>
            <Button label="Deny" onPress={onDeny} variant="outline" testID={`deny-${request.id}`} />
          </View>
          <View style={itemStyles.action}>
            <Button label="Review & approve" onPress={onApprove} icon="check" testID={`approve-${request.id}`} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function GrantCard({ grant, onRevoke }: { grant: AccessGrant; onRevoke: () => void }) {
  const colors = useColors();
  const remaining = Math.max(0, new Date(grant.expiresAt).getTime() - Date.now());
  const expiresLabel = remaining
    ? `Expires ${formatDateTime(grant.expiresAt)}`
    : 'This grant has expired';
  return (
    <Card>
      <View style={itemStyles.cardTop}>
        <ItemHeading
          icon="user-check"
          title={grant.clinicianName}
          caption={grant.organization}
        />
        <Badge label={remaining > 0 ? 'Active' : 'Expired'} tone={remaining > 0 ? 'success' : 'neutral'} />
      </View>
      <Divider />
      <View style={itemStyles.scopeWrap}>
        {grant.scopes.map((scope) => <Badge key={scope} label={scope} tone="info" />)}
      </View>
      <Text style={[itemStyles.caption, { color: colors.mutedForeground, marginTop: 11 }]}>{expiresLabel}</Text>
      {grant.status === 'active' && remaining > 0 ? (
        <View style={{ marginTop: 15 }}>
          <Button label="Revoke access" icon="slash" onPress={onRevoke} variant="outline" testID={`revoke-${grant.id}`} />
        </View>
      ) : null}
    </Card>
  );
}

export function PatientHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data, error, refresh, isDemoMode, signOut } = useAppContext();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [records, setRecords] = useState<Pick<DemoState, 'conditions' | 'encounters' | 'prescriptions' | 'observations'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profile, patientRecords] = await Promise.all([
        services.patient.getMe(),
        services.patient.getRecords(),
      ]);
      setPatient(profile);
      setRecords(patientRecords);
    } catch (err: unknown) {
      setPatient(null);
      setRecords(null);
      setLoadError(err instanceof Error ? err.message : 'Unable to load health summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [load, refresh]));

  const pendingCount = data?.requests.filter((request) => request.status === 'pending').length ?? 0;
  const activeGrantCount = data?.grants.filter(
    (grant) => grant.status === 'active' && new Date(grant.expiresAt).getTime() > Date.now(),
  ).length ?? 0;

  return (
    <Screen title={patient ? `Good morning, ${patient.name.split(' ')[0]}` : 'Your health overview'} subtitle="Your care, organized around you.">
      {error ? (
        <InfoBanner
          title={isDemoMode ? 'Demo data could not load' : 'Health data could not load'}
          body={error}
          tone="warning"
          icon="alert-circle"
        />
      ) : null}
      {loading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
          <Text style={[itemStyles.caption, { color: colors.mutedForeground, textAlign: 'center', marginTop: 10 }]}>
            Loading your health summary…
          </Text>
        </Card>
      ) : loadError ? (
        <Card style={{ gap: 12 }}>
          <InfoBanner title="Summary Unavailable" body={loadError} tone="warning" icon="alert-circle" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button label="Retry" onPress={() => void load()} icon="refresh-cw" variant="outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Sign out"
                onPress={async () => {
                  await signOut();
                  router.replace('/' as never);
                }}
                variant="secondary"
              />
            </View>
          </View>
        </Card>
      ) : !records ? (
        <Card style={{ gap: 12 }}>
          <Text style={[itemStyles.caption, { color: colors.mutedForeground, textAlign: 'center' }]}>
            No health records found.
          </Text>
          <Button
            label="Sign out / Return to Login"
            onPress={async () => {
              await signOut();
              router.replace('/' as never);
            }}
            variant="outline"
          />
        </Card>
      ) : (
        <>
          <Card style={styles.welcomeCard}>
            <View style={styles.welcomeTop}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Feather name="user" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR CARE PROFILE</Text>
                <Text style={[styles.patientName, { color: colors.foreground }]}>{patient?.name ?? 'Demo patient'}</Text>
                <Text style={[styles.patientMeta, { color: colors.mutedForeground }]}>{patient?.age} years · Blood group {patient?.bloodType}</Text>
              </View>
              <Feather name="shield" size={18} color={colors.success} />
            </View>
            <View style={[styles.trustLine, { backgroundColor: colors.successSurface }]}>
              <Feather name="lock" size={13} color={colors.success} />
              <Text style={[styles.trustText, { color: colors.success }]}>You control who can access your records</Text>
            </View>
          </Card>

          <View style={styles.metricRow}>
            <Card style={styles.metricCard}>
              <Text style={[styles.metric, { color: colors.foreground }]}>{records.conditions.filter((item) => item.status === 'Active').length}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Active conditions</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text style={[styles.metric, { color: colors.foreground }]}>{activeGrantCount}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Active grants</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text style={[styles.metric, { color: colors.foreground }]}>{pendingCount}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Requests</Text>
            </Card>
          </View>

          <SectionTitle title="Quick access" />
          <Card style={styles.quickCard}>
            <Pressable onPress={() => router.push('/(patient)/(tabs)/qr' as never)} testID="patient-open-qr">
              <ItemHeading icon="grid" title="My temporary QR" caption="Share a short-lived token with your clinician" trailing={<Feather name="chevron-right" size={17} color={colors.mutedForeground} />} />
            </Pressable>
            <Divider />
            <Pressable onPress={() => router.push('/(patient)/(tabs)/access' as never)} testID="patient-open-access">
              <ItemHeading icon="shield" title="Review access" caption="Approve requests or revoke a grant" trailing={<Feather name="chevron-right" size={17} color={colors.mutedForeground} />} />
            </Pressable>
            <Divider />
            <Pressable onPress={() => router.push('/(patient)/(tabs)/records' as never)} testID="patient-open-records">
              <ItemHeading icon="file-text" title="Health records" caption="Conditions, visits, prescriptions and observations" trailing={<Feather name="chevron-right" size={17} color={colors.mutedForeground} />} />
            </Pressable>
          </Card>

          <SectionTitle title="Recent encounter" action="All records" onAction={() => router.push('/(patient)/(tabs)/records' as never)} />
          {records.encounters[0] ? (
            <Card>
              <ItemHeading icon="activity" title={records.encounters[0].diagnosis} caption={`${records.encounters[0].reason} · ${formatDate(records.encounters[0].date)}`} />
              <Text style={[itemStyles.caption, { color: colors.mutedForeground, marginLeft: 43, marginTop: 6 }]}>
                {records.encounters[0].clinicianName} · {records.encounters[0].organization}
              </Text>
            </Card>
          ) : <EmptyState title="No encounters yet" description="Your visit history will appear here." />}

          <SectionTitle title="Current conditions" />
          {records.conditions.slice(0, 2).map((condition) => (
            <Card key={condition.id} style={styles.slimCard}>
              <ItemHeading icon="heart" title={condition.name} caption={`Since ${condition.since}`} trailing={<Badge label={condition.status} tone="success" />} />
            </Card>
          ))}
        </>
      )}
      <View style={{ marginTop: 7 }}>
        <Button label={isDemoMode ? 'Refresh demo data' : 'Refresh records'} icon="refresh-cw" variant="quiet" onPress={() => { void load(); void refresh(); }} />
      </View>
    </Screen>
  );
}

export function PatientRecordsScreen() {
  const colors = useColors();
  const { isDemoMode } = useAppContext();
  const [records, setRecords] = useState<Pick<DemoState, 'conditions' | 'encounters' | 'prescriptions' | 'observations'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await services.patient.getRecords());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Records could not be loaded.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen title="My health records" subtitle="A private view of your care, all in one place.">
      {error ? <InfoBanner title="Unable to load records" body={error} tone="warning" icon="alert-circle" /> : null}
      {!records ? <ActivityIndicator color={colors.primary} /> : (
        <>
          {isDemoMode ? <InfoBanner title="Synthetic demo records" body="These examples are created for this demonstration and do not describe a real person." tone="info" icon="file-text" /> : null}
          <SectionTitle title={`Conditions · ${records.conditions.length}`} />
          {records.conditions.length ? records.conditions.map((condition) => <ConditionRow key={condition.id} condition={condition} />) : <EmptyState title="No conditions" description="Conditions added to your profile will appear here." />}
          <SectionTitle title={`Encounters · ${records.encounters.length}`} />
          {records.encounters.length ? records.encounters.map((encounter) => <EncounterRow key={encounter.id} encounter={encounter} />) : <EmptyState title="No visits yet" description="Your visit history will appear here." />}
          <SectionTitle title={`Prescriptions · ${records.prescriptions.length}`} />
          {records.prescriptions.length ? records.prescriptions.map((prescription) => <PrescriptionRow key={prescription.id} prescription={prescription} />) : <EmptyState title="No prescriptions" description="Current prescriptions will appear here." />}
          <SectionTitle title={`Observations · ${records.observations.length}`} />
          {records.observations.length ? records.observations.map((observation) => <ObservationRow key={observation.id} observation={observation} />) : <EmptyState title="No observations" description="Measurements and reports will appear here." />}
        </>
      )}
    </Screen>
  );
}

export function PatientQrScreen() {
  const colors = useColors();
  const [token, setToken] = useState<PatientQrToken | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setToken(await services.patient.getQrToken());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your QR token could not be created.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const expired = token ? new Date(token.expiresAt).getTime() <= now : false;
  return (
    <Screen title="My QR" subtitle="Let your clinician request access without sharing your records first.">
      <InfoBanner
        title="Temporary access token"
        body="This QR contains only an opaque, short-lived token. It never contains your name, patient ID, diagnoses, prescriptions, or other health details."
        icon="shield"
      />
      {error ? <InfoBanner title="QR unavailable" body={error} tone="warning" icon="alert-circle" /> : null}
      <Card style={styles.qrCard}>
        <View style={styles.qrHeader}>
          <Text style={[styles.qrTitle, { color: colors.foreground }]}>Ready to scan</Text>
          <Badge label="Private token" tone="success" />
        </View>
        <View style={[styles.qrFrame, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {token && !expired ? (
            <QRCode value={token.payload} size={202} color={colors.foreground} backgroundColor={colors.card} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Feather name={expired ? 'clock' : 'loader'} size={26} color={colors.mutedForeground} />
            </View>
          )}
        </View>
        <View style={styles.expiryLine}>
          <Feather name={expired ? 'refresh-cw' : 'clock'} size={14} color={expired ? colors.warning : colors.primary} />
          <Text style={[styles.expiryText, { color: expired ? colors.warning : colors.foreground }]}>
            {expired ? 'This QR has expired' : `Refreshes in ${token ? timeLeft(token.expiresAt, now) : '—'}`}
          </Text>
        </View>
        {token && !expired ? (
          <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.secondary, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.mutedForeground }}>
              Token Payload (for emulator/browser manual entry):
            </Text>
            <Text selectable style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.foreground, marginTop: 2 }}>
              {token.payload}
            </Text>
          </View>
        ) : null}
        {expired ? <Button label="Create a new QR" icon="refresh-cw" onPress={() => void load()} /> : null}
        <Text style={[styles.qrFootnote, { color: colors.mutedForeground }]}>
          Only scan this with a clinician who is with you. Scanning creates a request; your records stay private until you approve it.
        </Text>
      </Card>
      <View style={[styles.tokenStatus, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={14} color={colors.primary} />
        <Text style={[styles.tokenStatusText, { color: colors.secondaryForeground }]}>The token expires after 60 seconds</Text>
      </View>
    </Screen>
  );
}

type AccessTab = 'requests' | 'grants' | 'history';

export function PatientAccessScreen() {
  const colors = useColors();
  const { data, refresh } = useAppContext();
  const [activeTab, setActiveTab] = useState<AccessTab>('requests');
  const [selection, setSelection] = useState<
    | { kind: 'approve'; request: AccessRequest }
    | { kind: 'deny'; request: AccessRequest }
    | { kind: 'revoke'; grant: AccessGrant }
    | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useFocusEffect(useCallback(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 2500);
    return () => clearInterval(interval);
  }, [refresh]));

  const requests = data?.requests ?? [];
  const grants = data?.grants ?? [];
  const activeGrants = useMemo(
    () => grants.filter((grant) => grant.status === 'active' && new Date(grant.expiresAt).getTime() > Date.now()),
    [grants],
  );
  const history = data?.history ?? [];

  const performDecision = async () => {
    if (!selection || selection.kind === 'revoke') return;
    setWorking(true);
    setActionError(null);
    try {
      await services.patient.decideAccessRequest(selection.request.id, selection.kind === 'approve' ? 'approved' : 'denied');
      setSelection(null);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The request could not be updated.');
    } finally {
      setWorking(false);
    }
  };

  const performRevoke = async () => {
    if (!selection || selection.kind !== 'revoke') return;
    setWorking(true);
    setActionError(null);
    try {
      await services.patient.revokeGrant(selection.grant.id);
      setSelection(null);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Access could not be revoked.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen title="Access & consent" subtitle="You decide who can see each part of your health record.">
      <InfoBanner
        title="Your consent is required"
        body="A QR scan only creates a request. Records remain unavailable until you approve an access grant."
        icon="shield"
      />
      {actionError ? <InfoBanner title="Action not completed" body={actionError} tone="warning" icon="alert-circle" /> : null}
      <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
        {([
          ['requests', `Requests${requests.filter((request) => request.status === 'pending').length ? ` · ${requests.filter((request) => request.status === 'pending').length}` : ''}`],
          ['grants', `Grants · ${activeGrants.length}`],
          ['history', 'History'],
        ] as [AccessTab, string][]).map(([tab, label]) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { backgroundColor: colors.card }]}
            testID={`access-tab-${tab}`}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {activeTab === 'requests' ? (
        requests.length ? (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={() => setSelection({ kind: 'approve', request })}
              onDeny={() => setSelection({ kind: 'deny', request })}
            />
          ))
        ) : <EmptyState icon="shield" title="No access requests" description="When a clinician requests access, you can review the requested records and duration here." />
      ) : null}
      {activeTab === 'grants' ? (
        activeGrants.length ? (
          activeGrants.map((grant) => <GrantCard key={grant.id} grant={grant} onRevoke={() => setSelection({ kind: 'revoke', grant })} />)
        ) : <EmptyState icon="user-check" title="No active grants" description="Only clinicians you approve can access the records listed in their grant." />
      ) : null}
      {activeTab === 'history' ? (
        history.length ? (
          history.map((entry) => <HistoryCard key={entry.id} entry={entry} />)
        ) : <EmptyState icon="clock" title="No access history" description="Approved record activity and consent changes will be listed here." />
      ) : null}
      <ConfirmDialog
        visible={selection?.kind === 'approve'}
        title="Approve this request?"
        description={
          selection?.kind === 'approve'
            ? `${selection.request.clinicianName} at ${selection.request.organization} will have access to ${selection.request.scopes.join(', ').toLowerCase()} for ${selection.request.durationMinutes} minutes. You can revoke access at any time.`
            : ''
        }
        confirmLabel={working ? 'Saving…' : 'Approve access'}
        onConfirm={() => void performDecision()}
        onCancel={() => setSelection(null)}
      />
      <ConfirmDialog
        visible={selection?.kind === 'deny'}
        title="Deny this request?"
        description={selection?.kind === 'deny' ? `${selection.request.clinicianName} will not be able to view your records from this request.` : ''}
        confirmLabel={working ? 'Saving…' : 'Deny request'}
        destructive
        onConfirm={() => void performDecision()}
        onCancel={() => setSelection(null)}
      />
      <ConfirmDialog
        visible={selection?.kind === 'revoke'}
        title="Revoke access now?"
        description={selection?.kind === 'revoke' ? `${selection.grant.clinicianName} will immediately lose access to the records in this grant.` : ''}
        confirmLabel={working ? 'Revoking…' : 'Revoke access'}
        destructive
        onConfirm={() => void performRevoke()}
        onCancel={() => setSelection(null)}
      />
    </Screen>
  );
}

function ConditionRow({ condition }: { condition: Condition }) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <ItemHeading icon="heart" title={condition.name} caption={`Since ${condition.since}`} trailing={<Badge label={condition.status} tone={condition.status === 'Active' ? 'success' : 'neutral'} />} />
      <Text style={[itemStyles.note, { color: colors.mutedForeground }]}>{condition.note}</Text>
    </Card>
  );
}

function EncounterRow({ encounter }: { encounter: Encounter }) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <ItemHeading icon="activity" title={encounter.diagnosis} caption={formatDate(encounter.date)} />
      <Text style={[itemStyles.note, { color: colors.foreground }]}>{encounter.reason}</Text>
      <Text style={[itemStyles.caption, { color: colors.mutedForeground }]}>{encounter.clinicianName} · {encounter.organization}</Text>
    </Card>
  );
}

function PrescriptionRow({ prescription }: { prescription: Prescription }) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <ItemHeading icon="clipboard" title={prescription.drug} caption={`${prescription.dose} · ${prescription.frequency}`} />
      <Text style={[itemStyles.caption, { color: colors.mutedForeground, marginLeft: 43 }]}>
        {formatDate(prescription.start)} – {formatDate(prescription.end)} · {prescription.clinicianName}
      </Text>
    </Card>
  );
}

function ObservationRow({ observation }: { observation: Observation }) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <ItemHeading icon="trending-up" title={observation.title} caption={`${formatDate(observation.date)} · ${observation.clinicianName}`} trailing={<Text style={[styles.observationValue, { color: colors.foreground }]}>{observation.value} <Text style={styles.observationUnit}>{observation.unit}</Text></Text>} />
    </Card>
  );
}

function HistoryCard({ entry }: { entry: AccessHistoryEntry }) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <ItemHeading icon="clock" title={entry.action} caption={formatDateTime(entry.occurredAt)} />
      <Text style={[itemStyles.note, { color: colors.foreground }]}>{entry.actor} · {entry.organization}</Text>
      <Text style={[itemStyles.caption, { color: colors.mutedForeground }]}>{entry.detail}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  welcomeCard: { padding: 16 },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 47, height: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.8, marginBottom: 4 },
  patientName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  patientMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  trustLine: { marginTop: 15, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  trustText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  metricCard: { flex: 1, marginBottom: 0, padding: 13, minHeight: 82, justifyContent: 'center' },
  metric: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  metricLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, lineHeight: 14, marginTop: 4 },
  quickCard: { paddingVertical: 7 },
  slimCard: { paddingVertical: 14 },
  recordCard: { paddingVertical: 14 },
  qrCard: { alignItems: 'center', padding: 19 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 17 },
  qrTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  qrFrame: { borderWidth: 1, borderRadius: 19, padding: 13 },
  qrPlaceholder: { width: 202, height: 202, alignItems: 'center', justifyContent: 'center' },
  expiryLine: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 17 },
  expiryText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  qrFootnote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14, maxWidth: 300 },
  tokenStatus: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  tokenStatusText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  tabs: { flexDirection: 'row', gap: 3, padding: 4, borderRadius: 14, marginBottom: 16 },
  tab: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, textAlign: 'center' },
  observationValue: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  observationUnit: { fontFamily: 'Inter_400Regular', fontSize: 10 },
});

const itemStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 9 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginBottom: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  scopeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  action: { flex: 1 },
});