import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { TrendsResponseDTO, TrendsQueryFilters } from '../types/api';
import { formatAggregateValue, isSuppressed, safeUnsuppressedCount } from '../types/privacy';
import { TableSkeleton, ChartSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Filter, RotateCcw, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

import { useSocket } from '../hooks/useSocket';

export const TrendsPage: React.FC = () => {
  const [filters, setFilters] = useState<TrendsQueryFilters>({
    condition: '',
    state: '',
    district: '',
    startMonth: '2026-05',
    endMonth: '2026-10',
  });

  const [data, setData] = useState<TrendsResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getTrends(filters);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch disease trends analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useSocket(useCallback(() => {
    void fetchTrends();
  }, [fetchTrends]));

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const handleResetFilters = () => {
    setFilters({
      condition: '',
      state: '',
      district: '',
      startMonth: '2026-05',
      endMonth: '2026-10',
    });
  };

  const hasActiveFilters = Boolean(filters.condition || filters.state || filters.district);

  return (
    <div className="space-y-6">
      {/* Filter Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-teal-600" />
            Surveillance Filter Controls
          </h2>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Condition Category
            </label>
            <select
              value={filters.condition}
              onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Monitored Categories</option>
              <option value="Respiratory">Acute Respiratory Infections</option>
              <option value="VectorBorne">Vector-Borne Diseases</option>
              <option value="Waterborne">Waterborne Infections</option>
              <option value="Zoonotic">Zoonotic Infections (K≥10)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              State / Region
            </label>
            <select
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value, district: '' })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Covered States</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi NCR">Delhi NCR</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Goa">Goa</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              District Breakdown
            </label>
            <select
              value={filters.district}
              onChange={(e) => setFilters({ ...filters, district: e.target.value })}
              disabled={!filters.state}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 disabled:opacity-50 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Districts in State</option>
              {filters.state === 'Maharashtra' && (
                <>
                  <option value="Pune District">Pune District</option>
                  <option value="Mumbai Suburban">Mumbai Suburban</option>
                  <option value="Gadchiroli">Gadchiroli (Suppressed)</option>
                </>
              )}
              {filters.state === 'Delhi NCR' && (
                <>
                  <option value="Central Delhi">Central Delhi</option>
                  <option value="South Delhi">South Delhi</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Start Month
            </label>
            <input
              type="month"
              value={filters.startMonth}
              onChange={(e) => setFilters({ ...filters, startMonth: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              End Month
            </label>
            <input
              type="month"
              value={filters.endMonth}
              onChange={(e) => setFilters({ ...filters, endMonth: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Active Filter Context Banner */}
        {hasActiveFilters && (
          <div className="pt-2 text-xs text-teal-800 bg-teal-50/70 p-2.5 rounded-lg border border-teal-200/80 flex items-center justify-between">
            <span className="font-medium">
              Active Scope:{' '}
              {filters.condition && <span className="font-semibold">{filters.condition} • </span>}
              {filters.state && <span className="font-semibold">{filters.state} • </span>}
              {filters.district && <span className="font-semibold">{filters.district} • </span>}
              Timeframe: {filters.startMonth} to {filters.endMonth}
            </span>
            <span className="text-[11px] text-teal-600 font-normal">K≥10 Filter Active</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-6">
          <ChartSkeleton />
          <TableSkeleton rows={6} />
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchTrends} />}

      {!isLoading && !error && data && (
        <>
          {/* Main Line Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  Monthly Surveillance Case Curve
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Aggregate cases per month ({data.summary.totalMonthsAnalyzed} months analyzed)</p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.monthlyData.map((d) => ({
                    label: d.label,
                    count: safeUnsuppressedCount(d.cases),
                    rawCases: d.cases,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(_val: any, _name: any, props: any) => [
                      formatAggregateValue(props.payload.rawCases),
                      'Reported Cases',
                    ]}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Aggregate Cases" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0D9488' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Surveillance Data Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Monthly Aggregates Breakdown</h3>
              <span className="text-xs text-slate-400 font-mono">Total visible groups: {data.summary.visibleGroupCount}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-y border-slate-200/60">
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3">Condition Scope</th>
                    <th className="py-2.5 px-3 text-right">Aggregate Count</th>
                    <th className="py-2.5 px-3 text-center">Privacy Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.monthlyData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{row.label}</td>
                      <td className="py-3 px-3 text-slate-600">{row.condition}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                        {formatAggregateValue(row.cases)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isSuppressed(row.cases) ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Suppressed (K&lt;10)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Unsuppressed Safe
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
