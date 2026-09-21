import React, { useEffect, useState } from 'react';
import { FileCode, AlertTriangle, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const TemplatesPage = ({ onNavigateToSend }) => {
  const [templates, setTemplates] = useState([]);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileCode className="w-6 h-6 text-emerald-600" />
            <span>WhatsApp Message Templates</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Standardized and approved message templates for school communications.
          </p>
        </div>

        <button
          onClick={onNavigateToSend}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
        >
          <span>Use in Broadcast</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Meta Approval Explanation Notice */}
      <div className="bg-sky-50 p-5 rounded-2xl border border-sky-200/90 text-xs text-sky-900 flex items-start gap-3.5 shadow-xs">
        <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sky-950 text-sm">Understanding Meta Template Approvals</h4>
          <p className="text-sky-900/90 leading-relaxed font-sans">
            Meta requires all outbound WhatsApp business templates to be approved before they can be broadcasted. 
            The <strong className="font-mono text-slate-900 font-bold">hello_world</strong> template is pre-approved for immediate testing. Custom templates (such as <strong className="font-mono text-slate-900 font-bold">student_attendance</strong> or fee reminders) must be submitted and approved in your <strong>Meta WhatsApp Business Manager</strong> before sending.
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
              className={`bg-white p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-xs ${
                isActive
                  ? 'border-emerald-300 hover:border-emerald-400 hover:shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{tpl.name}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {tpl.category}
                    </span>
                  </div>
                  <StatusBadge status={tpl.status} />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {tpl.description || 'No description provided.'}
                </p>

                {/* Simulated Bubble Preview */}
                <div className="rounded-xl whatsapp-chat-bg border border-slate-300 p-3.5 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Message Preview ({tpl.language})
                  </span>
                  <div className="whatsapp-bubble-received p-3 text-slate-800 text-xs whitespace-pre-wrap leading-relaxed shadow-xs border border-slate-200/50">
                    {tpl.body_preview || 'No preview available.'}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Lang: {tpl.language}</span>

                {isActive ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ready to Broadcast</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
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
