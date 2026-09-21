import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, Send, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';

export const DashboardPage = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesFailed, setMessagesFailed] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState([]);

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
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50 border border-emerald-100"
        />
        <StatCard
          title="Total Classes"
          value={totalClasses}
          subtitle="Active academic sections"
          icon={GraduationCap}
          colorClass="text-sky-600"
          bgClass="bg-sky-50 border border-sky-100"
        />
        <StatCard
          title="Messages Delivered"
          value={messagesSent}
          subtitle="Sent or read via WhatsApp"
          icon={Send}
          colorClass="text-teal-600"
          bgClass="bg-teal-50 border border-teal-100"
        />
        <StatCard
          title="Messages Failed"
          value={messagesFailed}
          subtitle="Meta or delivery errors"
          icon={AlertTriangle}
          colorClass="text-rose-600"
          bgClass="bg-rose-50 border border-rose-100"
        />
      </div>

      {/* Quick Launch Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white p-6 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Ready to send WhatsApp updates?</span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
              Meta Verified
            </span>
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Broadcast official notifications to entire classes with concurrent individual dispatches.
          </p>
        </div>
        <button
          onClick={() => onNavigate('send-message')}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow active:scale-95 whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          <span>Launch New Broadcast</span>
        </button>
      </div>

      {/* Recent Campaigns Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Recent Broadcast Campaigns</h3>
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
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
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 font-sans">
                {recentCampaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">#{camp.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{camp.class_name || `Class #${camp.class_id}`}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                        {camp.template_name || 'hello_world'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{camp.total_recipients}</td>
                    <td className="px-6 py-4 text-emerald-600 font-semibold">{camp.successful_count}</td>
                    <td className="px-6 py-4 text-rose-600 font-semibold">{camp.failed_count}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={camp.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(camp.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onNavigate('campaign-detail', camp.id)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
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
