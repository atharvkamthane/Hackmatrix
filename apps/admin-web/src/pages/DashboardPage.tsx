import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { AdminSummaryDTO } from '../types/api';
import { StatCard } from '../components/common/StatCard';
import { TableSkeleton, ChartSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { formatAggregateValue, isSuppressed, safeUnsuppressedCount } from '../types/privacy';
import {
  Activity,
  Layers,
  MapPin,
  Clock,
  TrendingUp,
  PieChart as PieIcon,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<AdminSummaryDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await adminService.getSummary();
      setData(summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch public health aggregate summary.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Reported Cases" description="" isLoading />
          <StatCard title="Monitored Categories" description="" isLoading />
          <StatCard title="Covered Regions" description="" isLoading />
          <StatCard title="Last Sync" description="" isLoading />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartSkeleton />
          </div>
          <div>
            <ChartSkeleton />
          </div>
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadDashboardData} />;
  }

  if (!data) {
    return <EmptyState title="No Dashboard Analytics Available" onAction={loadDashboardData} actionLabel="Reload" />;
  }

  // Safe Recharts chart data transformer using safeUnsuppressedCount
  const chartData = data.monthlyTrends.map((trend) => ({
    label: trend.label,
    Respiratory: safeUnsuppressedCount(trend.Respiratory),
    VectorBorne: safeUnsuppressedCount(trend.VectorBorne),
    Waterborne: safeUnsuppressedCount(trend.Waterborne),
    Zoonotic: safeUnsuppressedCount(trend.Zoonotic),
    // Original objects for privacy-safe Tooltip
    rawResp: trend.Respiratory,
    rawVector: trend.VectorBorne,
    rawWater: trend.Waterborne,
    rawZoonotic: trend.Zoonotic,
  }));

  const distChartData = data.conditionDistribution.map((item) => ({
    name: item.displayName,
    count: safeUnsuppressedCount(item.value) ?? 0,
    rawValue: item.value,
    isSuppressed: isSuppressed(item.value),
  }));

  const COLORS = ['#0D9488', '#2563EB', '#3B82F6', '#94A3B8'];

  // Custom Recharts Tooltip that strictly enforces "Suppressed for privacy" text
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg text-xs shadow-lg border border-slate-700 space-y-1">
          <p className="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1">{label}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-teal-400">Respiratory:</span>
              <span className="font-mono font-medium">{formatAggregateValue(dataPoint.rawResp)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-blue-400">Vector-Borne:</span>
              <span className="font-mono font-medium">{formatAggregateValue(dataPoint.rawVector)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-indigo-400">Waterborne:</span>
              <span className="font-mono font-medium">{formatAggregateValue(dataPoint.rawWater)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-slate-400">Zoonotic:</span>
              <span className="font-mono font-medium">{formatAggregateValue(dataPoint.rawZoonotic)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reported Cases"
          value={data.kpi.totalReportedCases}
          description="Aggregate surveillance cases (K≥10 filter applied)"
          icon={Activity}
          accentColor="teal"
        />
        <StatCard
          title="Monitored Categories"
          value={data.kpi.monitoredConditionsCount}
          description="Active disease category surveillance programs"
          icon={Layers}
          accentColor="blue"
        />
        <StatCard
          title="Covered Regions"
          value={data.kpi.coveredRegionsCount}
          description="Monitored states & surveillance sentinel districts"
          icon={MapPin}
          accentColor="amber"
        />
        <StatCard
          title="Data Freshness"
          value={data.kpi.lastUpdated ? new Date(data.kpi.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No data'}
          description={data.kpi.lastUpdated ? `Last synced ${new Date(data.kpi.lastUpdated).toLocaleDateString()}` : 'No aggregate data has been reported.'}
          icon={Clock}
          accentColor="slate"
        />
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Disease Trend Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                Monthly Disease Surveillance Trends
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated time-series by condition category (Monthly granularity)</p>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">2026 Monthly View</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Area type="monotone" dataKey="Respiratory" name="Respiratory" stroke="#0D9488" strokeWidth={2} fillOpacity={1} fill="url(#tealGrad)" />
                <Area type="monotone" dataKey="VectorBorne" name="Vector-Borne" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#blueGrad)" />
                <Area type="monotone" dataKey="Waterborne" name="Waterborne" stroke="#3B82F6" strokeWidth={2} fill="#93C5FD" fillOpacity={0.2} />
                <Area type="monotone" dataKey="Zoonotic" name="Zoonotic (K≥10)" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Groups with monthly counts &lt; 10 are rendered as suppressed in tooltips and tables to maintain HIPAA privacy compliance.</span>
          </div>
        </div>

        {/* Right Col: Condition Category Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-teal-600" />
                Condition Distribution
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregate cases per category</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip
                  formatter={(_value: any, _name: any, props: any) => {
                    const raw = props.payload.rawValue;
                    return [formatAggregateValue(raw), 'Cases'];
                  }}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {distChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isSuppressed ? '#CBD5E1' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
            {data.conditionDistribution.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{item.displayName}</span>
                <span className="font-semibold text-slate-900 font-mono">{formatAggregateValue(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regional Overview Table & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table 2 Cols */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                Regional Aggregate Surveillance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">State and district public-health surveillance aggregates</p>
            </div>
            <button
              onClick={loadDashboardData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-y border-slate-200/60">
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3 text-right">Aggregate Cases</th>
                  <th className="py-2.5 px-3 text-center">Surveillance Risk</th>
                  <th className="py-2.5 px-3 text-right">Last Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.regionalOverview.map((row) => {
                  const getRiskBadge = (risk: string) => {
                    switch (risk) {
                      case 'ELEVATED':
                        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">ELEVATED</span>;
                      case 'HIGH':
                        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-800 border border-red-200">HIGH</span>;
                      case 'UNKNOWN':
                        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">UNKNOWN</span>;
                      case 'MODERATE':
                        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">MODERATE</span>;
                      case 'LOW':
                      default:
                        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">LOW</span>;
                    }
                  };

                  return (
                    <tr key={row.regionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{row.stateName}</td>
                      <td className="py-3 px-3 text-slate-600">{row.districtName || 'State Aggregate'}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                        {formatAggregateValue(row.cases)}
                      </td>
                      <td className="py-3 px-3 text-center">{getRiskBadge(row.riskLevel)}</td>
                      <td className="py-3 px-3 text-right text-slate-500 text-[11px] font-mono">
                        {new Date(row.lastReported).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed 1 Col */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                Analytics Activity Feed
              </h2>
              <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-semibold border border-teal-200">Safe Events</span>
            </div>

            <div className="space-y-3">
              {data.recentActivity.map((evt) => (
                <div key={evt.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      {evt.severity === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                      {evt.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{evt.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Activity logs strictly contain aggregate server events only.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
