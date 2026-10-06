import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, MessageSquare, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConversationDrawer } from '../components/ConversationDrawer';
import { Modal } from '../components/Modal';

export const MessageLogsPage = ({ showToast }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeConversation, setActiveConversation] = useState(null);

  // Selection & Deletion states
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Date Delete Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [dateMode, setDateMode] = useState('RANGE'); // 'RANGE' | 'BEFORE'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [beforeDate, setBeforeDate] = useState('');
  const [targetStatus, setTargetStatus] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getMessageLogs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 200,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load message logs', err);
      showToast?.({
        type: 'error',
        title: 'Fetch Failed',
        message: 'Could not load delivery logs.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleOpenConversation = (log) => {
    setActiveConversation({
      studentId: log.student_id,
      phoneNumber: log.recipient_number,
      studentName: log.student_name,
    });
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(logs.map((l) => l.id));
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
  const handleDeleteSingle = async (log) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Message Log #${log.id} (${log.student_name || 'Recipient'})?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteMessageLog(log.id);
      showToast?.({
        type: 'success',
        title: 'Log Deleted',
        message: `Message Log #${log.id} has been permanently deleted.`,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== log.id));
      await fetchLogs();
    } catch (err) {
      console.error('Failed to delete message log', err);
      showToast?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete message log.',
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
        `Are you sure you want to delete ${selectedIds.length} selected message log(s)?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteMessageLogs({ ids: selectedIds });
      showToast?.({
        type: 'success',
        title: 'Logs Deleted',
        message: res.message || `Deleted ${selectedIds.length} message log(s) successfully.`,
      });
      setSelectedIds([]);
      await fetchLogs();
    } catch (err) {
      console.error('Failed to bulk delete message logs', err);
      showToast?.({
        type: 'error',
        title: 'Bulk Delete Failed',
        message: err.message || 'Failed to delete selected message logs.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Date Range / Before Date Delete Handler
  const handleDeleteByDate = async (e) => {
    e.preventDefault();

    const payload = {};
    if (targetStatus && targetStatus !== 'ALL') {
      payload.status = targetStatus;
    }

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

    const scopeDesc = targetStatus !== 'ALL' ? ` with status '${targetStatus}'` : '';
    const confirmMsg =
      dateMode === 'RANGE'
        ? `Are you sure you want to delete all message logs${scopeDesc} between ${fromDate || 'earliest'} and ${toDate || 'today'}?`
        : `Are you sure you want to delete all message logs${scopeDesc} created before ${beforeDate}?`;

    if (!window.confirm(`${confirmMsg}\nThis action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteMessageLogs(payload);
      showToast?.({
        type: 'success',
        title: 'Cleanup Completed',
        message: res.message || 'Message logs deleted matching specified date filter.',
      });
      setIsDateModalOpen(false);
      setFromDate('');
      setToDate('');
      setBeforeDate('');
      setTargetStatus('ALL');
      setSelectedIds([]);
      await fetchLogs();
    } catch (err) {
      console.error('Failed to delete message logs by date', err);
      showToast?.({
        type: 'error',
        title: 'Deletion Error',
        message: err.message || 'Failed to delete message logs by date.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected = logs.length > 0 && selectedIds.length === logs.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < logs.length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ScrollText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Message Delivery Logs</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete audit trail of WhatsApp dispatches, incoming parent replies, and delivery confirmations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsDateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl text-xs font-semibold border border-slate-200 hover:border-rose-300 shadow-xs transition-colors"
            title="Delete Logs by Date Range or Before Date"
          >
            <Calendar className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete by Date</span>
          </button>

          <button
            onClick={fetchLogs}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex overflow-x-auto gap-1.5 sm:gap-2 items-center max-w-full">
        {['ALL', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setSelectedIds([]);
            }}
            className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === st
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-rose-900">
            <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center text-xs font-black">
              {selectedIds.length}
            </span>
            <span>message log(s) selected for deletion</span>
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

      {/* Logs Table */}
      {loading && logs.length === 0 ? (
        <LoadingSpinner message="Querying delivery logs..." />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No message logs found"
          description="Send a message or campaign broadcast to generate delivery records."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[900px]">
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
                      title="Select All Logs"
                    />
                  </th>
                  <th className="px-4 py-4">Log ID</th>
                  <th className="px-4 py-4">Recipient Student</th>
                  <th className="px-4 py-4">Masked Number</th>
                  <th className="px-4 py-4">Template</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Meta Message ID</th>
                  <th className="px-4 py-4">Dispatched At</th>
                  <th className="px-4 py-4">Error Detail</th>
                  <th className="px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isSelected = selectedIds.includes(log.id);

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors font-sans ${
                        isSelected ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(log.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">#{log.id}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">
                        <button
                          onClick={() => handleOpenConversation(log)}
                          className="hover:text-emerald-600 hover:underline text-left transition-colors font-bold"
                          title="Click to view conversation"
                        >
                          {log.student_name || `Student #${log.student_id || '-'}`}
                        </button>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700">
                        {log.masked_number || log.recipient_number}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {log.template_name}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-4">
                        {log.whatsapp_message_id ? (
                          <span
                            className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block truncate max-w-[140px]"
                            title={log.whatsapp_message_id}
                          >
                            {log.whatsapp_message_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {log.sent_at
                          ? new Date(log.sent_at).toLocaleString()
                          : new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {log.error_message ? (
                          <span className="text-rose-600 font-medium block max-w-xs truncate" title={log.error_message}>
                            {log.error_message}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenConversation(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-xs font-semibold border border-emerald-200 hover:border-emerald-600 transition-all shadow-2xs group"
                            title="View conversation history with this user"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white transition-colors" />
                            <span>Chat</span>
                          </button>
                          <button
                            disabled={isDeleting}
                            onClick={() => handleDeleteSingle(log)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                            title="Delete Log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        title="Delete Message Logs by Date"
      >
        <form onSubmit={handleDeleteByDate} className="space-y-5">
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              This will permanently delete the matching WhatsApp message delivery logs and error history.
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Filter by Delivery Status (Optional)
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses (Sent, Delivered, Failed, etc.)</option>
              <option value="FAILED">Only Failed Logs</option>
              <option value="SENT">Only Sent Logs</option>
              <option value="DELIVERED">Only Delivered Logs</option>
              <option value="READ">Only Read Logs</option>
              <option value="SKIPPED">Only Skipped Logs</option>
            </select>
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
                Delete Logs Created Before
              </label>
              <input
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                All message logs created strictly before this date will be permanently deleted.
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

      {/* Side Conversation Drawer */}
      <ConversationDrawer
        isOpen={!!activeConversation}
        onClose={() => setActiveConversation(null)}
        studentId={activeConversation?.studentId}
        phoneNumber={activeConversation?.phoneNumber}
        studentName={activeConversation?.studentName}
      />
    </div>
  );
};
