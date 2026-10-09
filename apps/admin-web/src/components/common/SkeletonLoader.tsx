import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="w-full space-y-3 animate-pulse">
    <div className="h-10 bg-slate-200 rounded-lg w-full" />
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="h-12 bg-slate-100 rounded-md w-full" />
    ))}
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="w-full h-72 bg-slate-100 rounded-xl animate-pulse p-6 flex flex-col justify-between">
    <div className="flex justify-between items-center">
      <div className="h-4 w-36 bg-slate-200 rounded" />
      <div className="h-4 w-24 bg-slate-200 rounded" />
    </div>
    <div className="space-y-4 my-auto">
      <div className="h-2 bg-slate-200 rounded w-full" />
      <div className="h-2 bg-slate-200 rounded w-3/4" />
      <div className="h-2 bg-slate-200 rounded w-5/6" />
      <div className="h-2 bg-slate-200 rounded w-2/3" />
    </div>
    <div className="flex justify-between">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-3 w-8 bg-slate-200 rounded" />
      ))}
    </div>
  </div>
);
