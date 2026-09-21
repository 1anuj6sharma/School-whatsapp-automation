import React from 'react';

export const StatusBadge = ({ status, className = '' }) => {
  const norm = status?.toUpperCase() || 'UNKNOWN';

  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (norm === 'ACTIVE' || norm === 'SENT' || norm === 'READ' || norm === 'COMPLETED') {
    badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'PENDING' || norm === 'QUEUED' || norm === 'PROCESSING') {
    badgeStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'DELIVERED') {
    badgeStyles = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (norm === 'REJECTED' || norm === 'FAILED') {
    badgeStyles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (norm === 'SKIPPED') {
    badgeStyles = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${badgeStyles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {norm}
    </span>
  );
};
