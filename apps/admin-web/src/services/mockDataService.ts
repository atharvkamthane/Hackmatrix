import {
  AdminSummaryDTO,
  TrendsResponseDTO,
  RegionsResponseDTO,
  PrivacyConfigDTO,
  AuditResponseDTO,
  SecurityResponseDTO,
  TrendsQueryFilters,
} from '../types/api';

export const MOCK_SUMMARY: AdminSummaryDTO = {
  kpi: {
    totalReportedCases: { suppressed: false, count: 18450 },
    monitoredConditionsCount: 14,
    coveredRegionsCount: 28,
    lastUpdated: new Date().toISOString(),
    isDemoData: true,
  },
  monthlyTrends: [
    {
      month: '2026-05',
      label: 'May 2026',
      Respiratory: { suppressed: false, count: 1240 },
      VectorBorne: { suppressed: false, count: 430 },
      Waterborne: { suppressed: false, count: 210 },
      Zoonotic: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
    },
    {
      month: '2026-06',
      label: 'Jun 2026',
      Respiratory: { suppressed: false, count: 1450 },
      VectorBorne: { suppressed: false, count: 680 },
      Waterborne: { suppressed: false, count: 340 },
      Zoonotic: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
    },
    {
      month: '2026-07',
      label: 'Jul 2026',
      Respiratory: { suppressed: false, count: 1890 },
      VectorBorne: { suppressed: false, count: 910 },
      Waterborne: { suppressed: false, count: 520 },
      Zoonotic: { suppressed: false, count: 18 },
    },
    {
      month: '2026-08',
      label: 'Aug 2026',
      Respiratory: { suppressed: false, count: 2150 },
      VectorBorne: { suppressed: false, count: 1340 },
      Waterborne: { suppressed: false, count: 680 },
      Zoonotic: { suppressed: false, count: 24 },
    },
    {
      month: '2026-09',
      label: 'Sep 2026',
      Respiratory: { suppressed: false, count: 1780 },
      VectorBorne: { suppressed: false, count: 1120 },
      Waterborne: { suppressed: false, count: 490 },
      Zoonotic: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
    },
    {
      month: '2026-10',
      label: 'Oct 2026',
      Respiratory: { suppressed: false, count: 1940 },
      VectorBorne: { suppressed: false, count: 860 },
      Waterborne: { suppressed: false, count: 390 },
      Zoonotic: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
    },
  ],
  conditionDistribution: [
    { category: 'Respiratory', displayName: 'Acute Respiratory Infections', value: { suppressed: false, count: 10450 } },
    { category: 'VectorBorne', displayName: 'Vector-Borne Diseases', value: { suppressed: false, count: 5340 } },
    { category: 'Waterborne', displayName: 'Waterborne & Diarrheal', value: { suppressed: false, count: 2630 } },
    { category: 'Zoonotic', displayName: 'Zoonotic Infections', value: { suppressed: true, reason: 'BELOW_K_THRESHOLD' } },
  ],
  regionalOverview: [
    { regionId: 'reg_mh', stateName: 'Maharashtra', districtName: 'Pune District', cases: { suppressed: false, count: 3420 }, riskLevel: 'MODERATE', lastReported: '2026-10-08T14:30:00Z' },
    { regionId: 'reg_dl', stateName: 'Delhi NCR', districtName: 'Central Delhi', cases: { suppressed: false, count: 4890 }, riskLevel: 'ELEVATED', lastReported: '2026-10-09T01:15:00Z' },
    { regionId: 'reg_ka', stateName: 'Karnataka', districtName: 'Bengaluru Urban', cases: { suppressed: false, count: 2150 }, riskLevel: 'LOW', lastReported: '2026-10-08T19:00:00Z' },
    { regionId: 'reg_tn', stateName: 'Tamil Nadu', districtName: 'Chennai North', cases: { suppressed: false, count: 1840 }, riskLevel: 'MODERATE', lastReported: '2026-10-08T22:45:00Z' },
    { regionId: 'reg_ga', stateName: 'Goa', districtName: 'South Goa', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' }, riskLevel: 'LOW', lastReported: '2026-10-07T11:00:00Z' },
  ],
  recentActivity: [
    { id: 'evt_001', timestamp: '2026-10-09T07:45:00Z', title: 'Aggregate Data Sync', description: 'Weekly regional aggregate surveillance dataset refreshed.', severity: 'info', category: 'SURVEILLANCE' },
    { id: 'evt_002', timestamp: '2026-10-09T06:12:00Z', title: 'K=10 Suppression Applied', description: '3 district-level clusters suppressed below threshold.', severity: 'warning', category: 'PRIVACY' },
    { id: 'evt_003', timestamp: '2026-10-08T23:50:00Z', title: 'Socket Channel Active', description: 'Live aggregate updates stream established.', severity: 'info', category: 'SOCKET' },
  ],
};

export const MOCK_TRENDS = (filters: TrendsQueryFilters = {}): TrendsResponseDTO => {
  return {
    filters,
    monthlyData: [
      { month: '2026-05', label: 'May 2026', cases: { suppressed: false, count: 1880 }, condition: filters.condition || 'All Conditions' },
      { month: '2026-06', label: 'Jun 2026', cases: { suppressed: false, count: 2470 }, condition: filters.condition || 'All Conditions' },
      { month: '2026-07', label: 'Jul 2026', cases: { suppressed: false, count: 3340 }, condition: filters.condition || 'All Conditions' },
      { month: '2026-08', label: 'Aug 2026', cases: { suppressed: false, count: 4190 }, condition: filters.condition || 'All Conditions' },
      { month: '2026-09', label: 'Sep 2026', cases: { suppressed: false, count: 3390 }, condition: filters.condition || 'All Conditions' },
      { month: '2026-10', label: 'Oct 2026', cases: { suppressed: false, count: 3190 }, condition: filters.condition || 'All Conditions' },
    ],
    summary: {
      totalMonthsAnalyzed: 6,
      peakMonth: '2026-08',
      suppressedGroupCount: 4,
      visibleGroupCount: 24,
    },
  };
};

export const MOCK_REGIONS: RegionsResponseDTO = {
  totalStates: 5,
  totalDistricts: 18,
  lastSyncTime: new Date().toISOString(),
  regions: [
    {
      state: 'Maharashtra',
      stateTotalCases: { suppressed: false, count: 5860 },
      coveragePercentage: 94.2,
      districts: [
        { district: 'Pune District', cases: { suppressed: false, count: 3420 }, activeSurveillanceSites: 12, lastReportedDate: '2026-10-08' },
        { district: 'Mumbai Suburban', cases: { suppressed: false, count: 2440 }, activeSurveillanceSites: 18, lastReportedDate: '2026-10-09' },
        { district: 'Gadchiroli', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' }, activeSurveillanceSites: 2, lastReportedDate: '2026-10-05' },
      ],
    },
    {
      state: 'Delhi NCR',
      stateTotalCases: { suppressed: false, count: 4890 },
      coveragePercentage: 98.0,
      districts: [
        { district: 'Central Delhi', cases: { suppressed: false, count: 2890 }, activeSurveillanceSites: 15, lastReportedDate: '2026-10-09' },
        { district: 'South Delhi', cases: { suppressed: false, count: 2000 }, activeSurveillanceSites: 11, lastReportedDate: '2026-10-08' },
      ],
    },
    {
      state: 'Goa',
      stateTotalCases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
      coveragePercentage: 85.0,
      districts: [
        { district: 'North Goa', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' }, activeSurveillanceSites: 3, lastReportedDate: '2026-10-06' },
        { district: 'South Goa', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' }, activeSurveillanceSites: 2, lastReportedDate: '2026-10-07' },
      ],
    },
  ],
};

export const MOCK_PRIVACY_CONFIG: PrivacyConfigDTO = {
  minimumKThreshold: 10,
  policyName: 'HIPAA & CDC Public Health Aggregate Anonymization Protocol',
  policyDescription: 'Strict suppression policy enforcing K >= 10 group size minimum for all aggregate disease surveillance reporting. Counts strictly below 10 are hidden before presentation.',
  enforcedByBackend: true,
  complementarySuppressionActive: true,
  metrics: {
    totalQueriesProcessed: 14290,
    suppressedGroupPercentage: 12.4,
    safeAggregatesServed: 12518,
  },
  sampleDivergence: {
    visibleExample: { suppressed: false, count: 27 },
    suppressedExample: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
  },
};

export const MOCK_AUDIT: AuditResponseDTO = {
  page: 1,
  pageSize: 10,
  totalEvents: 42,
  events: [
    {
      id: 'aud_9841',
      timestamp: '2026-10-09T08:00:12Z',
      eventCategory: 'AGGREGATE_QUERY',
      action: 'EXPORT_REGIONAL_SUMMARY',
      outcome: 'SUCCESS',
      actorRef: 'usr_admin_0942',
      correlationId: 'corr_exp_8812',
      detailsSummary: 'Exported state-level aggregate totals for Maharashtra and Delhi NCR.',
    },
    {
      id: 'aud_9840',
      timestamp: '2026-10-09T07:14:05Z',
      eventCategory: 'PRIVACY_POLICY',
      action: 'SUPPRESSION_CHECK',
      outcome: 'SUCCESS',
      actorRef: 'system_privacy_guard',
      correlationId: 'corr_priv_0041',
      detailsSummary: 'Evaluated 45 district groups; 6 groups suppressed under K=10 rule.',
    },
    {
      id: 'aud_9839',
      timestamp: '2026-10-08T22:30:19Z',
      eventCategory: 'AUTHENTICATION',
      action: 'ADMIN_SESSION_RENEW',
      outcome: 'SUCCESS',
      actorRef: 'usr_admin_0942',
      correlationId: 'corr_auth_4410',
      detailsSummary: 'OIDC administrator session successfully renewed via token refresh.',
    },
  ],
};

export const MOCK_SECURITY: SecurityResponseDTO = {
  securityStatus: 'OPTIMAL',
  activeThreatCount: 0,
  lastAuditRun: new Date().toISOString(),
  events: [
    {
      id: 'sec_041',
      timestamp: '2026-10-09T05:22:11Z',
      eventType: 'UNAUTHORIZED_ROUTE',
      severity: 'MEDIUM',
      status: 'BLOCKED',
      safeReference: 'ref_blk_9912',
      summary: 'Attempted access to unlisted clinical path rejected by backend authorization guard.',
    },
    {
      id: 'sec_040',
      timestamp: '2026-10-08T18:40:00Z',
      eventType: 'PRIVACY_POLICY_PROBE',
      severity: 'HIGH',
      status: 'LOGGED',
      safeReference: 'ref_prv_1092',
      summary: 'High frequency query variation detected; automated rate limit triggered.',
    },
  ],
};
