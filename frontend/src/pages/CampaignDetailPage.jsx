import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Hash, Search, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 10;

export const CampaignDetailPage = ({
  campaignId,
  onBack,
  showToast,
}) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isRetrying, setIsRetrying] = useState(false);

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

  const handleRetryFailed = async () => {
    if (!campaignId) return;
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retry-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail || 'Failed to retry failed recipients');
      }
      showToast?.({
        type: 'success',
        title: 'Retry Started',
        message: `Dispatched retry for failed recipients in Campaign #${campaignId}.`,
      });
      await fetchDetail();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Retry Failed',
        message: err.message || 'Could not retry failed messages.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const logs = campaign?.message_logs || [];

  // Filter logs by status and search
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== 'ALL' && log.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentName = (log.student_name || '').toLowerCase();
        const phone = (log.recipient_number || '').toLowerCase();
        const wamid = (log.whatsapp_message_id || '').toLowerCase();
        const logId = String(log.id || '');
        if (
          !studentName.includes(q) &&
          !phone.includes(q) &&
          !wamid.includes(q) &&
          !logId.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  // Paginated logs (10 per page)
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  if (loading && !campaign) {
    return <LoadingSpinner message="Fetching live campaign message logs..." />;
  }

  if (error || !campaign) {
    return (
      <div className="p-8 text-center space-y-4 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md mx-auto my-12">
        <p className="text-rose-600 font-bold">{error || 'Campaign not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs transition-colors shrink-0"
            title="Back to Campaigns"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                <Hash className="w-4 h-4 text-indigo-600" />
                <h2 className="text-lg sm:text-xl font-black text-indigo-900 tracking-tight">
                  Campaign #{campaign.id}
                </h2>
              </div>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              Class: <span className="text-slate-800 font-semibold">{campaign.class_name || `#${campaign.class_id}`}</span> &bull; Template: <span className="font-mono text-emerald-700 font-semibold">{campaign.template_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {campaign.failed_count > 0 && (
            <button
              disabled={isRetrying}
              onClick={handleRetryFailed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRetrying ? 'Retrying...' : `Retry ${campaign.failed_count} Failed`}</span>
            </button>
          )}

          <button
            onClick={fetchDetail}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Progress & Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Target</p>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{campaign.total_recipients}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Opted-in students</p>
        </div>

        <div className="bg-emerald-50/70 p-3.5 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wider">Successful</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">{campaign.successful_count}</p>
          <p className="text-[10px] sm:text-[11px] text-emerald-700/80 mt-0.5 truncate">Dispatched to Meta</p>
        </div>

        <div className="bg-rose-50/70 p-3.5 sm:p-5 rounded-2xl border border-rose-200/80 shadow-xs">
          <p className="text-[10px] sm:text-xs font-semibold text-rose-800 uppercase tracking-wider">Failed</p>
          <p className="text-xl sm:text-2xl font-extrabold text-rose-700 mt-1">{campaign.failed_count}</p>
          <p className="text-[10px] sm:text-[11px] text-rose-700/80 mt-0.5 truncate">Meta or network errors</p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Skipped</p>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">{campaign.skipped_count}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Opt-in = false</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Campaign Dispatch Progress</span>
          <span className="text-emerald-700 font-semibold">{progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 flex-wrap gap-1">
          <span>Started: {campaign.started_at ? new Date(campaign.started_at).toLocaleTimeString() : 'Pending'}</span>
          <span>Completed: {campaign.completed_at ? new Date(campaign.completed_at).toLocaleTimeString() : 'In Progress'}</span>
        </div>
      </div>

      {/* Individual Recipient Message Logs with Filter & 10 logs per page pagination */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Recipient Logs</h3>
            <span className="text-xs bg-slate-200/70 text-slate-700 font-bold px-2 py-0.5 rounded-full">
              {filteredLogs.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </select>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recipient..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 min-w-[700px]">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">WhatsApp Number</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5">Meta Message ID</th>
                <th className="px-6 py-3.5">Dispatched / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-500">
                    No recipient logs matching filter.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm">{log.student_name || 'Student'}</p>
                      <p className="text-[11px] text-slate-500">ID #{log.student_id || log.id}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {log.masked_number || log.recipient_number}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4">
                      {log.whatsapp_message_id ? (
                        <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 block truncate max-w-xs" title={log.whatsapp_message_id}>
                          {log.whatsapp_message_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.error_message ? (
                        <span className="text-rose-600 font-medium">{log.error_message}</span>
                      ) : log.sent_at ? (
                        <span className="text-slate-600">{new Date(log.sent_at).toLocaleTimeString()}</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 10 logs per page Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="recipient logs"
        />
      </div>
    </div>
  );
};
