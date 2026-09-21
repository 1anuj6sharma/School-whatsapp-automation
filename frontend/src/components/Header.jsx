import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const Header = ({ title, subtitle, onQuickSendClick }) => {
  const [backendStatus, setBackendStatus] = useState('checking');

  const checkStatus = async () => {
    try {
      const data = await api.getHealth();
      if (data.status === 'ok') {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch {
      setBackendStatus('error');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-8 py-4 flex items-center justify-between shadow-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-normal">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3.5">
        {/* Backend health status indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
            backendStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
              : backendStatus === 'checking'
              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
          }`}
          onClick={checkStatus}
          title="Click to recheck backend connectivity"
        >
          {backendStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          {backendStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
          {backendStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
          <span>
            {backendStatus === 'connected'
              ? 'Backend Online'
              : backendStatus === 'checking'
              ? 'Checking...'
              : 'Backend Offline'}
          </span>
        </div>

        {onQuickSendClick && (
          <button
            onClick={onQuickSendClick}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Broadcast</span>
          </button>
        )}
      </div>
    </header>
  );
};
