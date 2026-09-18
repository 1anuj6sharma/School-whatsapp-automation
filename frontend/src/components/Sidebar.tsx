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
  MessageSquareShare
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
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

  return (
    <aside className="w-64 bg-slate-950/80 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 backdrop-blur-xl z-20">
      <div>
        {/* Brand / Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950">
            <MessageSquareShare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight leading-none">School WA</h1>
            <p className="text-[11px] font-medium text-emerald-400 mt-1 uppercase tracking-wider">Cloud Broadcast</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isActive
                    ? item.highlight
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/80'
                      : 'bg-slate-800 text-emerald-400 border border-slate-700/60 shadow-sm'
                    : item.highlight
                    ? 'text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? (item.highlight ? 'text-white' : 'text-emerald-400') : ''}`} />
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
      <div className="p-4 m-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Meta Cloud API v26.0</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
          Real WhatsApp Graph API integration engine.
        </p>
      </div>
    </aside>
  );
};
