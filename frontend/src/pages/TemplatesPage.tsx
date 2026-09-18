import React, { useEffect, useState } from 'react';
import { FileCode, AlertTriangle, CheckCircle2, Info, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { api } from '../services/api';
import { MessageTemplate } from '../types';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface TemplatesPageProps {
  onNavigateToSend: () => void;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ onNavigateToSend }) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading Meta WhatsApp templates..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <FileCode className="w-6 h-6 text-emerald-400" />
            <span>WhatsApp Message Templates</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Standardized and approved message templates for school communications.
          </p>
        </div>

        <button
          onClick={onNavigateToSend}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 transition-all self-start md:self-auto"
        >
          <span>Use in Broadcast</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Meta Approval Explanation Notice */}
      <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 bg-sky-950/20 text-xs text-sky-200 flex items-start gap-3.5 shadow-lg">
        <Info className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sky-300 text-sm">Understanding Meta Template Approvals</h4>
          <p className="text-sky-200/90 leading-relaxed">
            Meta requires all outbound WhatsApp business templates to be approved before they can be broadcasted. 
            The <strong className="font-mono text-white">hello_world</strong> template is pre-approved for immediate MVP testing. Custom templates (such as <strong className="font-mono text-white">student_attendance</strong> or fee reminders) must be submitted and approved in your <strong>Meta WhatsApp Business Manager</strong> before sending.
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tpl) => {
          const isActive = tpl.status === 'ACTIVE';

          return (
            <div
              key={tpl.id}
              className={`glass-panel p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-emerald-500/30 hover:border-emerald-500/60 shadow-lg shadow-emerald-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{tpl.name}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {tpl.category}
                    </span>
                  </div>
                  <StatusBadge status={tpl.status} />
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {tpl.description || 'No description provided.'}
                </p>

                {/* Simulated Bubble Preview */}
                <div className="rounded-xl bg-[#0b141a] border border-slate-800 p-3.5 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Message Preview ({tpl.language})
                  </span>
                  <div className="whatsapp-bubble-received p-3 text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
                    {tpl.body_preview || 'No preview available.'}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Lang: {tpl.language}</span>

                {isActive ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ready to Broadcast</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Meta Approval Pending</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
