import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string; size?: string }> = ({
  message = 'Loading data...',
  size = 'w-8 h-8',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <Loader2 className={`${size} animate-spin text-emerald-500`} />
      {message && <p className="text-sm font-medium text-slate-300">{message}</p>}
    </div>
  );
};
