import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  ScrollText,
  RefreshCw,
  MessageSquare,
  Trash2,
  Calendar,
  AlertTriangle,
  Layers,
  Filter,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  Hash,
  Search,
  X,
  FileSpreadsheet,
  GraduationCap,
  Download,
  Check,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConversationDrawer } from '../components/ConversationDrawer';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 10;

export const toLocalDateString = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDateString = () => toLocalDateString(new Date());

export const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
};

export const MessageLogsPage = ({ showToast, initialCampaignId = null }) => {
  const [logs, setLogs] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [campaignFilter, setCampaignFilter] = useState(initialCampaignId ? String(initialCampaignId) : 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [responseDateFilter, setResponseDateFilter] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingPage, setLoadingPage] = useState(1);

  const [activeConversation, setActiveConversation] = useState(null);

  const handleCloseConversation = () => {
    if (activeConversation) {
      setLogs((prev) =>
        prev.map((l) => {
          if (
            (activeConversation.studentId && l.student_id === activeConversation.studentId) ||
            (activeConversation.phoneNumber && l.recipient_number === activeConversation.phoneNumber)
          ) {
            return { ...l, unread_count: 0 };
          }
          return l;
        })
      );
    }
    setActiveConversation(null);
  };

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

  // Excel Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState('CURRENT'); // 'CURRENT' | 'ALL' | 'SENT' | 'DELIVERED' | 'READ' | 'DELIVERED_READ' | 'RESPONSES' | 'FAILED' | 'SELECTED'
  const [exportDateMode, setExportDateMode] = useState('ALL'); // 'ALL' | 'SELECTED_DATE' | 'CUSTOM'
  const [exportCustomDate, setExportCustomDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsExporting(true);
    try {
      const params = {};

      if (campaignFilter !== 'ALL' && campaignFilter !== '') {
        params.campaign_id = campaignFilter;
      }

      // Status Scope
      if (exportScope === 'CURRENT') {
        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }
      } else if (exportScope === 'SENT') {
        params.status = 'SENT';
      } else if (exportScope === 'DELIVERED') {
        params.status = 'DELIVERED';
      } else if (exportScope === 'READ') {
        params.status = 'READ';
      } else if (exportScope === 'DELIVERED_READ') {
        params.status = 'DELIVERED_AND_READ';
      } else if (exportScope === 'RESPONSES') {
        params.status = 'RESPONSES';
      } else if (exportScope === 'FAILED') {
        params.status = 'FAILED';
      } else if (exportScope === 'SELECTED') {
        if (selectedIds.length === 0) {
          showToast?.({
            type: 'error',
            title: 'No Logs Selected',
            message: 'Please select one or more log rows using the checkboxes first.',
          });
          setIsExporting(false);
          return;
        }
        params.ids = selectedIds;
      }

      // Date Scope
      if (exportDateMode === 'SELECTED_DATE' && responseDateFilter) {
        params.date = responseDateFilter;
      } else if (exportDateMode === 'CUSTOM' && exportCustomDate) {
        params.date = exportCustomDate;
      } else if (exportScope === 'CURRENT' && responseDateFilter) {
        params.date = responseDateFilter;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      await api.exportMessageLogs(params);
      setIsExportModalOpen(false);
      showToast?.({
        type: 'success',
        title: 'Excel Exported',
        message: 'Message delivery logs exported to Excel (.xlsx) successfully.',
      });
    } catch (err) {
      console.error('Failed to export message logs to Excel', err);
      showToast?.({
        type: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not export delivery logs to Excel.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const [totalLogs, setTotalLogs] = useState(0);
  const pageCacheRef = useRef({});
  const [serverCounts, setServerCounts] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    queued: 0,
    responses: 0,
    unread_responses: 0,
    unread_chats: 0,
  });

  // Load campaigns for dropdown filter
  const fetchCampaignsList = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data || []);
    } catch (err) {
      console.error('Failed to load campaigns list', err);
    }
  };

  // Fetch Message Logs from API for the selected page & filters with in-memory caching
  const fetchLogsPage = async (pageNumber = 1, force = false) => {
    // Check in-memory page cache first
    if (!force && pageCacheRef.current[pageNumber]) {
      const cached = pageCacheRef.current[pageNumber];
      setLogs(cached.results);
      setTotalLogs(cached.count);
      if (cached.counts) setServerCounts(cached.counts);
      setCurrentPage(pageNumber);
      setLoadingPage(pageNumber);
      return;
    }

    setLoadingPage(pageNumber);
    setCurrentPage(pageNumber);
    setLoading(true);
    try {
      const params = {
        page: pageNumber,
        page_size: PAGE_SIZE,
      };
      if (campaignFilter !== 'ALL' && campaignFilter !== '') {
        params.campaign_id = campaignFilter;
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (showUnreadOnly) {
        params.unread_only = true;
      }
      if (responseDateFilter) {
        params.date = responseDateFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.getMessageLogs(params);
      const results = Array.isArray(res) ? res : (res?.results || []);
      const count = typeof res?.count === 'number' ? res.count : results.length;
      const countsData = res?.counts || null;

      // Cache this page
      pageCacheRef.current[pageNumber] = { results, count, counts: countsData };

      setLogs(results);
      setTotalLogs(count);
      if (countsData) {
        setServerCounts(countsData);
      }
      setCurrentPage(pageNumber);
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

  const fetchLogs = (force = true) => {
    pageCacheRef.current = {};
    fetchLogsPage(currentPage, true);
  };

  useEffect(() => {
    fetchCampaignsList();
  }, []);

  // Filter effect: when campaign, status, date, or unread toggle changes, clear cache and load page 1
  useEffect(() => {
    pageCacheRef.current = {};
    fetchLogsPage(1, true);
  }, [campaignFilter, statusFilter, responseDateFilter, showUnreadOnly]);

  // Debounced search query effect
  useEffect(() => {
    const handler = setTimeout(() => {
      pageCacheRef.current = {};
      fetchLogsPage(1, true);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const counts = serverCounts;

  // With backend pagination, the logs array is already the items for current page
  const paginatedLogs = logs;
  const filteredLogs = logs;

  const handleOpenConversation = (log) => {
    setActiveConversation({
      studentId: log.student_id,
      phoneNumber: log.recipient_number,
      studentName: log.student_name,
    });
  };

  // Selection handlers
  const handleSelectPage = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedLogs.map((l) => l.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedLogs.map((l) => l.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectAllLoaded = () => {
    setSelectedIds(filteredLogs.map((l) => l.id));
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

    if (campaignFilter !== 'ALL' && campaignFilter !== '') {
      payload.campaign_id = campaignFilter;
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
        ? `Are you sure you want to delete message logs${scopeDesc} between ${fromDate || 'earliest'} and ${toDate || 'today'}?`
        : `Are you sure you want to delete message logs${scopeDesc} created before ${beforeDate}?`;

    if (!window.confirm(`${confirmMsg}\nThis action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteMessageLogs(payload);
      showToast?.({
        type: 'success',
        title: 'Cleanup Completed',
        message: res.message || 'Message logs deleted matching specified filter.',
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

  const isPageSelected =
    paginatedLogs.length > 0 && paginatedLogs.every((l) => selectedIds.includes(l.id));
  const isPageIndeterminate =
    paginatedLogs.some((l) => selectedIds.includes(l.id)) && !isPageSelected;

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
            Audit trail of WhatsApp dispatches with Campaign IDs, Meta receipts, delivery breakdowns, and parent replies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
            title="Export delivery audit logs to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </button>

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

      {/* Filter Counts Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Logs */}
        <div
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Logs
            </span>
            <ScrollText className={`w-4 h-4 ${statusFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.total}</p>
          )}
          <p className={`text-[10px] mt-0.5 ${statusFilter === 'ALL' ? 'text-slate-400' : 'text-slate-400'}`}>
            {campaignFilter === 'ALL' ? 'All campaigns' : `Campaign #${campaignFilter}`}
          </p>
        </div>

        {/* Sent */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'SENT' ? 'ALL' : 'SENT');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'SENT'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-200 hover:bg-blue-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'SENT' ? 'text-blue-100' : 'text-blue-600'}`}>
              Sent
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'SENT' ? 'text-blue-200' : 'text-blue-500'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-300" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.sent}</p>
          )}
          <p className={`text-[10px] mt-0.5 ${statusFilter === 'SENT' ? 'text-blue-100' : 'text-slate-400'}`}>
            Dispatched to server
          </p>
        </div>

        {/* Delivered */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'DELIVERED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'DELIVERED' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Delivered
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'DELIVERED' ? 'text-emerald-200' : 'text-emerald-500'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.delivered}</p>
          )}
          <p className={`text-[10px] mt-0.5 ${statusFilter === 'DELIVERED' ? 'text-emerald-100' : 'text-slate-400'}`}>
            Handset received
          </p>
        </div>

        {/* Read */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'READ' ? 'ALL' : 'READ');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'READ'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-purple-200 hover:bg-purple-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'READ' ? 'text-purple-100' : 'text-purple-600'}`}>
              Read
            </span>
            <Eye className={`w-4 h-4 ${statusFilter === 'READ' ? 'text-purple-200' : 'text-purple-500'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-300" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.read}</p>
          )}
          <p className={`text-[10px] mt-0.5 ${statusFilter === 'READ' ? 'text-purple-100' : 'text-slate-400'}`}>
            Opened & read
          </p>
        </div>

        {/* Failed */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'FAILED' ? 'ALL' : 'FAILED');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'FAILED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-rose-200 hover:bg-rose-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'FAILED' ? 'text-rose-100' : 'text-rose-600'}`}>
              Failed
            </span>
            <XCircle className={`w-4 h-4 ${statusFilter === 'FAILED' ? 'text-rose-200' : 'text-rose-500'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-rose-300" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.failed}</p>
          )}
          <p className={`text-[10px] mt-0.5 ${statusFilter === 'FAILED' ? 'text-rose-100' : 'text-slate-400'}`}>
            Undelivered errors
          </p>
        </div>

        {/* Responses Card */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'RESPONSES' ? 'ALL' : 'RESPONSES');
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-2xl border transition-all ${
            statusFilter === 'RESPONSES'
              ? 'bg-teal-700 text-white border-teal-700 shadow-sm ring-2 ring-teal-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-teal-200 hover:bg-teal-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'RESPONSES' ? 'text-teal-100' : 'text-teal-700'}`}>
              Responses
            </span>
            <MessageSquare className={`w-4 h-4 ${statusFilter === 'RESPONSES' ? 'text-teal-200' : 'text-teal-600'}`} />
          </div>
          {loading && counts.total === 0 ? (
            <div className="flex items-center gap-1.5 mt-1 h-8">
              <Loader2 className="w-5 h-5 animate-spin text-teal-300" />
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-black mt-1">{counts.responses}</p>
          )}
          <p className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${statusFilter === 'RESPONSES' ? 'text-teal-100' : 'text-slate-500'}`}>
            {counts.unread_responses > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {counts.unread_responses} unread
              </span>
            ) : (
              <span>People replied</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter Control Bar: Campaign Filter, Search, and Status Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Campaign Selector Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Campaign:</span>
            </div>
            <select
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setCurrentPage(1);
                setSelectedIds([]);
              }}
              className="flex-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-semibold text-slate-800 rounded-xl px-3 py-2 transition-all outline-none"
            >
              <option value="ALL">All Campaigns (Latest First)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  Campaign #{c.id} &bull; {c.class_name || `Class #${c.class_id || 'All'}`} ({c.template_name || 'Broadcast'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, student, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
        </div>

        {/* Status Filter Buttons and Date Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
            {['ALL', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'QUEUED', 'SKIPPED', 'RESPONSES'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                  setSelectedIds([]);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? st === 'RESPONSES'
                      ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-500/20'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{st}</span>
                {st === 'RESPONSES' && counts.responses > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      statusFilter === 'RESPONSES'
                        ? 'bg-teal-700 text-white'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {counts.responses}
                  </span>
                )}
                {st === 'RESPONSES' && counts.unread_responses > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${counts.unread_responses} unread`} />
                )}
              </button>
            ))}

            {/* 🟢 Quick Toggle: Show Unread Only */}
            <button
              type="button"
              onClick={() => {
                setShowUnreadOnly((prev) => !prev);
                setCurrentPage(1);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ml-1 ${
                showUnreadOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                  : (counts.unread_chats > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800')
              }`}
              title="Filter down to parents who are waiting for an answer"
            >
              <span className={`w-2 h-2 rounded-full ${showUnreadOnly ? 'bg-white' : (counts.unread_chats > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')}`} />
              <span>Show Unread Only</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  showUnreadOnly
                    ? 'bg-emerald-700 text-white'
                    : (counts.unread_chats > 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600')
                }`}
              >
                {counts.unread_chats || 0}
              </span>
            </button>
          </div>

          {/* Date-wise Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {statusFilter === 'RESPONSES' ? 'Response Date:' : 'Date Filter:'}
              </span>
              <input
                type="date"
                value={responseDateFilter}
                onChange={(e) => {
                  setResponseDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-slate-800 outline-none cursor-pointer font-medium"
                title="Select date to show logs of that particular date"
              />
              {responseDateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setResponseDateFilter('');
                    setCurrentPage(1);
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Clear date filter (show all)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Date Shortcuts */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setResponseDateFilter(getTodayDateString());
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  responseDateFilter === getTodayDateString()
                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Filter for today's messages"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setResponseDateFilter(getYesterdayDateString());
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  responseDateFilter === getYesterdayDateString()
                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Filter for yesterday's messages"
              >
                Yesterday
              </button>
            </div>

            {responseDateFilter && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-800 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                <Check className="w-3 h-3 text-teal-600 shrink-0" />
                <span>Date: {new Date(responseDateFilter + 'T00:00:00').toLocaleDateString()}</span>
                <span className="font-bold text-teal-900">({totalLogs} logs)</span>
              </span>
            )}
          </div>

          {campaignFilter !== 'ALL' && (
            <button
              onClick={() => {
                setCampaignFilter('ALL');
                setCurrentPage(1);
              }}
              className="ml-auto text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1"
            >
              Reset Campaign Filter
            </button>
          )}
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-rose-900">
            <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center text-xs font-black">
              {selectedIds.length}
            </span>
            <span>message log(s) selected for deletion</span>
            {selectedIds.length < totalLogs && (
              <button
                onClick={handleSelectAllLoaded}
                className="underline text-xs text-rose-700 hover:text-rose-900 font-bold ml-2"
              >
                Select all {logs.length} loaded logs
              </button>
            )}
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
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No message logs found"
          description={
            campaignFilter !== 'ALL'
              ? `No logs found for Campaign #${campaignFilter}. Try selecting 'All Campaigns' or another filter.`
              : 'Send a message or campaign broadcast to generate delivery records.'
          }
        />
      ) : (
        <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 transition-all">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-lg">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-800">Loading page {loadingPage || currentPage}...</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[980px]">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isPageSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isPageIndeterminate;
                      }}
                      onChange={handleSelectPage}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      title="Select Logs on Current Page"
                    />
                  </th>
                  <th className="px-4 py-4">Log ID</th>
                  <th className="px-4 py-4">Campaign ID</th>
                  <th className="px-4 py-4">Recipient Student & Class</th>
                  <th className="px-4 py-4">WhatsApp Number</th>
                  <th className="px-4 py-4">Template</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Meta Message ID</th>
                  <th className="px-4 py-4">Dispatched At</th>
                  <th className="px-4 py-4">Error Detail</th>
                  <th className="px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
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
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">
                        #{log.id}
                      </td>
                      {/* Campaign ID Column */}
                      <td className="px-4 py-4">
                        {log.campaign_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCampaignFilter(String(log.campaign_id));
                              setCurrentPage(1);
                            }}
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                            title={`Click to filter only Campaign #${log.campaign_id}`}
                          >
                            <Hash className="w-3 h-3 text-indigo-500" />
                            <span>{log.campaign_id}</span>
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Direct
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-900">
                        <button
                          onClick={() => handleOpenConversation(log)}
                          className="hover:text-emerald-600 hover:underline text-left transition-colors font-bold block"
                          title="Click to view conversation"
                        >
                          {log.student_name || `Student #${log.student_id || '-'}`}
                        </button>
                        {(log.class_section || log.class_name) && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <GraduationCap className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>Class: {log.class_section || log.class_name}</span>
                            </span>
                          </div>
                        )}
                        {log.has_response && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              <MessageSquare className="w-2.5 h-2.5 text-teal-600" />
                              {log.response_count} repl{log.response_count === 1 ? 'y' : 'ies'}
                            </span>
                            {log.unread_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {log.unread_count} unread
                              </span>
                            )}
                          </div>
                        )}
                        {log.latest_response_text && (
                          <div className="text-[11px] text-teal-900 bg-teal-50/80 p-1.5 rounded-lg border border-teal-100 mt-1 max-w-xs font-normal" title={log.latest_response_text}>
                            <p className="line-clamp-2 italic">"{log.latest_response_text}"</p>
                            {log.latest_response_at && (
                              <span className="block text-[10px] text-teal-600/80 font-mono mt-0.5">
                                {new Date(log.latest_response_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
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
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={log.status} />
                          {log.has_response && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                              RESPONDED
                            </span>
                          )}
                        </div>
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-2xs group ${
                              log.unread_count > 0
                                ? 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600 shadow-sm'
                                : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200 hover:border-emerald-600'
                            }`}
                            title="View conversation history with this user"
                          >
                            <MessageSquare className={`w-3.5 h-3.5 ${log.unread_count > 0 ? 'text-white' : 'text-emerald-600 group-hover:text-white'} transition-colors`} />
                            <span>Chat</span>
                            {log.unread_count > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-teal-800">
                                {log.unread_count}
                              </span>
                            )}
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

          {/* 10 logs per page Pagination */}
          <Pagination
            currentPage={currentPage}
            totalItems={totalLogs}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => fetchLogsPage(p)}
            itemLabel="message logs"
            loading={loading}
          />
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
              This will permanently delete matching WhatsApp message delivery logs and error history.
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

          {/* Scope Indicator */}
          {campaignFilter !== 'ALL' && (
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
              Applying only to <strong>Campaign #{campaignFilter}</strong>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Filter by Delivery Status (Optional)
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses (Sent, Delivered, Read, Failed, etc.)</option>
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

      {/* Export to Excel Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => !isExporting && setIsExportModalOpen(false)}
        title="Export Delivery Audit Logs to Excel (.xlsx)"
      >
        <form onSubmit={handleExportExcel} className="space-y-4">
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 text-xs shadow-2xs">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">Customized WhatsApp Delivery Logs Export</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Every exported sheet includes Student Name, Class & Section, WhatsApp Number, Dispatch & Delivery Timestamps, and parent replies.
              </p>
            </div>
          </div>

          {/* Export Filter Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Status to Export:
            </label>
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="CURRENT">Current Filtered View ({filteredLogs.length} logs)</option>
              <option value="ALL">All Delivery Logs ({counts.total} logs)</option>
              <option value="SENT">Sent Messages Only ({counts.sent} logs)</option>
              <option value="DELIVERED">Delivered Messages Only ({counts.delivered} logs)</option>
              <option value="READ">Read Messages Only ({counts.read} logs)</option>
              <option value="DELIVERED_READ">Delivered & Read Both ({counts.delivered + counts.read} logs)</option>
              <option value="RESPONSES">Parent Responses Only ({counts.responses} logs)</option>
              <option value="FAILED">Undelivered / Failed Errors ({counts.failed} logs)</option>
              {selectedIds.length > 0 && (
                <option value="SELECTED">Selected Rows Only ({selectedIds.length} logs selected)</option>
              )}
            </select>
          </div>

          {/* Date Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Date Filter Scope:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportDateMode('ALL')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                  exportDateMode === 'ALL'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Dates (Full History)
              </button>
              <button
                type="button"
                onClick={() => setExportDateMode('SELECTED_DATE')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                  exportDateMode === 'SELECTED_DATE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Active Date: {responseDateFilter ? new Date(responseDateFilter + 'T00:00:00').toLocaleDateString() : '(None selected)'}
              </button>
            </div>
            {exportDateMode === 'SELECTED_DATE' && !responseDateFilter && (
              <p className="text-[11px] text-amber-600 mt-1">
                Notice: No date filter is currently selected on the table. All dates will be included in the download.
              </p>
            )}
          </div>

          {/* Campaign Scope info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span className="font-bold text-slate-700">Campaign Scope:</span>
            {campaignFilter === 'ALL' ? (
              <span className="font-medium text-slate-600">All Campaigns</span>
            ) : (
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                Campaign #{campaignFilter}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Side Conversation Drawer (24h Window Chat Enabled) */}
      <ConversationDrawer
        isOpen={!!activeConversation}
        onClose={handleCloseConversation}
        studentId={activeConversation?.studentId}
        phoneNumber={activeConversation?.phoneNumber}
        studentName={activeConversation?.studentName}
        canSendMessage={true}
      />
    </div>
  );
};
