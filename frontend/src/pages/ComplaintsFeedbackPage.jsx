import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Send,
  User,
  Phone,
  GraduationCap,
  Calendar,
  Languages,
  Tag,
  Check,
  X,
  FileSpreadsheet,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Inbox
} from 'lucide-react';
import { api } from '../services/api';
import { ConversationDrawer } from '../components/ConversationDrawer';

export function ComplaintsFeedbackPage({ showToast, onNavigateToConversation }) {
  // Data states
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    complaints: 0,
    feedbacks: 0,
    pending: 0,
    resolved: 0,
  });
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal / Detail state
  const [selectedItem, setSelectedItem] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Chat Conversation Drawer state
  const [activeConversation, setActiveConversation] = useState(null);

  const handleOpenConversation = (item) => {
    setActiveConversation({
      studentId: item.student || item.student_id,
      phoneNumber: item.phone_number,
      studentName: item.student_name || 'WhatsApp User',
    });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load classes for filter dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const clsData = await api.getClasses();
        setClasses(Array.isArray(clsData) ? clsData : clsData.results || []);
      } catch (err) {
        console.error('Error fetching classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Fetch data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        type: filterType,
        category: filterCategory,
        class_id: filterClassId,
        status: filterStatus,
        date_from: filterDateFrom,
        date_to: filterDateTo,
        search: debouncedSearch,
      };

      const res = await api.getComplaintsFeedback(params);
      if (res) {
        setItems(res.results || []);
        setTotalCount(res.count || 0);
        setTotalPages(res.total_pages || 1);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching complaints & feedback:', err);
      showToast?.({
        type: 'error',
        title: 'Fetch Failed',
        message: err.message || 'Could not load complaints and feedback.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, pageSize, filterType, filterCategory, filterClassId, filterStatus, filterDateFrom, filterDateTo, debouncedSearch, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update status or reply
  const handleUpdateStatus = async (item, newStatus, reply = null, shouldClose = false) => {
    setUpdatingStatus(true);
    if (shouldClose) {
      setSelectedItem(null);
      setAdminReplyText('');
    }
    try {
      const payload = { status: newStatus };
      if (reply !== null) {
        payload.admin_reply = reply;
      }
      const updated = await api.updateComplaintFeedback(item.id, payload);
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...updated } : it)));
      if (!shouldClose) {
        setSelectedItem((prev) => (prev && prev.id === item.id ? { ...prev, ...updated } : null));
      }
      showToast?.({
        type: 'success',
        title: 'Saved Successfully',
        message: 'Record updated successfully.',
      });
      fetchData(true);
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete item
  const handleDelete = async (id) => {
    try {
      await api.deleteComplaintFeedback(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      setDeleteConfirmId(null);
      showToast?.({
        type: 'success',
        title: 'Deleted',
        message: 'Record removed successfully.',
      });
      fetchData(true);
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete item.',
      });
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilterType('');
    setFilterCategory('');
    setFilterClassId('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const getCategoryLabel = (cat) => {
    switch (cat?.toUpperCase()) {
      case 'STUDY':
        return 'Study Related';
      case 'SCHOOL':
        return 'School Related';
      case 'TEACHER':
        return 'Teacher Related';
      case 'OTHER':
        return 'Other';
      default:
        return cat || 'General';
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Resolved
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            In Review
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Pending
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    if (type?.toUpperCase() === 'COMPLAINT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-100/80 text-rose-800 border border-rose-200/80">
          Complaint
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-100/80 text-blue-800 border border-blue-200/80">
        Feedback
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Stats Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total || 0}</p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
            <span>Complaints + Feedbacks</span>
          </div>
        </div>

        {/* Complaints */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/60 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Complaints</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{stats.complaints || 0}</p>
          <span className="text-[11px] text-rose-600 font-medium">Study, School & Teacher</span>
        </div>

        {/* Feedback */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/60 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Feedback</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{stats.feedbacks || 0}</p>
          <span className="text-[11px] text-blue-600 font-medium">Suggestions & Praise</span>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/60 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Action</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.pending || 0}</p>
          <span className="text-[11px] text-amber-600 font-medium">Needs Review</span>
        </div>

        {/* Resolved */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/60 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50/20 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Resolved</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.resolved || 0}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Closed & Addressed</span>
        </div>
      </div>

      {/* ─── Filter & Search Control Panel ─────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, phone number, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Refresh & Reset buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Reset Filters
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Types</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              <option value="STUDY">Study Related</option>
              <option value="SCHOOL">School Related</option>
              <option value="TEACHER">Teacher Related</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Class</label>
            <select
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.section ? `(${cls.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ─── Main Submissions Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-medium">Loading complaints & feedback...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Submissions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || filterType || filterCategory || filterClassId || filterStatus
                ? 'No records match your active filters. Try adjusting your search or reset filters.'
                : 'Submissions from WhatsApp users will appear here when they send complaints or feedback.'}
            </p>
            {(searchQuery || filterType || filterCategory || filterClassId || filterStatus) && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">User & Student</th>
                  <th className="px-4 py-3.5">Type & Category</th>
                  <th className="px-4 py-3.5">Message</th>
                  <th className="px-4 py-3.5">Class / Phone</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isRegistered = Boolean(item.student);
                  const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setAdminReplyText(item.admin_reply || '');
                      }}
                    >
                      {/* User & Student */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isRegistered
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isRegistered ? <User className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 text-xs">
                                {item.student_name || 'WhatsApp User'}
                              </span>
                              {isRegistered ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Student
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600">
                                  Guest
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">{item.phone_number}</span>
                          </div>
                        </div>
                      </td>

                      {/* Type & Category */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          {getTypeBadge(item.submission_type)}
                          <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                      </td>

                      {/* Message preview */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                        {item.admin_reply && (
                          <p className="text-[11px] text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md mt-1 font-medium line-clamp-1 border border-emerald-100">
                            Reply: {item.admin_reply}
                          </p>
                        )}
                      </td>

                      {/* Class / Lang */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium text-slate-700 block">
                            {item.class_name && item.class_name !== 'N/A' ? item.class_name : '—'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
                            <Languages className="w-3 h-3" />
                            {item.language === 'hi' ? 'Hindi (हिंदी)' : 'English'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">{getStatusBadge(item.status)}</td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenConversation(item)}
                            title="Open WhatsApp Chat Conversation"
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200/80 hover:border-emerald-600 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs group"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white transition-colors" />
                            <span>Chat</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setAdminReplyText(item.admin_reply || '');
                            }}
                            title="View Full Details"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            title="Delete Record"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
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
        )}

        {/* ─── Pagination Footer ───────────────────────────────────────── */}
        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3.5 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * pageSize, totalCount)}
                </strong>{' '}
                of <strong className="text-slate-800">{totalCount}</strong> entries
              </span>
              <span className="text-slate-300">|</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail & Action Modal ─────────────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {getTypeBadge(selectedItem.submission_type)}
                  {getStatusBadge(selectedItem.status)}
                </div>
                <h3 className="font-bold text-lg text-slate-900 mt-2">
                  {getCategoryLabel(selectedItem.category)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted on{' '}
                  {new Date(selectedItem.created_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setAdminReplyText('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* User / Student Profile Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Sender / Student
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {selectedItem.student_name || 'WhatsApp User'}
                  </span>
                  {selectedItem.student && (
                    <span className="text-[10px] font-semibold text-emerald-600">Registered Student</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Phone Number
                  </span>
                  <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">
                    {selectedItem.phone_number}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Class & Section
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {selectedItem.class_name && selectedItem.class_name !== 'N/A'
                      ? selectedItem.class_name
                      : 'Not Assigned'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Language
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {selectedItem.language === 'hi' ? 'Hindi (हिंदी)' : 'English'}
                  </span>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Submitted Message
                </label>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.message}
                </div>
              </div>

              {/* Resolution / Admin Reply */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Admin Resolution & Reply Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Type an internal resolution note or response message..."
                  defaultValue={selectedItem.admin_reply || ''}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              {/* Status change actions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Update Status
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        selectedItem,
                        'PENDING',
                        adminReplyText !== '' ? adminReplyText : selectedItem.admin_reply,
                        false
                      )
                    }
                    disabled={updatingStatus}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      selectedItem.status === 'PENDING'
                        ? 'bg-rose-100 text-rose-800 border-rose-300 ring-2 ring-rose-300/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Mark Pending
                  </button>

                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        selectedItem,
                        'IN_REVIEW',
                        adminReplyText !== '' ? adminReplyText : selectedItem.admin_reply,
                        false
                      )
                    }
                    disabled={updatingStatus}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      selectedItem.status === 'IN_REVIEW'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-300/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Mark In Review
                  </button>

                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        selectedItem,
                        'RESOLVED',
                        adminReplyText !== '' ? adminReplyText : selectedItem.admin_reply,
                        false
                      )
                    }
                    disabled={updatingStatus}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      selectedItem.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-300/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50/90 border-t border-slate-100 rounded-b-3xl flex items-center justify-between">
              <button
                onClick={() => setDeleteConfirmId(selectedItem.id)}
                className="px-3.5 py-2 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenConversation(selectedItem);
                    setSelectedItem(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Live Chat</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setAdminReplyText('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(
                      selectedItem,
                      selectedItem.status,
                      adminReplyText !== '' ? adminReplyText : selectedItem.admin_reply,
                      true
                    );
                  }}
                  disabled={updatingStatus}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {updatingStatus ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Dialog ─────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Delete Submission?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will permanently delete this complaint/feedback record from the database.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex-1"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Side Conversation Drawer ───────────────────────────────────── */}
      <ConversationDrawer
        isOpen={!!activeConversation}
        onClose={() => setActiveConversation(null)}
        studentId={activeConversation?.studentId}
        phoneNumber={activeConversation?.phoneNumber}
        studentName={activeConversation?.studentName}
        canSendMessage={true}
      />
    </div>
  );
}
