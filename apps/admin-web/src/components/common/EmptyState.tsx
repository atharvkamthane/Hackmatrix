import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Found',
  description = 'No aggregate results match the specified criteria or privacy threshold filter.',
  actionLabel,
  onAction,
}) => (
  <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 my-4 flex flex-col items-center justify-center">
    <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-3">
      <Inbox className="w-6 h-6" />
    </div>
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
