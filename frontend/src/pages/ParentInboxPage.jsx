import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  MessageCircle,
  MessageSquare,
  Send,
  RefreshCw,
  Phone,
  User,
  Users,
  GraduationCap,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileCode,
  IndianRupee,
  ChevronLeft,
  X,
  Loader2,
  ExternalLink,
  Sliders,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

export function ParentInboxPage({ showToast, initialContact = null }) {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'UNREAD' | 'REPLIES'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classes, setClasses] = useState([]);

  // Active Chat State
  const [activePhone, setActivePhone] = useState(initialContact?.phoneNumber || null);
  const [activeStudentId, setActiveStudentId] = useState(initialContact?.studentId || null);
  const [conversationData, setConversationData] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  // Message Send State
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Template Quick Send
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Mobile View Toggle: 'LIST' or 'CHAT'
  const [mobileView, setMobileView] = useState('LIST');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load classes for filter dropdown
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const clsData = await api.getClasses();
        setClasses(Array.isArray(clsData) ? clsData : []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    loadClasses();
  }, []);

  // Load templates for quick reply
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const tpls = await api.getTemplates();
        setTemplates((tpls || []).filter((t) => t.status === 'ACTIVE' || t.status === 'APPROVED'));
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    loadTemplates();
  }, []);

  // Fetch Conversation List
  const fetchConversations = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingList(true);
    else setIsRefreshing(true);
    try {
      const params = {};
      if (filterMode === 'UNREAD') params.unread_only = true;
      if (filterMode === 'REPLIES') params.replies_only = true;
      if (selectedClassId) params.class_id = selectedClassId;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getConversations(params);
      const list = res.conversations || [];
      setConversations(list);

      // Auto-select first conversation if desktop and nothing selected
      if (!activePhone && list.length > 0 && window.innerWidth >= 768) {
        setActivePhone(list[0].phone_number);
        setActiveStudentId(list[0].student_id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      showToast?.({
        type: 'error',
        title: 'Failed to load inbox',
        message: err.message || 'Could not fetch parent conversations.',
      });
    } finally {
      setLoadingList(false);
      setIsRefreshing(false);
    }
  }, [filterMode, selectedClassId, searchQuery, activePhone, showToast]);

  useEffect(() => {
    fetchConversations();
  }, [filterMode, selectedClassId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Active Conversation Details & Thread
  const fetchActiveChat = useCallback(async (phone, studentId, isSilent = false) => {
    if (!phone && !studentId) return;
    if (!isSilent) setLoadingChat(true);

    try {
      const identifier = studentId || phone;
      const data = await api.getConversation(identifier);
      setConversationData(data);

      // Update unread count in local list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.phone_number === phone || (studentId && c.student_id === studentId)) {
            return { ...c, unread_count: 0 };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Error loading chat:', err);
      showToast?.({
        type: 'error',
        title: 'Chat Load Error',
        message: err.message || 'Could not load messages for this parent.',
      });
    } finally {
      setLoadingChat(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activePhone || activeStudentId) {
      fetchActiveChat(activePhone, activeStudentId);
    }
  }, [activePhone, activeStudentId, fetchActiveChat]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (messagesEndRef.current && !loadingChat) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationData?.messages, loadingChat]);

  // Handle Select Conversation
  const handleSelectConversation = (conv) => {
    setActivePhone(conv.phone_number);
    setActiveStudentId(conv.student_id);
    setMobileView('CHAT');
  };

  // Send Direct Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || sending) return;

    setSending(true);
    const textToSend = replyText.trim();
    setReplyText('');

    try {
      const payload = {
        phone_number: activePhone,
        student_id: activeStudentId,
        message: textToSend,
      };

      await api.sendConversationMessage(payload);
      showToast?.({
        type: 'success',
        title: 'Message Sent',
        message: 'Message delivered to parent via WhatsApp.',
      });

      // Reload chat messages and list
      await fetchActiveChat(activePhone, activeStudentId, true);
      fetchConversations(true);
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast?.({
        type: 'error',
        title: 'Send Failed',
        message: err.message || 'Could not send WhatsApp message.',
      });
      setReplyText(textToSend); // Restore unsent message
    } finally {
      setSending(false);
    }
  };

  // Quick Send Template
  const handleSendTemplate = async (template) => {
    if (sendingTemplate) return;
    setSendingTemplate(true);
    try {
      await api.sendConversationMessage({
        phone_number: activePhone,
        student_id: activeStudentId,
        template_name: template.name,
        language_code: template.language || 'en_US',
      });

      showToast?.({
        type: 'success',
        title: 'Template Sent',
        message: `Template "${template.name}" dispatched to parent.`,
      });
      setShowTemplateModal(false);
      await fetchActiveChat(activePhone, activeStudentId, true);
      fetchConversations(true);
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Template Dispatch Failed',
        message: err.message || 'Could not dispatch template.',
      });
    } finally {
      setSendingTemplate(false);
    }
  };

  // Helper for delivery tick icon
  const renderDeliveryTick = (status) => {
    const st = (status || '').toUpperCase();
    if (st === 'READ') {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline-block" title="Read" />;
    }
    if (st === 'DELIVERED') {
      return <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline-block" title="Delivered" />;
    }
    if (st === 'SENT') {
      return <Check className="w-3.5 h-3.5 text-slate-400 inline-block" title="Sent to server" />;
    }
    if (st === 'FAILED') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline-block" title="Failed" />;
    }
    return <Clock className="w-3 h-3 text-slate-300 inline-block" />;
  };

  // Format relative timestamp
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Format full message time
  const formatFullTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const activeStudent = conversationData?.student;
  const activeStudentsList = conversationData?.students || [];
  const activeMessages = conversationData?.messages || [];
  const totalUnreadAll = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* ─── Main 2-Column WhatsApp Web Hub ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left Column: Conversations List ──────────────────────────────── */}
        <div
          className={`w-full md:w-96 lg:w-[420px] flex flex-col border-r border-slate-200 bg-white shrink-0 ${
            mobileView === 'CHAT' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Parent Inbox</span>
                  {totalUnreadAll > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse">
                      {totalUnreadAll}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">{conversations.length} active threads</p>
              </div>
            </div>

            <button
              onClick={() => fetchConversations(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-2.5 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student, parent, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs rounded-xl transition-all outline-hidden text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  filterMode === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                All Chats
              </button>
              <button
                onClick={() => setFilterMode('UNREAD')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  filterMode === 'UNREAD'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100/70 border border-rose-200/60'
                }`}
              >
                <span>Unread</span>
                {totalUnreadAll > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setFilterMode('REPLIES')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  filterMode === 'REPLIES'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Parent Replies
              </button>

              {/* Class Filter */}
              {classes.length > 0 && (
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border-none outline-hidden cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs">Loading parent inbox conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <MessageCircle className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No conversations found</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {filterMode === 'UNREAD'
                    ? 'No unread messages from parents right now.'
                    : filterMode === 'REPLIES'
                    ? 'No parents have replied to notices yet.'
                    : 'When you dispatch WhatsApp notices or parents reply, conversations will appear here.'}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activePhone === conv.phone_number;
                const hasUnread = (conv.unread_count || 0) > 0;
                const initials = (conv.student_name || 'WA')
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={conv.phone_number}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                        : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Contact Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : hasUnread
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Chat Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${hasUnread ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>
                          {conv.student_name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTime(conv.latest_message_time)}
                        </span>
                      </div>

                      {/* Parent name & Class */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 truncate">
                        {conv.parent_name && (
                          <span className="truncate">Parent: {conv.parent_name}</span>
                        )}
                        {conv.class_name && (
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-semibold shrink-0">
                            {conv.class_name}
                          </span>
                        )}
                      </div>

                      {/* Snippet & Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {conv.latest_message_direction === 'OUTBOUND' && (
                            <span className="mr-1">{renderDeliveryTick(conv.latest_message_status)}</span>
                          )}
                          <span>{conv.latest_message}</span>
                        </p>

                        {/* Unread Pill */}
                        {hasUnread && (
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Right Column: Chat Window ────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col bg-[#efeae2]/40 relative overflow-hidden ${
            mobileView === 'LIST' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activePhone ? (
            <>
              {/* Chat Top Navbar */}
              <div className="p-3 sm:p-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-xs shrink-0 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileView('LIST')}
                    className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Header Avatar */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {(activeStudent?.student_name || 'WA')
                      .split(' ')
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </div>

                  {/* Contact Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        {activeStudent?.student_name || 'WhatsApp Contact'}
                      </h3>
                      {activeStudent?.class_name && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-md shrink-0">
                          {activeStudent.class_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate">
                      {activeStudent?.parent_name && <span>Parent: {activeStudent.parent_name}</span>}
                      <span>&bull;</span>
                      <span className="font-mono">{activePhone}</span>
                    </div>
                  </div>
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Sibling Switcher (if multiple students share number) */}
                  {activeStudentsList.length > 1 && (
                    <div className="relative">
                      <select
                        value={activeStudentId || ''}
                        onChange={(e) => setActiveStudentId(Number(e.target.value))}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 rounded-xl cursor-pointer outline-hidden"
                      >
                        {activeStudentsList.map((s) => (
                          <option key={s.id} value={s.id}>
                            Sibling: {s.student_name} ({s.class_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Fees Due Badge */}
                  {activeStudent && Number(activeStudent.fees_due || 0) > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                      <IndianRupee className="w-3 h-3 text-amber-600" />
                      <span>Due: ₹{Number(activeStudent.fees_due).toLocaleString('en-IN')}</span>
                    </span>
                  )}

                  {/* Direct WhatsApp External link */}
                  <a
                    href={`https://wa.me/${activePhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors"
                    title="Open in WhatsApp Web"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Refresh Thread */}
                  <button
                    onClick={() => fetchActiveChat(activePhone, activeStudentId, true)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Refresh conversation"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Thread */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5"
                style={{
                  backgroundImage: `radial-gradient(#cbd5e1 0.75px, transparent 0.75px)`,
                  backgroundSize: '16px 16px',
                }}
              >
                {loadingChat ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <p className="text-xs font-medium">Loading full message history...</p>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <MessageCircle className="w-10 h-10 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">No message records yet</p>
                    <p className="text-[11px] text-slate-400">Send an individual notice or quick message below.</p>
                  </div>
                ) : (
                  activeMessages.map((msg, index) => {
                    const isOutbound = msg.direction === 'OUTBOUND';

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        {/* Bubble Container */}
                        <div
                          className={`max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl p-3 shadow-xs text-xs relative ${
                            isOutbound
                              ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-200/80 rounded-tr-xs'
                              : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs'
                          }`}
                        >
                          {/* Sender label */}
                          {!isOutbound && (
                            <div className="font-bold text-[11px] text-emerald-700 mb-1 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{msg.sender_name || activeStudent?.parent_name || 'Parent'}</span>
                            </div>
                          )}

                          {/* Template Badge if broadcast */}
                          {msg.template_name && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-900 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                              <FileCode className="w-3 h-3" />
                              <span>Template: {msg.template_name}</span>
                            </div>
                          )}

                          {/* Media Header (if attached) */}
                          {msg.media_url && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-slate-200/80 bg-black/5">
                              {msg.media_url.endsWith('.pdf') ? (
                                <a
                                  href={msg.media_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
                                >
                                  <span>View Attached PDF Document</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <img
                                  src={msg.media_url}
                                  alt="WhatsApp attachment"
                                  className="w-full max-h-48 object-cover rounded-lg"
                                />
                              )}
                            </div>
                          )}

                          {/* Message Body */}
                          <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-[13px]">
                            {msg.text_content}
                          </p>

                          {/* Message Metadata (Timestamp & Delivery Receipts) */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] mt-1 font-medium ${
                              isOutbound ? 'text-emerald-800/80' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatFullTime(msg.created_at)}</span>
                            {isOutbound && renderDeliveryTick(msg.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0">
                {/* Quick Action Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Send Quick Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplyText('Dear Parent, your payment receipt has been updated.')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors shrink-0"
                  >
                    "Receipt updated"
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplyText('Thank you for notifying us. We have marked the student present.')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors shrink-0"
                  >
                    "Attendance noted"
                  </button>
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <textarea
                    rows={1}
                    placeholder="Type a message to parent... (Press Enter to send)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all resize-none max-h-24"
                  />

                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Empty State when no conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                School WhatsApp Parent Hub
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1.5">
                Select a conversation from the left to read parent queries, verify fee receipts, and reply directly like WhatsApp Web.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Template Selector Modal ──────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Choose WhatsApp Template</h3>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-2">
              {templates.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No active Meta templates found.</p>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => handleSendTemplate(tpl)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{tpl.body_preview}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
