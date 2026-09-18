import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const norm = status?.toUpperCase() || 'UNKNOWN';

  let badgeStyles = 'bg-slate-800/80 text-slate-300 border-slate-700';

  if (norm === 'ACTIVE' || norm === 'SENT' || norm === 'READ' || norm === 'COMPLETED') {
    badgeStyles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  } else if (norm === 'PENDING' || norm === 'QUEUED' || norm === 'PROCESSING') {
    badgeStyles = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  } else if (norm === 'DELIVERED') {
    badgeStyles = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  } else if (norm === 'REJECTED' || norm === 'FAILED') {
    badgeStyles = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  } else if (norm === 'SKIPPED') {
    badgeStyles = 'bg-slate-700/40 text-slate-400 border-slate-600/40';
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
