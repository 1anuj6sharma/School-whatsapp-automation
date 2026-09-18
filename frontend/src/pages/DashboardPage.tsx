import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, Send, AlertTriangle, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';
import { MessageCampaign } from '../types';

interface DashboardProps {
  onNavigate: (tab: string, campaignId?: number) => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesFailed, setMessagesFailed] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState<MessageCampaign[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [students, classes, campaigns, logs] = await Promise.all([
        api.getStudents(),
        api.getClasses(),
        api.getCampaigns(),
        api.getMessageLogs({ limit: 500 }),
      ]);

      setTotalStudents(students.length);
      setTotalClasses(classes.length);
      setRecentCampaigns(campaigns.slice(0, 5));

      const sentCount = logs.filter((l) => ['SENT', 'DELIVERED', 'READ'].includes(l.status)).length;
      const failedCount = logs.filter((l) => l.status === 'FAILED').length;
      setMessagesSent(sentCount);
      setMessagesFailed(failedCount);
    } catch (err) {
      console.error('Failed loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating school messaging analytics..." />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle="Enrolled & mapped"
          icon={Users}
          colorClass="text-emerald-400"
          bgClass="bg-emerald-500/10 border border-emerald-500/20"
        />
        <StatCard
          title="Total Classes"
          value={totalClasses}
          subtitle="Active academic sections"
          icon={GraduationCap}
          colorClass="text-sky-400"
          bgClass="bg-sky-500/10 border border-sky-500/20"
        />
        <StatCard
          title="Messages Delivered"
          value={messagesSent}
          subtitle="Sent or read via WhatsApp"
          icon={Send}
          colorClass="text-teal-400"
          bgClass="bg-teal-500/10 border border-teal-500/20"
        />
        <StatCard
          title="Messages Failed"
          value={messagesFailed}
          subtitle="Meta or delivery errors"
          icon={AlertTriangle}
          colorClass="text-rose-400"
          bgClass="bg-rose-500/10 border border-rose-500/20"
        />
      </div>

      {/* Quick Launch Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Ready to send WhatsApp updates?</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold">Meta Verified</span>
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Broadcast official notifications to entire classes with concurrent individual dispatches.
          </p>
        </div>
        <button
          onClick={() => onNavigate('send-message')}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          <span>Launch New Broadcast</span>
        </button>
      </div>

      {/* Recent Campaigns Table */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Recent Broadcast Campaigns</h3>
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            <span>View All Campaigns</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Send}
              title="No broadcast campaigns yet"
              description="Start your first class broadcast using the Send Message tab to test real Meta WhatsApp delivery."
              actionLabel="Send First Broadcast"
              onAction={() => onNavigate('send-message')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Campaign ID</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Template</th>
                  <th className="px-6 py-3.5">Recipients</th>
                  <th className="px-6 py-3.5">Success</th>
                  <th className="px-6 py-3.5">Failed</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentCampaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white">#{camp.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-200">{camp.class_name || `Class #${camp.class_id}`}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-1 rounded-md bg-slate-800 text-emerald-300 border border-slate-700/60">
                        {camp.template_name || 'hello_world'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-100">{camp.total_recipients}</td>
                    <td className="px-6 py-4 text-emerald-400 font-semibold">{camp.successful_count}</td>
                    <td className="px-6 py-4 text-rose-400 font-semibold">{camp.failed_count}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={camp.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(camp.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onNavigate('campaign-detail', camp.id)}
                        className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
