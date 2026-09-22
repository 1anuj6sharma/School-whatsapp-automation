import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const MessageLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

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
            Complete audit trail of individual WhatsApp dispatches and delivery confirmations.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition-colors self-start sm:self-auto w-full sm:w-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex overflow-x-auto gap-1.5 sm:gap-2 items-center max-w-full">
        {['ALL', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
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

      {/* Logs Table */}
      {loading ? (
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
            <table className="w-full text-left text-sm text-slate-700 min-w-[750px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Log ID</th>
                  <th className="px-6 py-4">Recipient Student</th>
                  <th className="px-6 py-4">Masked Number</th>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Meta Message ID</th>
                  <th className="px-6 py-4">Dispatched At</th>
                  <th className="px-6 py-4">Error Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">#{log.id}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {log.student_name || `Student #${log.student_id || '-'}`}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {log.masked_number || log.recipient_number}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {log.template_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString()
                        : new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.error_message ? (
                        <span className="text-rose-600 font-medium block max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
