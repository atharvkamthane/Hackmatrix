import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { PrivacyConfigDTO } from '../types/api';
import { MINIMUM_K_THRESHOLD } from '../types/privacy';
import { ShieldCheck, EyeOff, CheckCircle2, Cpu, FileCheck } from 'lucide-react';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';

export const PrivacyPage: React.FC = () => {
  const [config, setConfig] = useState<PrivacyConfigDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrivacyConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getPrivacyConfig();
      setConfig(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch privacy governance configuration.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrivacyConfig();
  }, [loadPrivacyConfig]);

  if (isLoading) {
    return <TableSkeleton rows={4} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadPrivacyConfig} />;
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* Policy Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Mandatory Security Control</span>
              <h2 className="text-xl font-bold text-white">{config.policyName}</h2>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
            Threshold K = {MINIMUM_K_THRESHOLD}
          </span>
        </div>

        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{config.policyDescription}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-700/60">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Total Queries Filtered</span>
            <span className="text-lg font-bold font-mono text-teal-300">{config.metrics.totalQueriesProcessed.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Suppressed Clusters</span>
            <span className="text-lg font-bold font-mono text-amber-300">{config.metrics.suppressedGroupPercentage}%</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Safe Aggregates Served</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{config.metrics.safeAggregatesServed.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Side by Side DTO Example Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-600" />
            Suppression DTO Representation & UI Divergence Standard
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            How aggregate values are safely discriminated between visible counts and suppressed states
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Unsuppressed Case */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Case A: Unsuppressed Aggregate (Count ≥ 10)
              </span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                Visible
              </span>
            </div>

            <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
              {JSON.stringify(config.sampleDivergence.visibleExample, null, 2)}
            </div>

            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">UI Rendered Output:</span>
              <span className="text-sm font-bold text-slate-900 font-mono bg-white px-3 py-1 rounded border border-slate-200 shadow-2xs">
                27 cases
              </span>
            </div>
          </div>

          {/* Suppressed Case */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-amber-600" />
                Case B: Suppressed Aggregate (Count &lt; 10)
              </span>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                Suppressed
              </span>
            </div>

            <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
              {JSON.stringify(config.sampleDivergence.suppressedExample, null, 2)}
            </div>

            <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">UI Rendered Output:</span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded border border-slate-200 shadow-2xs">
                Suppressed for privacy
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Strict Privacy Governance Rules Checklist */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileCheck className="w-4 h-4 text-teal-600" />
          Strict Frontend Privacy Verification Checklist
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>Hidden counts are never included in Recharts tooltips, legends, or SVG attributes.</span>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>Percentages and totals are never derived using hidden or suppressed values.</span>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>Suppression is never treated as zero (0) in sorting, rankings, or tables.</span>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>Backend response is authoritative; frontend never overrides backend suppression.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
