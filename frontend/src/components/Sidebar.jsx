import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileCode,
  Send,
  Layers,
  ScrollText,
  Settings,
  ShieldCheck,
  IndianRupee,
  Receipt,
  Scale,
  BookOpen,
  MessageSquareShare,
  MessageSquareQuote,
  X,
  LogOut,
  User
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose, currentUser, onLogout }) => {
  // Detect active module from current activeTab
  const [activeModule, setActiveModule] = useState(() => {
    return ['accounts', 'fee-counter', 'fee-management'].includes(activeTab) ? 'ACCOUNTING' : 'BROADCAST';
  });

  // Keep activeModule in sync if activeTab changes externally
  useEffect(() => {
    if (['accounts', 'fee-counter', 'fee-management'].includes(activeTab)) {
      setActiveModule('ACCOUNTING');
    } else {
      setActiveModule('BROADCAST');
    }
  }, [activeTab]);

  // ── MODULE 1: WHATSAPP BROADCAST NAVIGATION ────────────────────────────────
  const broadcastMainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'send-message', label: 'Send Broadcast', icon: Send, highlight: true },
    { id: 'students', label: 'Students (WhatsApp)', icon: Users },
    { id: 'classes', label: 'Classes & Sections', icon: GraduationCap },
    { id: 'templates', label: 'Meta Templates', icon: FileCode },
    { id: 'campaigns', label: 'Broadcast Campaigns', icon: Layers },
    { id: 'logs', label: 'Message Logs', icon: ScrollText },
  ];

  const broadcastEngagementItems = [
    { id: 'inbox', label: 'Parent Inbox', icon: MessageSquareShare },
    { id: 'complaints-feedback', label: 'Complaints & Feedback', icon: MessageSquareQuote },
    { id: 'settings', label: 'Settings & Diagnostics', icon: Settings },
  ];

  // ── MODULE 2: FEE ACCOUNTING NAVIGATION ─────────────────────────────────────
  const operatorNavItems = [
    { id: 'fee-counter', label: 'Cash & OTP Counter', icon: Receipt, highlight: true },
    { id: 'accounts', label: 'Chart of Accounts (COA)', icon: Scale },
  ];

  const managementNavItems = [
    { id: 'fee-management', label: 'Fee Slabs & Schedulers', icon: IndianRupee },
  ];

  // Shared System Navigation
  const systemNavItems = [
    { id: 'logs', label: 'Message Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings & Diagnostics', icon: Settings },
  ];

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (onClose) {
      onClose();
    }
  };

  const renderNavGroup = (title, items) => (
    <div className="space-y-1">
      {title && (
        <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            {title}
          </span>
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isAccounting = activeModule === 'ACCOUNTING';

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
              isActive
                ? item.highlight
                  ? isAccounting
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : isAccounting
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                  : 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                : item.highlight
                ? isAccounting
                  ? 'text-slate-800 bg-slate-100/70 hover:bg-slate-100 font-semibold'
                  : 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${
                isActive
                  ? item.highlight
                    ? 'text-white'
                    : isAccounting
                    ? 'text-slate-900'
                    : 'text-emerald-600'
                  : item.highlight
                  ? isAccounting
                    ? 'text-slate-700'
                    : 'text-emerald-600'
                  : 'text-slate-500'
              }`}
            />
            <span className="truncate">{item.label}</span>
            {item.highlight && !isActive && (
              <span className={`ml-auto w-1.5 h-1.5 rounded-full animate-pulse ${
                isAccounting ? 'bg-slate-600' : 'bg-emerald-500'
              }`}></span>
            )}
          </button>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between h-full shadow-xs">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Brand / Logo */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs transition-colors ${
              activeModule === 'BROADCAST'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                : 'bg-gradient-to-tr from-slate-900 to-slate-700'
            }`}>
              {activeModule === 'BROADCAST' ? (
                <MessageSquareShare className="w-4 h-4" />
              ) : (
                <Scale className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900 tracking-tight leading-none">School WA</h1>
              <p className={`text-[10px] font-semibold mt-1 uppercase tracking-wider ${
                activeModule === 'BROADCAST' ? 'text-emerald-600' : 'text-slate-700'
              }`}>
                {activeModule === 'BROADCAST' ? 'Broadcast Suite' : 'Fee Accounting'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── 2 BLOCK MODULE SWITCHER (ISOLATED WORKSPACES) ────────────────── */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select Module
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {activeModule === 'BROADCAST' ? 'Broadcast Active' : 'Accounts Active'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Block 1: WhatsApp Broadcast */}
            <button
              type="button"
              onClick={() => {
                setActiveModule('BROADCAST');
                setActiveTab('dashboard');
                if (onClose) onClose();
              }}
              className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                activeModule === 'BROADCAST'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeModule === 'BROADCAST' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <MessageSquareShare className="w-3.5 h-3.5" />
                </div>
                {activeModule === 'BROADCAST' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">WhatsApp</p>
                <p className={`text-[10px] font-medium mt-0.5 truncate ${
                  activeModule === 'BROADCAST' ? 'text-emerald-100' : 'text-slate-400'
                }`}>
                  Broadcast
                </p>
              </div>
            </button>

            {/* Block 2: Fee Accounting */}
            <button
              type="button"
              onClick={() => {
                setActiveModule('ACCOUNTING');
                setActiveTab('accounts');
                if (onClose) onClose();
              }}
              className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                activeModule === 'ACCOUNTING'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeModule === 'ACCOUNTING' ? 'bg-white/20 text-emerald-400' : 'bg-slate-100 text-slate-800'
                }`}>
                  <Scale className="w-3.5 h-3.5" />
                </div>
                {activeModule === 'ACCOUNTING' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">Accounts</p>
                <p className={`text-[10px] font-medium mt-0.5 truncate ${
                  activeModule === 'ACCOUNTING' ? 'text-slate-300' : 'text-slate-400'
                }`}>
                  Fees Ledger
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Navigation Sections based on Selected Module */}
        <nav className="p-3 space-y-2">
          {activeModule === 'BROADCAST' ? (
            <>
              {/* WhatsApp Module Items */}
              {renderNavGroup('Broadcast & Messaging', broadcastMainItems)}

              <div className="pt-2 border-t border-slate-100">
                {renderNavGroup('Parent Inbox & Support', broadcastEngagementItems)}
              </div>
            </>
          ) : (
            <>
              {/* Operator Operations */}
              {renderNavGroup('Operations Desk', operatorNavItems)}

              {/* Fee Management */}
              <div className="pt-2 border-t border-slate-100">
                {renderNavGroup('Fee Management', managementNavItems)}
              </div>
            </>
          )}
        </nav>
      </div>

      <div className="p-3.5 space-y-2">
        {/* User profile & Logout */}
        {currentUser && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {currentUser.name || 'Admin'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Channel Badge in footer */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Inverosoft Platform</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-normal font-normal">
            {activeModule === 'BROADCAST' ? 'WhatsApp Communication Suite' : 'Double-Entry Accounting System'}
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 z-20 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Drawer Sheet */}
        <div
          className={`fixed inset-y-0 left-0 max-w-[280px] w-full bg-white shadow-2xl transition-transform duration-300 ease-out transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
