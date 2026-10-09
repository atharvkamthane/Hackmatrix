import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { ConditionCategoryDTO } from '../types/api';
import { formatAggregateValue, safeUnsuppressedCount } from '../types/privacy';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const ConditionsPage: React.FC = () => {
  const [conditions, setConditions] = useState<ConditionCategoryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadConditions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getConditions();
      setConditions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load condition categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConditions();
  }, [loadConditions]);

  if (isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadConditions} />;
  }

  return (
    <div className="space-y-6">
      {/* Category Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {conditions.map((cat) => (
          <div key={cat.categoryId} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Category
                </span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {formatAggregateValue(cat.totalCases)}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">{cat.name}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{cat.description}</p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Monitored Pathogens & Diseases
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {cat.monitoredDiseases.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trend per Category */}
      <div className="space-y-6">
        {conditions.map((cat) => (
          <div key={`trend-${cat.categoryId}`} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{cat.name} — Monthly Trend</h3>
                <p className="text-xs text-slate-500">2026 Monthly Surveillance Aggregate Timeline</p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold">Total: {formatAggregateValue(cat.totalCases)}</span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cat.monthlyTrend.map((m) => ({
                    label: m.label,
                    count: safeUnsuppressedCount(m.cases) ?? 0,
                    rawCases: m.cases,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(_val: any, _name: any, props: any) => [
                      formatAggregateValue(props.payload.rawCases),
                      'Cases',
                    ]}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
