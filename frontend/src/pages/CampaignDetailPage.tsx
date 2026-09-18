import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Send, CheckCircle2, AlertTriangle, Eye, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { CampaignDetail } from '../types';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface CampaignDetailPageProps {
  campaignId: number;
  onBack: () => void;
}

export const CampaignDetailPage: React.FC<CampaignDetailPageProps> = ({
  campaignId,
  onBack,
}) => {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = async () => {
    try {
      const data = await api.getCampaign(campaignId);
      setCampaign(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // Poll every 3 seconds while processing
    const interval = setInterval(() => {
      if (campaign?.status === 'PROCESSING' || loading) {
        fetchDetail();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [campaignId, campaign?.status]);

  if (loading && !campaign) {
    return <LoadingSpinner message="Fetching live campaign message logs..." />;
  }

  if (error || !campaign) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-rose-400 font-bold">{error || 'Campaign not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
        >
          Back to Campaigns
        </button>
      </div>
    );
  }

  const processedCount = campaign.successful_count + campaign.failed_count;
  const progressPercent =
    campaign.total_recipients > 0
      ? Math.round((processedCount / campaign.total_recipients) * 100)
      : 100;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Back button and title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Campaign #{campaign.id}
              </h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Class: <span className="text-slate-200 font-semibold">{campaign.class_name || `#${campaign.class_id}`}</span> &bull; Template: <span className="font-mono text-emerald-400 font-semibold">{campaign.template_name}</span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchDetail}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Progress & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase">Total Target</p>
          <p className="text-2xl font-extrabold text-white mt-1">{campaign.total_recipients}</p>
          <p className="text-[11px] text-slate-400 mt-1">Opted-in students</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10">
          <p className="text-xs font-semibold text-emerald-400 uppercase">Successful</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{campaign.successful_count}</p>
          <p className="text-[11px] text-emerald-300/80 mt-1">Dispatched to Meta</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-950/10">
          <p className="text-xs font-semibold text-rose-400 uppercase">Failed</p>
          <p className="text-2xl font-extrabold text-rose-400 mt-1">{campaign.failed_count}</p>
          <p className="text-[11px] text-rose-300/80 mt-1">Meta API or network errors</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase">Opt-out Skipped</p>
          <p className="text-2xl font-extrabold text-slate-300 mt-1">{campaign.skipped_count}</p>
          <p className="text-[11px] text-slate-500 mt-1">Opt-in = false</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span>Campaign Dispatch Progress</span>
          <span className="text-emerald-400">{progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Started: {campaign.started_at ? new Date(campaign.started_at).toLocaleTimeString() : 'Pending'}</span>
          <span>Completed: {campaign.completed_at ? new Date(campaign.completed_at).toLocaleTimeString() : 'In Progress'}</span>
        </div>
      </div>

      {/* Individual Recipient Message Logs */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <h3 className="font-bold text-white text-base">Individual Recipient Message Logs</h3>
          <span className="text-xs text-slate-400">
            {campaign.message_logs.length} Total Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">WhatsApp Number</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5">Meta Message ID</th>
                <th className="px-6 py-3.5">Dispatched / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {campaign.message_logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-white text-sm">{log.student_name || 'Student'}</p>
                    <p className="text-[11px] text-slate-500">ID #{log.student_id}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-300">
                    {log.masked_number || log.recipient_number}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-6 py-4">
                    {log.whatsapp_message_id ? (
                      <span className="font-mono text-[11px] text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/20 block truncate max-w-xs" title={log.whatsapp_message_id}>
                        {log.whatsapp_message_id}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {log.error_message ? (
                      <span className="text-rose-400 font-medium">{log.error_message}</span>
                    ) : log.sent_at ? (
                      <span className="text-slate-400">{new Date(log.sent_at).toLocaleTimeString()}</span>
                    ) : (
                      <span className="text-slate-500">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
