import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onQuickSendClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onQuickSendClick }) => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');

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
    <header className="sticky top-0 z-10 glass-panel border-b border-slate-800/80 px-8 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Backend health status indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md cursor-pointer transition-all ${
            backendStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : backendStatus === 'checking'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
          onClick={checkStatus}
          title="Click to recheck backend connectivity"
        >
          {backendStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5" />}
          {backendStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {backendStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
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
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/60 transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Broadcast</span>
          </button>
        )}
      </div>
    </header>
  );
};
