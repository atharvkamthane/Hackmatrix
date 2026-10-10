import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { RegionsResponseDTO, RegionalDataDTO } from '../types/api';
import { formatAggregateValue, isSuppressed } from '../types/privacy';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Search, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

import { useSocket } from '../hooks/useSocket';

export const RegionsPage: React.FC = () => {
  const [data, setData] = useState<RegionsResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({
    Maharashtra: true,
    'Delhi NCR': true,
  });

  const loadRegions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getRegions();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load regional public-health surveillance data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useSocket(useCallback(() => {
    void loadRegions();
  }, [loadRegions]));

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const toggleState = (stateName: string) => {
    setExpandedStates((prev) => ({ ...prev, [stateName]: !prev[stateName] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadRegions} />;
  }

  if (!data) return null;

  const filteredRegions = data.regions.filter(
    (reg) =>
      reg.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.districts.some((d) => d.district.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Regional Search & Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            Regional Public Health Surveillance Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            State & sentinel district aggregates ({data.totalStates} States, {data.totalDistricts} Districts monitored)
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search state or district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Regional Accordion / Detailed Table List */}
      <div className="space-y-4">
        {filteredRegions.map((region: RegionalDataDTO) => {
          const isExpanded = expandedStates[region.state] !== false;

          return (
            <div key={region.state} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              {/* State Header Row */}
              <div
                onClick={() => toggleState(region.state)}
                className="p-4 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{region.state}</h3>
                    <p className="text-[11px] text-slate-500">{region.districts.length} Monitored Units • {region.coveragePercentage === null ? 'Coverage not reported' : `${region.coveragePercentage}% Sentinel Site Coverage`}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">State Total</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {formatAggregateValue(region.stateTotalCases)}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Districts Subtable */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                        <th className="py-2.5 px-4">District / Unit</th>
                        <th className="py-2.5 px-4 text-center">Active Surveillance Sites</th>
                        <th className="py-2.5 px-4 text-right">Aggregate Reported Cases</th>
                        <th className="py-2.5 px-4 text-center">Privacy Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {region.districts.map((dist, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{dist.district}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{dist.activeSurveillanceSites === null ? 'Not reported' : `${dist.activeSurveillanceSites} Sites`}</td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                            {formatAggregateValue(dist.cases)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isSuppressed(dist.cases) ? (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Suppressed (K&lt;10)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Unsuppressed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
