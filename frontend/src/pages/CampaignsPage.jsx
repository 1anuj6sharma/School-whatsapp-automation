import React, { useEffect, useState } from 'react';
import { Layers, Send, RefreshCw, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const CampaignsPage = ({
  onNavigateToDetail,
  onNavigateToSend,
}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 10000); // auto-refresh active campaigns
    return () => clearInterval(interval);
  }, []);

  if (loading && campaigns.length === 0) {
    return <LoadingSpinner message="Loading broadcast campaigns..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Broadcast Campaigns</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track real-time delivery status across all classroom WhatsApp broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchCampaigns}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs transition-colors shrink-0"
            title="Refresh Campaigns"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateToSend}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span>New Broadcast</span>
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No campaigns yet"
          description="You haven't launched any broadcast campaigns. Choose a class and send a template to get started."
          actionLabel="Launch Broadcast"
          onAction={onNavigateToSend}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[700px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Campaign</th>
                  <th className="px-6 py-4">Target Class</th>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Dispatched At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp) => {
                  const processed = camp.successful_count + camp.failed_count;
                  const total = camp.total_recipients || 1;
                  const progressPct = Math.min(100, Math.round((processed / total) * 100));

                  return (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">#{camp.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {camp.class_name || `Class #${camp.class_id}`}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {camp.template_name || 'hello_world'}
                        </span>
                      </td>
                      <td className="px-6 py-4 w-48">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                            <span>{processed} / {camp.total_recipients} Sent</span>
                            <span className="text-emerald-700">{camp.successful_count} ✓</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full transition-all duration-500 ${
                                camp.failed_count > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={camp.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(camp.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onNavigateToDetail(camp.id)}
                          className="flex items-center gap-1.5 ml-auto text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                        >
                          <span>View Logs</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
