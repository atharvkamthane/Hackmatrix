import React from 'react';
import { SocketStatus } from '../../hooks/useSocket';
import { ShieldCheck, Database, AlertCircle } from 'lucide-react';

export const SocketStatusBadge: React.FC<{ status: SocketStatus; lastUpdated?: string | null }> = ({ status, lastUpdated }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'connected':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse', label: 'Live Socket' };
      case 'connecting':
      case 'reconnecting':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-ping', label: 'Reconnecting' };
      case 'offline':
      default:
        return { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: 'Offline' };
    }
  };

  const style = getBadgeStyle();

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span>{style.label}</span>
      {lastUpdated && <span className="text-slate-400 border-l border-slate-300 pl-1.5 font-mono text-[10px]">{lastUpdated}</span>}
    </div>
  );
};

export const PrivacyThresholdBadge: React.FC = () => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
    <span>K ≥ 10 Anonymized</span>
  </div>
);

export const DemoDataBadge: React.FC<{ onToggle?: () => void }> = ({ onToggle }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
    <Database className="w-3.5 h-3.5 text-amber-700" />
    <span>DEMO DATA (SYNTHETIC)</span>
    {onToggle && (
      <button
        onClick={onToggle}
        className="ml-1 underline text-[11px] hover:text-amber-950 font-normal cursor-pointer"
        title="Switch to Live API Mode"
      >
        Live Mode
      </button>
    )}
  </div>
);

export const LiveDataBadge: React.FC<{ onToggle?: () => void }> = ({ onToggle }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
    <Database className="w-3.5 h-3.5 text-emerald-700" />
    <span>LIVE DATA (ETL PIPELINE)</span>
    {onToggle && (
      <button
        onClick={onToggle}
        className="ml-1 underline text-[11px] hover:text-emerald-950 font-normal cursor-pointer text-slate-500"
        title="Switch to Demo Mode"
      >
        Demo Mode
      </button>
    )}
  </div>
);

export const SuppressedValueBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
    <AlertCircle className="w-3 h-3 text-slate-400" />
    Suppressed for privacy
  </span>
);
