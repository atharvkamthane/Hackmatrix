import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { SecurityResponseDTO, SecurityEventDTO } from '../types/api';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  const [secData, setSecData] = useState<SecurityResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSecurityEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getSecurityEvents();
      setSecData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch administrative security events.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSecurityEvents();
  }, [loadSecurityEvents]);

  if (isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadSecurityEvents} />;
  }

  if (!secData) return null;

  return (
    <div className="space-y-6">
      {/* Security Posture Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Security Posture & Enforcement Status</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                {secData.securityStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Active Security Threats: {secData.activeThreatCount} • Last Audit Run: {new Date(secData.lastAuditRun).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <button
          onClick={loadSecurityEvents}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Security Stream
        </button>
      </div>

      {/* Security Events Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            Authorization & Policy Security Event Monitor
          </h3>
          <span className="text-xs font-mono text-slate-400">Allowlisted Fields Only</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4 text-center">Severity</th>
                <th className="py-3 px-4 text-center">Enforcement Status</th>
                <th className="py-3 px-4">Safe Reference</th>
                <th className="py-3 px-4">Summary Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {secData.events.map((evt: SecurityEventDTO) => (
                <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {new Date(evt.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                      {evt.eventType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {evt.severity === 'CRITICAL' || evt.severity === 'HIGH' ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-800 border border-red-200">
                        {evt.severity}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {evt.severity}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-mono">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {evt.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{evt.safeReference}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-sm">{evt.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
