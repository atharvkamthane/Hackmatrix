import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoBanner,
  Screen,
  SectionTitle,
} from '@/src/components/ui';
import { useAppContext } from '@/src/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { services } from '@/src/services';
import type {
  AccessRequest,
  AuthorizedPatient,
  Encounter,
  Observation,
  Prescription,
} from '@/src/types/models';
import { formatDate, formatDateTime, isValidDate } from '@/src/utils/format';

const DEMO_PATIENT_ID = 'patient-demo-01';
const CLINICIAN_ID = 'clinician-demo-01';

function RecordLine({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.recordLine}>
      <View style={[styles.recordIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recordTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.recordSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ValidationMessage({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.validation, { color: colors.destructive }]}>{children}</Text>;
}

function RequestStatusCard({ request, onOpen }: { request: AccessRequest; onOpen: () => void }) {
  const statusTone = request.status === 'approved' ? 'success' : request.status === 'denied' ? 'danger' : 'warning';
  const colors = useColors();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" testID={`open-request-${request.id}`}>
      <Card>
        <View style={styles.requestHead}>
          <View style={[styles.recordIcon, { backgroundColor: colors.infoSurface }]}>
            <Feather name="shield" size={15} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.recordTitle, { color: colors.foreground }]}>Patient consent request</Text>
            <Text style={[styles.recordSub, { color: colors.mutedForeground }]}>Requested {formatDateTime(request.createdAt)}</Text>
          </View>
          <Badge label={request.status} tone={statusTone} />
        </View>
        <Text style={[styles.recordSub, { color: colors.mutedForeground, marginTop: 12 }]}>
          {request.scopes.join(' · ')} · {request.durationMinutes} min
        </Text>
      </Card>
    </Pressable>
  );
}

