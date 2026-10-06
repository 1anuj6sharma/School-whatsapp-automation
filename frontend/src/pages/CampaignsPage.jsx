import React, { useEffect, useState } from 'react';
import { Layers, Send, RefreshCw, ArrowRight, Trash2, Calendar, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';

export const CampaignsPage = ({
  onNavigateToDetail,
  onNavigateToSend,
  showToast,
}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Date Delete Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [dateMode, setDateMode] = useState('RANGE'); // 'RANGE' | 'BEFORE'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [beforeDate, setBeforeDate] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
      showToast?.({
        type: 'error',
        title: 'Fetch Failed',
        message: 'Could not load broadcast campaigns.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 10000); // auto-refresh active campaigns
    return () => clearInterval(interval);
  }, []);

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(campaigns.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Delete Handler
  const handleDeleteSingle = async (campaign) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Campaign #${campaign.id} (${campaign.template_name || 'Template'})?\nThis will permanently remove the campaign and all its associated delivery logs.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteCampaign(campaign.id);
      showToast?.({
        type: 'success',
        title: 'Campaign Deleted',
        message: `Campaign #${campaign.id} has been permanently deleted.`,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== campaign.id));
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign', err);
      showToast?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete the selected campaign.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Selected Delete Handler
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected campaign(s)?\nAll associated message logs will also be permanently deleted.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteCampaigns({ ids: selectedIds });
      showToast?.({
        type: 'success',
        title: 'Campaigns Deleted',
        message: res.message || `Deleted ${selectedIds.length} campaign(s) successfully.`,
      });
      setSelectedIds([]);
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to bulk delete campaigns', err);
      showToast?.({
        type: 'error',
        title: 'Bulk Delete Failed',
        message: err.message || 'Failed to delete selected campaigns.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Date Range / Before Date Delete Handler
  const handleDeleteByDate = async (e) => {
    e.preventDefault();

    const payload = {};
    if (dateMode === 'RANGE') {
      if (!fromDate && !toDate) {
        showToast?.({
          type: 'error',
          title: 'Missing Dates',
          message: 'Please select at least a From Date or a To Date.',
        });
        return;
      }
      if (fromDate) payload.from_date = fromDate;
      if (toDate) payload.to_date = toDate;
    } else {
      if (!beforeDate) {
        showToast?.({
          type: 'error',
          title: 'Missing Date',
          message: 'Please select a date threshold.',
        });
        return;
      }
      payload.before_date = beforeDate;
    }

    const confirmMsg =
      dateMode === 'RANGE'
        ? `Are you sure you want to delete all campaigns between ${fromDate || 'earliest'} and ${toDate || 'today'}?`
        : `Are you sure you want to delete all campaigns created before ${beforeDate}?`;

    if (!window.confirm(`${confirmMsg}\nThis action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteCampaigns(payload);
      showToast?.({
        type: 'success',
        title: 'Cleanup Completed',
        message: res.message || 'Campaigns deleted matching specified date filter.',
      });
      setIsDateModalOpen(false);
      setFromDate('');
      setToDate('');
      setBeforeDate('');
      setSelectedIds([]);
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaigns by date', err);
      showToast?.({
        type: 'error',
        title: 'Deletion Error',
        message: err.message || 'Failed to delete campaigns by date.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected = campaigns.length > 0 && selectedIds.length === campaigns.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < campaigns.length;

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

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsDateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-300 shadow-xs transition-colors text-xs font-semibold"
            title="Delete Campaigns by Date Range or Before Date"
          >
            <Calendar className="w-4 h-4 text-rose-500" />
            <span>Delete by Date</span>
          </button>

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

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-rose-900">
            <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center text-xs font-black">
              {selectedIds.length}
            </span>
            <span>campaign(s) selected for deletion</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-rose-100/50 transition-colors"
            >
              Deselect All
            </button>
            <button
              disabled={isDeleting}
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

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
            <table className="w-full text-left text-sm text-slate-700 min-w-[750px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      title="Select All Campaigns"
                    />
                  </th>
                  <th className="px-5 py-4">Campaign</th>
                  <th className="px-5 py-4">Target Class</th>
                  <th className="px-5 py-4">Template</th>
                  <th className="px-5 py-4">Progress</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Dispatched At</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp) => {
                  const processed = camp.successful_count + camp.failed_count;
                  const total = camp.total_recipients || 1;
                  const progressPct = Math.min(100, Math.round((processed / total) * 100));
                  const isSelected = selectedIds.includes(camp.id);

                  return (
                    <tr
                      key={camp.id}
                      className={`hover:bg-slate-50/80 transition-colors font-sans ${
                        isSelected ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(camp.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">#{camp.id}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {camp.class_name || `Class #${camp.class_id}`}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {camp.template_name || 'hello_world'}
                        </span>
                      </td>
                      <td className="px-5 py-4 w-48">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                            <span>
                              {processed} / {camp.total_recipients} Sent
                            </span>
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
                      <td className="px-5 py-4">
                        <StatusBadge status={camp.status} />
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(camp.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onNavigateToDetail(camp.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                          >
                            <span>View Logs</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={isDeleting}
                            onClick={() => handleDeleteSingle(camp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete by Date Modal */}
      <Modal
        isOpen={isDateModalOpen}
        onClose={() => !isDeleting && setIsDateModalOpen(false)}
        title="Delete Campaigns by Date"
      >
        <form onSubmit={handleDeleteByDate} className="space-y-5">
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              Deleting campaigns will permanently remove the campaign records and all associated WhatsApp delivery logs.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDateMode('RANGE')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                dateMode === 'RANGE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              From – To Date Range
            </button>
            <button
              type="button"
              onClick={() => setDateMode('BEFORE')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                dateMode === 'BEFORE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Older Than (Before Date)
            </button>
          </div>

          {dateMode === 'RANGE' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Delete Campaigns Created Before
              </label>
              <input
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                All campaigns created strictly before this date will be permanently deleted.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Confirm & Delete'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
