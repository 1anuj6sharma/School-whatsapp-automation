import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertCircle, RefreshCw, Menu, LogOut, UserCheck } from 'lucide-react';
import { api } from '../services/api';

export const Header = ({ title, subtitle, onQuickSendClick, onMenuToggle, currentUser, onLogout }) => {
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
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-3 sm:px-6 md:px-8 md:py-4 flex items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-normal hidden sm:block truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Backend health status indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
            backendStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
              : backendStatus === 'checking'
              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
          }`}
          onClick={checkStatus}
          title="Click to recheck backend connectivity"
        >
          {backendStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          {backendStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />}
          {backendStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
          <span className="hidden lg:inline">
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
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Broadcast</span>
            <span className="sm:hidden">Broadcast</span>
          </button>
        )}

        {/* User Badge & Logout */}
        {currentUser && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name || 'Admin'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                {currentUser.email}
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log Out of Admin Session"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all flex items-center gap-1 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