export function ClinicianHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data, refresh } = useAppContext();
  const [authorized, setAuthorized] = useState<AuthorizedPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAuthorized(await services.clinician.getAuthorizedPatient(DEMO_PATIENT_ID));
      setError(null);
    } catch (cause) {
      setAuthorized(null);
      setError(cause instanceof Error ? cause.message : 'Authorized patients could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); void refresh(); }, [load, refresh]));

  const myRequests = useMemo(
    () => (data?.requests ?? []).filter((request) => request.clinicianId === CLINICIAN_ID),
    [data?.requests],
  );
  const pending = myRequests.find((request) => request.status === 'pending');

  return (
    <Screen title="Good morning, Dr. Chen" subtitle="Your clinical workspace, with patient consent at the center.">
      <Card style={styles.clinicianHero}>
        <View style={[styles.clinicianHeroIcon, { backgroundColor: colors.infoSurface }]}>
          <Feather name="briefcase" size={19} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Harbor Health Clinic</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Clinician demo workspace</Text>
        </View>
        <Badge label="Secure demo" tone="success" />
      </Card>

      <Pressable onPress={() => router.push('/(clinician)/(tabs)/scanner' as never)} testID="start-qr-scan">
        <Card style={[styles.scanCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={[styles.scanIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Feather name="maximize" size={20} color={colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanTitle, { color: colors.primaryForeground }]}>Scan patient QR</Text>
            <Text style={[styles.scanSubtitle, { color: colors.primaryForeground }]}>Create an access request — not a record lookup</Text>
          </View>
          <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
        </Card>
      </Pressable>

      <SectionTitle title="Authorized patients" />
      {loading ? (
        <Card><ActivityIndicator color={colors.primary} /></Card>
      ) : error ? (
        <InfoBanner title="Patient list unavailable" body={error} tone="warning" icon="alert-circle" />
      ) : authorized ? (
        <Pressable onPress={() => router.push('/(clinician)/patient' as never)} testID="open-authorized-patient">
          <Card>
            <RecordLine icon="user-check" title={authorized.patient.name} subtitle={`Authorized until ${formatDateTime(authorized.grant.expiresAt)}`} />
            <View style={styles.inlineBottom}>
              <Badge label="Active patient grant" tone="success" />
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </View>
          </Card>
        </Pressable>
      ) : (
        <EmptyState
          icon="users"
          title="No active patient access"
          description="Patients appear here only after they approve a time-limited access grant."
        />
      )}

      <SectionTitle title="Recent access requests" action="All requests" onAction={() => router.push('/(clinician)/(tabs)/patients' as never)} />
      {pending ? (
        <RequestStatusCard request={pending} onOpen={() => router.push({ pathname: '/(clinician)/waiting' as never, params: { id: pending.id } })} />
      ) : (
        <Card>
          <RecordLine icon="clock" title="No pending approvals" subtitle="Requests appear here while the patient is deciding." />
        </Card>
      )}
      <InfoBanner title="Access is never automatic" body="A QR scan cannot reveal records. An active grant and the requested scopes are checked again before every demo record action." icon="lock" />
    </Screen>
  );
}

export function ClinicianScannerScreen() {
  const colors = useColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRequest = async (opaqueToken: string) => {
    if (busy || hasScanned) return;
    setBusy(true);
    setHasScanned(true);
    setError(null);
    try {
      const request = await services.clinician.resolveQrToken(opaqueToken);
      router.replace({ pathname: '/(clinician)/waiting' as never, params: { id: request.id } });
    } catch (cause) {
      setHasScanned(false);
      setError(cause instanceof Error ? cause.message : 'The QR token could not be resolved.');
    } finally {
      setBusy(false);
    }
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    void createRequest(result.data);
  };

  const simulateScan = async () => {
    setBusy(true);
    setError(null);
    try {
      const patientToken = await services.clinician.getDemoPatientQrToken();
      setHasScanned(false);
      await createRequest(patientToken.payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The demo scan could not be completed.');
      setBusy(false);
    }
  };

  const resetScanner = () => {
    setHasScanned(false);
    setError(null);
  };

  return (
    <Screen title="Scan patient QR" subtitle="Scanning sends an opaque token to create an access request.">
      <InfoBanner
        title="Scanning does not show records"
        body="The QR is only a temporary token. Patient details stay hidden until the patient approves your requested access."
        icon="shield"
      />
      {error ? <InfoBanner title="Could not scan this code" body={error} tone="warning" icon="alert-circle" /> : null}
      {!permission ? (
        <Card><ActivityIndicator color={colors.primary} /></Card>
      ) : !permission.granted ? (
        <Card style={styles.permissionCard}>
          <View style={[styles.scanIllustration, { backgroundColor: colors.secondary }]}>
            <Feather name="camera" size={25} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Camera access needed</Text>
          <Text style={[styles.recordSub, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Allow camera access to scan a patient’s temporary QR token. The token is submitted to the demo service only.
          </Text>
          <Button label="Enable camera" icon="camera" onPress={() => void requestPermission()} />
          {permission.status === 'denied' && !permission.canAskAgain && Platform.OS !== 'web' ? (
            <Text style={[styles.recordSub, { color: colors.warning, textAlign: 'center' }]}>Camera permission is blocked in device settings. You can still use the demo scan below.</Text>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.cameraCard}>
          <View style={[styles.cameraFrame, { backgroundColor: colors.foreground }]}>
            <CameraView
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.foreground }]}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={hasScanned ? undefined : onBarcodeScanned}
            />
            <View pointerEvents="none" style={styles.scanGuide}>
              <View style={[styles.corner, styles.topLeft, { borderColor: colors.primaryForeground }]} />
              <View style={[styles.corner, styles.topRight, { borderColor: colors.primaryForeground }]} />
              <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primaryForeground }]} />
              <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primaryForeground }]} />
              <Text style={[styles.scanHint, { color: colors.primaryForeground }]}>Align the patient QR inside the frame</Text>
            </View>
            {busy ? <View style={styles.cameraBusy}><ActivityIndicator color={colors.primaryForeground} /></View> : null}
          </View>
          {hasScanned && !busy ? <Button label="Scan again" icon="refresh-cw" onPress={resetScanner} variant="secondary" /> : null}
        </Card>
      )}
      <Button label="Run demo scan" icon="grid" onPress={() => void simulateScan()} loading={busy} variant="outline" testID="simulate-qr-scan" />
      <Text style={[styles.centerNote, { color: colors.mutedForeground }]}>Camera scans resolve against this device’s local demo data. Use Run demo scan for the complete one-device consent flow; cross-device sharing needs the team API.</Text>
    </Screen>
  );
}

