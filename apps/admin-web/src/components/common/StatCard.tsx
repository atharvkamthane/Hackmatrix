import React from 'react';
import { AggregateValue, formatAggregateValue, isSuppressed } from '../../types/privacy';
import { SuppressedValueBadge } from './DataBadges';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value?: AggregateValue | number | string;
  description: string;
  icon?: LucideIcon;
  isLoading?: boolean;
  accentColor?: 'teal' | 'blue' | 'slate' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading = false,
  accentColor = 'teal',
}) => {
  const getAccentStyles = () => {
    switch (accentColor) {
      case 'blue':
        return 'border-l-4 border-l-blue-600 bg-white';
      case 'amber':
        return 'border-l-4 border-l-amber-500 bg-white';
      case 'slate':
        return 'border-l-4 border-l-slate-400 bg-white';
      case 'teal':
      default:
        return 'border-l-4 border-l-teal-600 bg-white';
    }
  };

  if (isLoading) {
    return (
      <div className={`p-5 rounded-xl border border-slate-200 shadow-xs ${getAccentStyles()} animate-pulse`}>
        <div className="h-4 w-28 bg-slate-200 rounded mb-3" />
        <div className="h-8 w-36 bg-slate-300 rounded mb-2" />
        <div className="h-3 w-48 bg-slate-200 rounded" />
      </div>
    );
  }

  const renderValue = () => {
    if (value === undefined || value === null) {
      return <span className="text-slate-400 text-lg font-medium">N/A</span>;
    }
    if (typeof value === 'object' && 'suppressed' in value) {
      const aggVal = value as AggregateValue;
      if (isSuppressed(aggVal)) {
        return <SuppressedValueBadge />;
      }
      return <span className="text-2xl font-bold tracking-tight text-slate-900">{formatAggregateValue(aggVal)}</span>;
    }
    return <span className="text-2xl font-bold tracking-tight text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</span>;
  };

  return (
    <div className={`p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 ${getAccentStyles()}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="my-1.5 flex items-baseline">{renderValue()}</div>
      <p className="text-xs text-slate-500 font-normal mt-1">{description}</p>
    </div>
  );
};
