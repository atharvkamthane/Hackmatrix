import { apiClient } from './apiClient';
import {
  AdminSummaryDTO,
  TrendsResponseDTO,
  RegionsResponseDTO,
  ConditionCategoryDTO,
  PrivacyConfigDTO,
  AuditResponseDTO,
  SecurityResponseDTO,
  TrendsQueryFilters,
} from '../types/api';
import {
  MOCK_SUMMARY,
  MOCK_TRENDS,
  MOCK_REGIONS,
  MOCK_PRIVACY_CONFIG,
  MOCK_AUDIT,
  MOCK_SECURITY,
} from './mockDataService';

export const isDemoMode = (): boolean => {
  return localStorage.getItem('hm_demo_mode') === 'true';
};

export const setDemoMode = (enabled: boolean): void => {
  localStorage.setItem('hm_demo_mode', enabled ? 'true' : 'false');
};

export const adminService = {
  async getSummary(): Promise<AdminSummaryDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_SUMMARY);
    }
    try {
      const response = await apiClient.get<AdminSummaryDTO>('/admin/summary');
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/summary request failed.', err);
      throw err;
    }
  },

  async getTrends(filters: TrendsQueryFilters = {}): Promise<TrendsResponseDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_TRENDS(filters));
    }
    try {
      const response = await apiClient.get<TrendsResponseDTO>('/admin/trends', { params: filters });
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/trends request failed.', err);
      throw err;
    }
  },

  async getRegions(): Promise<RegionsResponseDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_REGIONS);
    }
    try {
      const response = await apiClient.get<RegionsResponseDTO>('/admin/regions');
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/regions request failed.', err);
      throw err;
    }
  },

  async getConditions(): Promise<ConditionCategoryDTO[]> {
    if (isDemoMode()) {
      return Promise.resolve([
        {
          categoryId: 'cat_resp',
          name: 'Acute Respiratory Infections',
          description: 'Influenza-like illness, COVID-19, RSV surveillance.',
          totalCases: { suppressed: false, count: 10450 },
          monitoredDiseases: ['Influenza A/B', 'COVID-19', 'RSV', 'Severe Pneumonia'],
          monthlyTrend: [
            { month: '2026-05', label: 'May 2026', cases: { suppressed: false, count: 1240 } },
            { month: '2026-06', label: 'Jun 2026', cases: { suppressed: false, count: 1450 } },
            { month: '2026-07', label: 'Jul 2026', cases: { suppressed: false, count: 1890 } },
            { month: '2026-08', label: 'Aug 2026', cases: { suppressed: false, count: 2150 } },
            { month: '2026-09', label: 'Sep 2026', cases: { suppressed: false, count: 1780 } },
            { month: '2026-10', label: 'Oct 2026', cases: { suppressed: false, count: 1940 } },
          ],
        },
        {
          categoryId: 'cat_vec',
          name: 'Vector-Borne Diseases',
          description: 'Dengue, Malaria, Chikungunya surveillance.',
          totalCases: { suppressed: false, count: 5340 },
          monitoredDiseases: ['Dengue Virus', 'Malaria P. vivax', 'Malaria P. falciparum', 'Chikungunya'],
          monthlyTrend: [
            { month: '2026-05', label: 'May 2026', cases: { suppressed: false, count: 430 } },
            { month: '2026-06', label: 'Jun 2026', cases: { suppressed: false, count: 680 } },
            { month: '2026-07', label: 'Jul 2026', cases: { suppressed: false, count: 910 } },
            { month: '2026-08', label: 'Aug 2026', cases: { suppressed: false, count: 1340 } },
            { month: '2026-09', label: 'Sep 2026', cases: { suppressed: false, count: 1120 } },
            { month: '2026-10', label: 'Oct 2026', cases: { suppressed: false, count: 860 } },
          ],
        },
        {
          categoryId: 'cat_zoo',
          name: 'Zoonotic Infections',
          description: 'Rare zoonotic clusters strictly subject to K=10 privacy threshold.',
          totalCases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' },
          monitoredDiseases: ['Leptospirosis', 'Brucellosis', 'Kyasanur Forest Disease'],
          monthlyTrend: [
            { month: '2026-05', label: 'May 2026', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' } },
            { month: '2026-06', label: 'Jun 2026', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' } },
            { month: '2026-07', label: 'Jul 2026', cases: { suppressed: false, count: 18 } },
            { month: '2026-08', label: 'Aug 2026', cases: { suppressed: false, count: 24 } },
            { month: '2026-09', label: 'Sep 2026', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' } },
            { month: '2026-10', label: 'Oct 2026', cases: { suppressed: true, reason: 'BELOW_K_THRESHOLD' } },
          ],
        },
      ]);
    }
    try {
      const response = await apiClient.get<ConditionCategoryDTO[]>('/admin/conditions');
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/conditions request failed.', err);
      throw err;
    }
  },

  async getPrivacyConfig(): Promise<PrivacyConfigDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_PRIVACY_CONFIG);
    }
    try {
      const response = await apiClient.get<PrivacyConfigDTO>('/admin/privacy-config');
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/privacy-config request failed.', err);
      throw err;
    }
  },

  async getAuditEvents(page = 1, pageSize = 10): Promise<AuditResponseDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_AUDIT);
    }
    try {
      const response = await apiClient.get<AuditResponseDTO>('/admin/audit', { params: { page, pageSize } });
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/audit request failed.', err);
      throw err;
    }
  },

  async getSecurityEvents(): Promise<SecurityResponseDTO> {
    if (isDemoMode()) {
      return Promise.resolve(MOCK_SECURITY);
    }
    try {
      const response = await apiClient.get<SecurityResponseDTO>('/admin/security-events');
      return response.data;
    } catch (err) {
      console.warn('Backend API /admin/security-events request failed.', err);
      throw err;
    }
  },
};
