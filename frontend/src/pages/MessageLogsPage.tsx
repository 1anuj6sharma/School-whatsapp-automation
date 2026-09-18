import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldCheck, Filter } from 'lucide-react';
import { api } from '../services/api';
import { MessageLog } from '../types';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const MessageLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <ScrollText className="w-6 h-6 text-emerald-400" />
            <span>Message Delivery Logs</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Complete audit trail of individual WhatsApp dispatches and delivery confirmations.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="glass-panel p-3 rounded-2xl border border-slate-800 flex flex-wrap gap-2 items-center">
        {['ALL', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === st
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors font-sans">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{log.id}</td>
                    <td className="px-6 py-4 font-bold text-white">
                      {log.student_name || `Student #${log.student_id || '-'}`}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {log.masked_number || log.recipient_number}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                        {log.template_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4">
                      {log.whatsapp_message_id ? (
                        <span
                          className="font-mono text-[11px] text-emerald-400 block truncate max-w-[140px]"
                          title={log.whatsapp_message_id}
                        >
                          {log.whatsapp_message_id}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString()
                        : new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.error_message ? (
                        <span className="text-rose-400 font-medium block max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
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
