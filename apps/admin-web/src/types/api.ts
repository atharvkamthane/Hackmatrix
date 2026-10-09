import { AggregateValue } from './privacy';

export interface AdminSummaryDTO {
  kpi: {
    totalReportedCases: AggregateValue;
    monitoredConditionsCount: number;
    coveredRegionsCount: number;
    lastUpdated: string;
    isDemoData?: boolean;
  };
  monthlyTrends: Array<{
    month: string; // e.g. "2026-01"
    label: string; // e.g. "Jan 2026"
    Respiratory: AggregateValue;
    VectorBorne: AggregateValue;
    Waterborne: AggregateValue;
    Zoonotic: AggregateValue;
  }>;
  conditionDistribution: Array<{
    category: string;
    displayName: string;
    value: AggregateValue;
  }>;
  regionalOverview: Array<{
    regionId: string;
    stateName: string;
    districtName?: string;
    cases: AggregateValue;
    riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
    lastReported: string;
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'error';
    category: string;
  }>;
}

export interface TrendsQueryFilters {
  condition?: string;
  state?: string;
  district?: string;
  startMonth?: string;
  endMonth?: string;
}

export interface TrendsResponseDTO {
  filters: TrendsQueryFilters;
  monthlyData: Array<{
    month: string;
    label: string;
    cases: AggregateValue;
    condition: string;
    state?: string;
    district?: string;
  }>;
  summary: {
    totalMonthsAnalyzed: number;
    peakMonth?: string;
    suppressedGroupCount: number;
    visibleGroupCount: number;
  };
}

export interface RegionalDataDTO {
  state: string;
  districts: Array<{
    district: string;
    cases: AggregateValue;
    activeSurveillanceSites: number;
    lastReportedDate: string;
  }>;
  stateTotalCases: AggregateValue;
  coveragePercentage: number;
}

export interface RegionsResponseDTO {
  regions: RegionalDataDTO[];
  totalStates: number;
  totalDistricts: number;
  lastSyncTime: string;
}

export interface ConditionCategoryDTO {
  categoryId: string;
  name: string;
  description: string;
  totalCases: AggregateValue;
  monitoredDiseases: string[];
  monthlyTrend: Array<{
    month: string;
    label: string;
    cases: AggregateValue;
  }>;
}

export interface PrivacyConfigDTO {
  minimumKThreshold: number;
  policyName: string;
  policyDescription: string;
  enforcedByBackend: boolean;
  complementarySuppressionActive: boolean;
  metrics: {
    totalQueriesProcessed: number;
    suppressedGroupPercentage: number;
    safeAggregatesServed: number;
  };
  sampleDivergence: {
    visibleExample: { suppressed: false; count: 27 };
    suppressedExample: { suppressed: true; reason: 'BELOW_K_THRESHOLD' };
  };
}

export interface AuditEventDTO {
  id: string;
  timestamp: string;
  eventCategory: string;
  action: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  actorRef: string; // e.g. "admin_sub_984" or "system_worker"
  correlationId: string;
  detailsSummary: string;
}

export interface AuditResponseDTO {
  events: AuditEventDTO[];
  page: number;
  pageSize: number;
  totalEvents: number;
}

export interface SecurityEventDTO {
  id: string;
  timestamp: string;
  eventType: 'AUTH_DENIED' | 'ACCESS_DENIED' | 'UNAUTHORIZED_ROUTE' | 'RATE_LIMITED' | 'PRIVACY_POLICY_PROBE';
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'BLOCKED' | 'LOGGED' | 'INVESTIGATING';
  safeReference: string;
  summary: string;
}

export interface SecurityResponseDTO {
  events: SecurityEventDTO[];
  securityStatus: 'OPTIMAL' | 'DEGRADED' | 'ALERT';
  activeThreatCount: number;
  lastAuditRun: string;
}
