import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { AuditResponseDTO, AuditEventDTO } from '../types/api';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { FileText, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [auditData, setAuditData] = useState<AuditResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getAuditEvents(page, 10);
      setAuditData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch administrative audit events.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  if (isLoading) {
    return <TableSkeleton rows={8} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadAuditLogs} />;
  }

  if (!auditData) return null;

  const filteredEvents = auditData.events.filter(
    (e) =>
      e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.eventCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.correlationId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Administrative System Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Explicit allowlisted administrative actions and query operations (Total: {auditData.totalEvents} recorded events)
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by action, actor, or ref ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4 text-center">Outcome</th>
                <th className="py-3 px-4">Actor Ref</th>
                <th className="py-3 px-4">Correlation ID</th>
                <th className="py-3 px-4">Details Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No administrative audit records match your search filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt: AuditEventDTO) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                        {evt.eventCategory}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{evt.action}</td>
                    <td className="py-3 px-4 text-center">
                      {evt.outcome === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-800 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" />
                          {evt.outcome}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{evt.actorRef}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{evt.correlationId}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{evt.detailsSummary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page {auditData.page} of {Math.ceil(auditData.totalEvents / auditData.pageSize)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * auditData.pageSize >= auditData.totalEvents}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
