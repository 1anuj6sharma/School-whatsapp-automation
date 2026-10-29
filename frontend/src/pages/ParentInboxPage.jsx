import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  ZoomIn,
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
  const fileInputRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const prevMessagesCountRef = useRef(0);

  // File Attachment State (Images & PDFs)
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [previewPdfModal, setPreviewPdfModal] = useState(null);

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
      // If user is at bottom, mark as read; if user is scrolled up, keep unread
      const shouldMark = isAtBottomRef.current;
      const data = await api.getConversation(identifier, { mark_read: shouldMark });
      setConversationData(data);

      if (shouldMark) {
        // Update unread count in local list
        setConversations((prev) =>
          prev.map((c) => {
            if (c.phone_number === phone || (studentId && c.student_id === studentId)) {
              return { ...c, unread_count: 0 };
            }
            return c;
          })
        );
      }
    } catch (err) {
      if (!isSilent) {
        console.error('Error loading chat:', err);
        showToast?.({
          type: 'error',
          title: 'Chat Load Error',
          message: err.message || 'Could not load messages for this parent.',
        });
      }
    } finally {
      if (!isSilent) setLoadingChat(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activePhone || activeStudentId) {
      fetchActiveChat(activePhone, activeStudentId);
    }
  }, [activePhone, activeStudentId, fetchActiveChat]);

  // Auto-poll conversation updates every 3.5 seconds so incoming messages auto-reflect!
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Silently refresh conversation list so new unread messages auto-reflect across all parents
      fetchConversations(true);

      // 2. Silently refresh active conversation if selected
      if (activePhone || activeStudentId) {
        fetchActiveChat(activePhone, activeStudentId, true);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activePhone, activeStudentId, fetchConversations, fetchActiveChat]);

  // Mark all unread inbound messages as READ when seen in current context
  const markActiveMessagesAsRead = useCallback(() => {
    const identifier = activeStudentId || activePhone;
    if (!identifier) return;

    // Update messages in conversationData immediately
    setConversationData((prev) => {
      if (!prev || !prev.messages) return prev;
      let hasUnread = false;
      const updatedMessages = prev.messages.map((m) => {
        if (m.direction === 'INBOUND' && (m.status === 'RECEIVED' || m.status === 'UNREAD')) {
          hasUnread = true;
          return { ...m, status: 'READ' };
        }
        return m;
      });
      return hasUnread ? { ...prev, messages: updatedMessages } : prev;
    });

    // Update conversation item unread_count in the list
    setConversations((prev) =>
      prev.map((c) => {
        if (c.phone_number === activePhone || (activeStudentId && c.student_id === activeStudentId)) {
          return { ...c, unread_count: 0 };
        }
        return c;
      })
    );

    // Call backend mark read endpoint
    api.markConversationRead(identifier);
  }, [activePhone, activeStudentId]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    setNewMessagesBelow(0);
    markActiveMessagesAsRead();
  }, [markActiveMessagesAsRead]);

  // Scroll event handler for chat thread
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setNewMessagesBelow(0);
      markActiveMessagesAsRead();
    }
  }, [markActiveMessagesAsRead]);

  // Auto scroll chat to bottom when messages update or user is already at bottom
  useEffect(() => {
    const msgs = conversationData?.messages || [];
    if (msgs.length > 0 && !loadingChat) {
      const prevCount = prevMessagesCountRef.current;
      const currentCount = msgs.length;
      prevMessagesCountRef.current = currentCount;

      if (isAtBottomRef.current) {
        scrollToBottom('smooth');
      } else if (currentCount > prevCount) {
        setNewMessagesBelow((prev) => prev + (currentCount - prevCount));
      }
    }
  }, [conversationData?.messages, loadingChat, scrollToBottom]);

  // Calculate unread count waiting below for the floating arrow button
  const unreadCountBelow = useMemo(() => {
    if (isAtBottom) return 0;
    const msgs = conversationData?.messages || [];
    const unreadInbound = msgs.filter(
      (m) => m.direction === 'INBOUND' && (m.status === 'RECEIVED' || m.status === 'UNREAD')
    ).length;
    return Math.max(unreadInbound, newMessagesBelow);
  }, [isAtBottom, conversationData?.messages, newMessagesBelow]);

  // Handle Select Conversation
  const handleSelectConversation = (conv) => {
    setActivePhone(conv.phone_number);
    setActiveStudentId(conv.student_id);
    setMobileView('CHAT');
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    setNewMessagesBelow(0);
    prevMessagesCountRef.current = 0;
  };

  // Handle File Selection (Photo or PDF)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast?.({
        type: 'error',
        title: 'File Too Large',
        message: 'File size must be under 25MB for WhatsApp.',
      });
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview({
          type: 'image',
          url: event.target.result,
          name: file.name,
          size: file.size,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview({
        type: 'pdf',
        name: file.name,
        size: file.size,
      });
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send Direct Message (Text or Media Attachment)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const textToSend = replyText.trim();
    if ((!textToSend && !selectedFile) || sending || uploadingMedia) return;

    setSending(true);

    try {
      let uploadedMediaUrl = null;
      let detectedMediaType = null;
      let uploadedFilename = null;

      if (selectedFile) {
        setUploadingMedia(true);
        try {
          const uploadRes = await api.uploadMedia(selectedFile);
          uploadedMediaUrl = uploadRes.relative_url || uploadRes.url;
          uploadedFilename = selectedFile.name;
          const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
          detectedMediaType = uploadRes.file_type || (isPdf ? 'document' : 'image');
        } catch (uploadErr) {
          throw new Error(`Media upload failed: ${uploadErr.message || 'Could not upload attachment'}`);
        } finally {
          setUploadingMedia(false);
        }
      }

      const payload = {
        phone_number: activePhone,
        student_id: activeStudentId,
        message: textToSend,
      };

      if (uploadedMediaUrl) {
        payload.media_url = uploadedMediaUrl;
        payload.media_type = detectedMediaType;
        payload.filename = uploadedFilename;
      }

      await api.sendConversationMessage(payload);
      setReplyText('');
      handleClearFile();
      showToast?.({
        type: 'success',
        title: selectedFile ? 'Attachment Sent' : 'Message Sent',
        message: selectedFile ? 'Photo/document sent successfully.' : 'Message delivered to parent via WhatsApp.',
      });

      // Reload chat messages and list
      await fetchActiveChat(activePhone, activeStudentId, true);
      fetchConversations(true);
      setTimeout(() => scrollToBottom('smooth'), 120);
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast?.({
        type: 'error',
        title: 'Send Failed',
        message: err.message || 'Could not send WhatsApp message.',
      });
    } finally {
      setSending(false);
      setUploadingMedia(false);
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
                    {(activeStudent?.student_name || conversationData?.recipient_name || 'WA')
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
                        {activeStudent?.student_name || conversationData?.recipient_name || 'WhatsApp Contact'}
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
              <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
                <div
                  ref={chatContainerRef}
                  onScroll={handleScroll}
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
                                <span>{msg.sender_name || activeStudent?.parent_name || activeStudent?.student_name || 'Parent'}</span>
                              </div>
                            )}

                            {/* Template Badge if broadcast */}
                            {msg.template_name && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-900 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                                <FileCode className="w-3 h-3" />
                                <span>Template: {msg.template_name}</span>
                              </div>
                            )}

                            {/* Media Header (Photo / PDF Document) */}
                            {(() => {
                              const effectiveMediaUrl = msg.media_url || (
                                msg.message_type === 'image' && msg.raw_payload?.image?.id
                                  ? `/api/media/whatsapp/${msg.raw_payload.image.id}`
                                  : (msg.raw_payload?.document?.id ? `/api/media/whatsapp/${msg.raw_payload.document.id}` : null)
                              );
                              if (!effectiveMediaUrl) return null;

                              const fullUrl = effectiveMediaUrl.startsWith('http') || effectiveMediaUrl.startsWith('data:')
                                ? effectiveMediaUrl
                                : `${window.location.origin}${effectiveMediaUrl.startsWith('/') ? '' : '/'}${effectiveMediaUrl}`;
                              const isPdf = effectiveMediaUrl.toLowerCase().endsWith('.pdf') || 
                                msg.message_type === 'document' || 
                                Boolean(msg.raw_payload?.document) ||
                                (msg.text_content && msg.text_content.toLowerCase().includes('document'));

                              if (isPdf) {
                                const docName = msg.raw_payload?.document?.filename || 
                                  (msg.text_content?.startsWith('📄 Document: ') ? msg.text_content.replace('📄 Document: ', '') : null) ||
                                  (effectiveMediaUrl.endsWith('.pdf') ? effectiveMediaUrl.split('/').pop().replace(/^[a-f0-9]+_/, '') : null) || 
                                  'Document.pdf';
                                return (
                                  <div
                                    className={`mb-2 p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition-all shadow-xs ${
                                      isOutbound
                                        ? 'bg-emerald-200/60 border-emerald-300 text-emerald-950'
                                        : 'bg-slate-50 border-slate-200/90 text-slate-800'
                                    }`}
                                  >
                                    <div 
                                      onClick={() => setPreviewPdfModal({ url: fullUrl, name: docName })}
                                      className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                                      title="Click to view PDF"
                                    >
                                      <div className={`p-2 rounded-xl shrink-0 shadow-xs ${isOutbound ? 'bg-emerald-300/80 text-emerald-900' : 'bg-rose-100 text-rose-600'}`}>
                                        <FileText className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]" title={docName}>
                                          {docName}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          PDF Document &bull; WhatsApp Attachment
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPdfModal({ url: fullUrl, name: docName })}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-2xs"
                                        title="View PDF directly in chat"
                                      >
                                        <ZoomIn className="w-3.5 h-3.5" />
                                        <span>View</span>
                                      </button>
                                      <a
                                        href={fullUrl}
                                        download={docName}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer bg-slate-200 hover:bg-slate-300 text-slate-700"
                                        title="Download or open PDF file"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="relative group/img mb-2 overflow-hidden rounded-xl border border-black/10 shadow-xs bg-slate-900/5">
                                  <img
                                    src={fullUrl}
                                    alt="WhatsApp photo attachment"
                                    className="w-full max-h-64 object-cover rounded-xl transition-all duration-300 group-hover/img:scale-[1.02] cursor-pointer"
                                    onClick={() => setPreviewImageModal({ url: fullUrl, name: msg.sender_name || activeStudent?.parent_name || 'Parent Photo' })}
                                    loading="lazy"
                                  />
                                  <div
                                    onClick={() => setPreviewImageModal({ url: fullUrl, name: msg.sender_name || activeStudent?.parent_name || 'Parent Photo' })}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer text-white text-xs font-semibold backdrop-blur-2xs"
                                  >
                                    <ZoomIn className="w-4 h-4" />
                                    <span>Click to View Photo</span>
                                  </div>
                                </div>
                              );
                            })()}

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

                {/* WhatsApp-style Floating Scroll to Bottom Arrow Button */}
                {!isAtBottom && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-800/95 hover:bg-slate-900 text-white shadow-xl border border-slate-700/90 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 group focus:outline-none cursor-pointer"
                    title="Scroll to latest message"
                    aria-label="Scroll to bottom"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-200 group-hover:translate-y-0.5 transition-transform" />
                    {unreadCountBelow > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-pulse">
                        {unreadCountBelow > 99 ? '99+' : unreadCountBelow}
                      </span>
                    )}
                  </button>
                )}
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

                {/* Attachment Preview Strip */}
                {filePreview && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 animate-fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {filePreview.type === 'image' && filePreview.url ? (
                        <img
                          src={filePreview.url}
                          alt="Preview"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]" title={filePreview.name}>
                          {filePreview.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {filePreview.type === 'pdf' ? 'PDF Document' : 'Image'} &bull; {(filePreview.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingMedia}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-slate-200 shrink-0 flex items-center justify-center cursor-pointer"
                    title="Attach Photo or PDF Document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <textarea
                    rows={1}
                    placeholder={selectedFile ? `Add an optional caption for ${selectedFile.name}... (Press Enter to send)` : 'Type a message to parent... (Press Enter to send)'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sending || uploadingMedia}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all resize-none max-h-24"
                  />

                  <button
                    type="submit"
                    disabled={(!replyText.trim() && !selectedFile) || sending || uploadingMedia}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    title={selectedFile ? 'Send WhatsApp Attachment' : 'Send WhatsApp Message'}
                  >
                    {sending || uploadingMedia ? (
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

      {/* Enlarged Photo Preview Lightbox Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 text-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold truncate">{previewImageModal.name || 'Parent Photo Attachment'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewImageModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
                <a
                  href={previewImageModal.url}
                  download="whatsapp_photo.jpg"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download image file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 flex items-center justify-center overflow-auto max-h-[calc(90vh-65px)] bg-black/40">
              <img
                src={previewImageModal.url}
                alt="Parent Photo Preview"
                className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Interactive PDF Preview Modal */}
      {previewPdfModal && (
        <div
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
          onClick={() => setPreviewPdfModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 text-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <FileText className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold truncate block max-w-xs sm:max-w-md">
                    {previewPdfModal.name || 'PDF Document'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PDF Document Viewer
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewPdfModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>
                <a
                  href={previewPdfModal.url}
                  download={previewPdfModal.name || 'document.pdf'}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPdfModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="w-full h-[76vh] bg-slate-100 flex flex-col">
              <iframe
                src={previewPdfModal.url}
                title={previewPdfModal.name || 'PDF Document Preview'}
                className="w-full h-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
