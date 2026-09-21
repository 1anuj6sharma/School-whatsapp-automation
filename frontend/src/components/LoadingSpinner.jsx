import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({
  message = 'Loading data...',
  size = 'w-8 h-8',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
      <Loader2 className={`${size} animate-spin text-emerald-600`} />
      {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
    </div>
  );
};