export function ClinicianPatientsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data, refresh } = useAppContext();
  const [authorized, setAuthorized] = useState<AuthorizedPatient | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAuthorized(await services.clinician.getAuthorizedPatient(DEMO_PATIENT_ID));
    } catch {
      setAuthorized(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); void refresh(); }, [load, refresh]));

  const myRequests = (data?.requests ?? []).filter((request) => request.clinicianId === CLINICIAN_ID);
  return (
    <Screen title="Patients & requests" subtitle="Only patients with a valid grant can be opened.">
      {loading ? <Card><ActivityIndicator color={colors.primary} /></Card> : authorized ? (
        <Pressable onPress={() => router.push('/(clinician)/patient' as never)} testID="authorized-patient-row">
          <Card>
            <RecordLine icon="user-check" title={authorized.patient.name} subtitle={authorized.patient.bloodType} />
            <View style={styles.inlineBottom}><Badge label="Time-limited access" tone="success" /><Text style={[styles.recordSub, { color: colors.mutedForeground }]}>{formatDateTime(authorized.grant.expiresAt)}</Text></View>
          </Card>
        </Pressable>
      ) : (
        <EmptyState icon="users" title="No authorized patients" description="A patient will appear after approving an access request. Scanning alone never creates record access." />
      )}
      <SectionTitle title="Your requests" />
      {myRequests.length ? myRequests.map((request) => (
        <RequestStatusCard
          key={request.id}
          request={request}
          onOpen={() => router.push({ pathname: '/(clinician)/waiting' as never, params: { id: request.id } })}
        />
      )) : <EmptyState icon="clock" title="No requests yet" description="Scan a patient’s temporary QR to request scoped access." />}
      <Button label="Scan a patient QR" icon="maximize" onPress={() => router.push('/(clinician)/(tabs)/scanner' as never)} />
    </Screen>
  );
}

