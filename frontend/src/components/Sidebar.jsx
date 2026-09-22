import React from 'react';
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
  MessageSquareShare,
  X,
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'send-message', label: 'Send Message', icon: Send, highlight: true },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'templates', label: 'Templates', icon: FileCode },
    { id: 'campaigns', label: 'Campaigns', icon: Layers },
    { id: 'logs', label: 'Message Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings & Test', icon: Settings },
  ];

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between h-full shadow-xs">
      <div>
        {/* Brand / Logo */}
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30">
              <MessageSquareShare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-900 tracking-tight leading-none">School WA</h1>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1 uppercase tracking-wider">Cloud Broadcast</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-3.5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? item.highlight
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/20'
                      : 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60'
                    : item.highlight
                    ? 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? item.highlight
                        ? 'text-white'
                        : 'text-emerald-600'
                      : item.highlight
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Meta API Status Badge in footer */}
      <div className="p-3.5 m-3 rounded-2xl bg-slate-50 border border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Meta Cloud API v26.0</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 leading-normal font-normal">
          Real WhatsApp Graph API integration engine.
        </p>
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