export function ClinicianWaitingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut } = useAppContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === 'string' ? params.id : '';
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!requestId) {
      setError('This access request could not be found.');
      setLoading(false);
      return;
    }
    try {
      const next = await services.clinician.getAccessRequest(requestId);
      setRequest(next);
      setError(next ? null : 'This access request could not be found.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request status could not be checked.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 2500);
    return () => clearInterval(interval);
  }, [load]);

  const openAuthorizedView = () => router.replace('/(clinician)/patient' as never);
  return (
    <Screen title="Patient approval" subtitle="A patient must approve this request before you can access any records." back>
      {loading ? <Card><ActivityIndicator color={colors.primary} /></Card> : error ? (
        <InfoBanner title="Request unavailable" body={error} tone="warning" icon="alert-circle" />
      ) : request ? (
        <>
          <Card style={styles.waitingCard}>
            <View style={[styles.waitIcon, { backgroundColor: request.status === 'approved' ? colors.successSurface : request.status === 'denied' ? colors.warningSurface : colors.infoSurface }]}>
              <Feather
                name={request.status === 'approved' ? 'check' : request.status === 'denied' ? 'slash' : 'clock'}
                size={23}
                color={request.status === 'approved' ? colors.success : request.status === 'denied' ? colors.warning : colors.info}
              />
            </View>
            <Badge
              label={request.status === 'pending' ? 'Awaiting patient' : request.status}
              tone={request.status === 'approved' ? 'success' : request.status === 'denied' ? 'danger' : 'warning'}
            />
            <Text style={[styles.waitTitle, { color: colors.foreground }]}>
              {request.status === 'pending' ? 'Waiting for patient approval' : request.status === 'approved' ? 'Access approved' : 'Request denied'}
            </Text>
            <Text style={[styles.waitCopy, { color: colors.mutedForeground }]}>
              {request.status === 'pending'
                ? 'Your request is with the patient. No patient identity or health details are available while consent is pending.'
                : request.status === 'approved'
                  ? 'The patient approved a time-limited grant. Re-checking the grant before loading their records…'
                  : 'The patient did not approve this request. No records were disclosed.'}
            </Text>
            <View style={[styles.requestInfo, { backgroundColor: colors.background }]}>
              <View style={styles.requestInfoRow}><Text style={[styles.recordSub, { color: colors.mutedForeground }]}>Requested by</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{request.clinicianName}</Text></View>
              <View style={styles.requestInfoRow}><Text style={[styles.recordSub, { color: colors.mutedForeground }]}>Organization</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{request.organization}</Text></View>
              <View style={styles.requestInfoRow}><Text style={[styles.recordSub, { color: colors.mutedForeground }]}>Duration</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{request.durationMinutes} minutes</Text></View>
              <View style={styles.requestInfoRow}><Text style={[styles.recordSub, { color: colors.mutedForeground }]}>Scopes</Text><Text style={[styles.infoValue, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>{request.scopes.join(', ')}</Text></View>
            </View>
          </Card>
          {request.status === 'approved' ? (
            <Button label="Open authorized patient" icon="user-check" onPress={openAuthorizedView} testID="open-approved-patient" />
          ) : request.status === 'pending' ? (
            <>
              <InfoBanner title="Demo consent step" body="Switch to the patient role on this device and approve or deny the request in Access & consent. This button never approves on the clinician’s behalf." icon="repeat" />
              <Button
                label="Sign out"
                icon="log-out"
                onPress={async () => {
                  await signOut();
                  router.replace('/' as never);
                }}
                variant="secondary"
              />
            </>
          ) : (
            <Button label="Return to clinician home" icon="home" onPress={() => router.replace('/(clinician)/(tabs)' as never)} variant="outline" />
          )}
        </>
      ) : null}
    </Screen>
  );
}

export function AuthorizedPatientScreen() {
  const colors = useColors();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<AuthorizedPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await services.clinician.getAuthorizedPatient(DEMO_PATIENT_ID);
      setAuthorized(next);
      setError(null);
    } catch (cause) {
      setAuthorized(null);
      setError(cause instanceof Error ? cause.message : 'Access could not be verified.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen title="Authorized patient" subtitle="Records are shown only while this grant is valid." back>
      {loading ? <Card><ActivityIndicator color={colors.primary} /></Card> : error ? (
        <>
          <InfoBanner title="Access check failed" body={error} tone="warning" icon="alert-circle" />
          <Button label="Return to patients" icon="arrow-left" onPress={() => router.replace('/(clinician)/(tabs)/patients' as never)} variant="outline" />
        </>
      ) : !authorized ? (
        <>
          <EmptyState icon="lock" title="Patient records are unavailable" description="There is no valid, active grant for this patient. A QR scan by itself never allows access." />
          <Button label="Return to patients" icon="arrow-left" onPress={() => router.replace('/(clinician)/(tabs)/patients' as never)} variant="outline" />
        </>
      ) : (
        <>
          <InfoBanner
            title="Patient-approved access"
            body={`This grant expires ${formatDateTime(authorized.grant.expiresAt)}. Record access is limited to the scopes below and may be revoked at any time.`}
            tone="success"
            icon="shield"
          />
          <Card>
            <RecordLine icon="user" title={authorized.patient.name} subtitle={`${authorized.patient.age} years · Blood group ${authorized.patient.bloodType}`} />
            <View style={[styles.scopeRow, { marginTop: 12 }]}>
              {authorized.grant.scopes.map((scope) => <Badge key={scope} label={scope} tone="success" />)}
            </View>
          </Card>
          <SectionTitle title="Patient timeline" />
          {[...authorized.encounters]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((entry) => <Card key={entry.id}><RecordLine icon="activity" title={entry.diagnosis} subtitle={`${formatDate(entry.date)} · ${entry.reason}`} /></Card>)}
          {authorized.conditions.length ? (
            <>
              <SectionTitle title="Conditions" />
              {authorized.conditions.map((condition) => (
                <Card key={condition.id}><RecordLine icon="heart" title={condition.name} subtitle={`${condition.status} · Since ${condition.since}`} /></Card>
              ))}
            </>
          ) : null}
          {authorized.prescriptions.length ? (
            <>
              <SectionTitle title="Prescriptions" />
              {authorized.prescriptions.map((entry) => (
                <Card key={entry.id}><RecordLine icon="clipboard" title={entry.drug} subtitle={`${entry.dose} · ${entry.frequency} · Ends ${formatDate(entry.end)}`} /></Card>
              ))}
            </>
          ) : null}
          {authorized.observations.length ? (
            <>
              <SectionTitle title="Observations" />
              {authorized.observations.map((entry) => (
                <Card key={entry.id}><RecordLine icon="trending-up" title={`${entry.title}: ${entry.value} ${entry.unit}`} subtitle={formatDate(entry.date)} /></Card>
              ))}
            </>
          ) : null}
          <SectionTitle title="Document a visit" />
          <Card style={styles.actionList}>
            <Button label="Create encounter" icon="file-plus" onPress={() => router.push('/(clinician)/encounter' as never)} variant="outline" />
            <Button label="Create prescription" icon="clipboard" onPress={() => router.push('/(clinician)/prescription' as never)} variant="outline" />
            <Button label="Add observation" icon="activity" onPress={() => router.push('/(clinician)/observation' as never)} variant="outline" />
          </Card>
        </>
      )}
    </Screen>
  );
}

function AuthorizedForm({
  title,
  subtitle,
  onSave,
  children,
}: {
  title: string;
  subtitle: string;
  onSave: () => Promise<void>;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    services.clinician.getAuthorizedPatient(DEMO_PATIENT_ID)
      .then((result) => setAuthorized(Boolean(result)))
      .catch(() => setAuthorized(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave();
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title={title} subtitle={subtitle} back>
      {authorized === null ? <Card><ActivityIndicator color={colors.primary} /></Card> : !authorized ? (
        <>
          <EmptyState icon="lock" title="Valid patient access required" description="The patient must have an active grant before you can create or update clinical records." />
          <Button label="Return to authorized patient" icon="arrow-left" onPress={() => router.replace('/(clinician)/patient' as never)} variant="outline" />
        </>
      ) : (
        <>
          <InfoBanner title="Grant verified" body="Access is re-checked by the mock service when you save. The server must enforce this again in production." tone="success" icon="shield" />
          {error ? <InfoBanner title="Could not save" body={error} tone="warning" icon="alert-circle" /> : null}
          <Card>{children}</Card>
          <Button label="Save record" icon="check" onPress={() => void save()} loading={saving} testID="save-clinical-record" />
        </>
      )}
    </Screen>
  );
}

export function CreateEncounterScreen() {
  const [diagnosis, setDiagnosis] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validation, setValidation] = useState('');
  const save = async () => {
    if (!diagnosis.trim() || !reason.trim() || !isValidDate(date)) {
      setValidation('Add a diagnosis, reason, and valid date in YYYY-MM-DD format.');
      throw new Error('Please complete all encounter fields with a valid date.');
    }
    setValidation('');
    await services.clinician.createEncounter({ diagnosis: diagnosis.trim(), reason: reason.trim(), date });
  };
  return (
    <AuthorizedForm title="Create encounter" subtitle="Document the patient visit within the approved grant." onSave={save}>
      <Field label="Diagnosis" placeholder="e.g. Routine follow-up" value={diagnosis} onChangeText={setDiagnosis} error={validation && !diagnosis.trim() ? 'Diagnosis is required.' : undefined} testID="encounter-diagnosis" />
      <Field label="Reason for visit" placeholder="What brought the patient in?" value={reason} onChangeText={setReason} />
      <Field label="Date" value={date} onChangeText={setDate} hint="Use YYYY-MM-DD" />
      {validation ? <ValidationMessage>{validation}</ValidationMessage> : null}
    </AuthorizedForm>
  );
}

export function CreatePrescriptionScreen() {
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState('');
  const [validation, setValidation] = useState('');
  const save = async () => {
    if (!drug.trim() || !dose.trim() || !frequency.trim() || !isValidDate(start) || !isValidDate(end) || end < start) {
      setValidation('Complete each field. Enter valid dates and make sure the end date is on or after the start date.');
      throw new Error('Please review the prescription details.');
    }
    setValidation('');
    await services.clinician.createPrescription({
      drug: drug.trim(),
      dose: dose.trim(),
      frequency: frequency.trim(),
      start,
      end,
    });
  };
  return (
    <AuthorizedForm title="Create prescription" subtitle="Add a medication to the patient record." onSave={save}>
      <Field label="Drug" placeholder="Medication name" value={drug} onChangeText={setDrug} />
      <Field label="Dose" placeholder="e.g. 10 mg" value={dose} onChangeText={setDose} />
      <Field label="Frequency" placeholder="e.g. Once daily" value={frequency} onChangeText={setFrequency} />
      <Field label="Start date" value={start} onChangeText={setStart} hint="Use YYYY-MM-DD" />
      <Field label="End date" value={end} onChangeText={setEnd} hint="Use YYYY-MM-DD" />
      {validation ? <ValidationMessage>{validation}</ValidationMessage> : null}
    </AuthorizedForm>
  );
}

export function CreateObservationScreen() {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validation, setValidation] = useState('');
  const save = async () => {
    if (!title.trim() || !value.trim() || !isValidDate(date)) {
      setValidation('Add a measurement, value, and valid date.');
      throw new Error('Please complete the observation details.');
    }
    setValidation('');
    await services.clinician.createObservation({ title: title.trim(), value: value.trim(), unit: unit.trim(), date });
  };
  return (
    <AuthorizedForm title="Add observation" subtitle="Record a measurement or clinical observation." onSave={save}>
      <Field label="Observation" placeholder="e.g. Blood pressure" value={title} onChangeText={setTitle} />
      <Field label="Value" placeholder="e.g. 118/76" value={value} onChangeText={setValue} />
      <Field label="Unit" placeholder="e.g. mmHg (optional)" value={unit} onChangeText={setUnit} />
      <Field label="Date" value={date} onChangeText={setDate} hint="Use YYYY-MM-DD" />
      {validation ? <ValidationMessage>{validation}</ValidationMessage> : null}
    </AuthorizedForm>
  );
}

const styles = StyleSheet.create({
  clinicianHero: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
  clinicianHeroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  scanCard: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginTop: 4 },
  scanIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  scanSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 5, opacity: 0.88 },
  recordLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recordTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  recordSub: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
  inlineBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 },
  requestHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  permissionCard: { alignItems: 'center', gap: 12, padding: 21 },
  scanIllustration: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center' },
  cameraCard: { padding: 10 },
  cameraFrame: { width: '100%', height: 335, borderRadius: 14, overflow: 'hidden', marginBottom: 11 },
  scanGuide: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  corner: { width: 38, height: 38, position: 'absolute', borderWidth: 3 },
  topLeft: { top: '24%', left: '15%', borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 9 },
  topRight: { top: '24%', right: '15%', borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 9 },
  bottomLeft: { bottom: '24%', left: '15%', borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 9 },
  bottomRight: { bottom: '24%', right: '15%', borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 9 },
  scanHint: { position: 'absolute', bottom: '16%', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cameraBusy: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12, 28, 25, 0.36)', justifyContent: 'center', alignItems: 'center' },
  centerNote: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 16, marginTop: 11 },
  waitingCard: { alignItems: 'center', padding: 21 },
  waitIcon: { width: 53, height: 53, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  waitTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26, textAlign: 'center', marginTop: 12 },
  waitCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  requestInfo: { alignSelf: 'stretch', borderRadius: 13, marginTop: 18, padding: 13, gap: 10 },
  requestInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  infoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionList: { gap: 9 },
  validation: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, marginTop: -5, marginBottom: 11 },
});
