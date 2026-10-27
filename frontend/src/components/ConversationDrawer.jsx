import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  RefreshCw,
  MessageSquare,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  User,
  Users,
  Phone,
  Sparkles,
  Send,
  Loader2,
  ChevronDown,
  FileText,
  AlertTriangle,
  Paperclip,
  Download,
  Image as ImageIcon,
  ZoomIn,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

export const ConversationDrawer = ({
  isOpen,
  onClose,
  studentId,
  phoneNumber,
  studentName: initialStudentName,
  canSendMessage = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(studentId || null);

  useEffect(() => {
    if (studentId) {
      setActiveStudentId(studentId);
    }
  }, [studentId]);

  // File attachment state (PDF / Images / Fee receipts)
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [previewPdfModal, setPreviewPdfModal] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const identifier = studentId || phoneNumber;

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    setUnreadCount(0);
  };

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Check if user is near bottom (within 80px)
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadCount(0);
    }
  };

  const fetchConversation = async (showLoading = true) => {
    if (!identifier) return;
    if (showLoading) setLoading(true);
    try {
      const data = await api.getConversation(identifier);
      setConversation(data);
    } catch (err) {
      console.error('Failed to fetch conversation history', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && identifier) {
      initialScrollDoneRef.current = false;
      prevMessagesCountRef.current = 0;
      setIsAtBottom(true);
      isAtBottomRef.current = true;
      setUnreadCount(0);
      fetchConversation(true);
      setSendError('');
      // Auto-poll conversation updates every 4 seconds
      const interval = setInterval(() => {
        fetchConversation(false);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, identifier]);

  useEffect(() => {
    if (!isOpen) return;
    const currentMessages = conversation?.messages || [];
    const currentCount = currentMessages.length;
    const prevCount = prevMessagesCountRef.current;

    if (currentCount === 0) return;

    // Initial load for this conversation
    if (!initialScrollDoneRef.current) {
      setTimeout(() => {
        scrollToBottom('auto');
        initialScrollDoneRef.current = true;
      }, 60);
      prevMessagesCountRef.current = currentCount;
      return;
    }

    // New messages arrived while conversation is open
    if (currentCount > prevCount) {
      const newIncoming = currentCount - prevCount;
      if (isAtBottomRef.current) {
        // User was already at the bottom: smoothly scroll to bottom to view new messages
        scrollToBottom('smooth');
      } else {
        // User is scrolled up reading earlier history:
        // DO NOT scroll! Keep position fixed and increment unread badge counter
        setUnreadCount((prev) => prev + newIncoming);
      }
    }

    prevMessagesCountRef.current = currentCount;
  }, [conversation?.messages, isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load templates when toggled
  useEffect(() => {
    if (showTemplates && templates.length === 0) {
      setLoadingTemplates(true);
      api.getTemplates()
        .then((res) => {
          const list = Array.isArray(res) ? res : res.results || [];
          setTemplates(list.filter((t) => (t.status || '').toUpperCase() === 'APPROVED'));
        })
        .catch((err) => console.error('Failed to load templates:', err))
        .finally(() => setLoadingTemplates(false));
    }
  }, [showTemplates, templates.length]);

  if (!isOpen) return null;

  const allStudents = conversation?.students && conversation.students.length > 0
    ? conversation.students
    : (conversation?.student ? [conversation.student] : []);

  const student = (activeStudentId && allStudents.find((s) => s.id === activeStudentId))
    || conversation?.student
    || allStudents[0]
    || null;

  const rawMessages = conversation?.messages || [];
  // Exclude queued, failed, skipped, or unconfirmed sent messages; only show delivered, read, or inbound
  const messages = rawMessages.filter((msg) => {
    if (msg.direction === 'INBOUND') return true;
    const st = (msg.status || '').toUpperCase();
    return st === 'DELIVERED' || st === 'READ' || st === 'SENT';
  });
  const displayName = student?.student_name || conversation?.recipient_name || initialStudentName || 'User Conversation';
  const displayPhone = student?.whatsapp_number || conversation?.phone_number || phoneNumber || '';

  // Determine WhatsApp 24-hour customer service window status
  const lastInboundMsg = [...messages].reverse().find((m) => m.direction === 'INBOUND');
  const windowStatus = (() => {
    if (!lastInboundMsg?.created_at) {
      return {
        isActive: false,
        label: '24h Window Inactive',
        remainingText: '',
        tooltip: 'No inbound message received from parent yet. Direct text might be restricted by Meta; approved Templates can be sent anytime.',
      };
    }
    const msgTime = new Date(lastInboundMsg.created_at).getTime();
    const elapsedMs = Date.now() - msgTime;
    const windowDurationMs = 24 * 60 * 60 * 1000;
    if (elapsedMs < windowDurationMs && elapsedMs >= 0) {
      const remainingMs = windowDurationMs - elapsedMs;
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      return {
        isActive: true,
        label: '24h Window Active',
        remainingText: `${hours}h ${minutes}m left`,
        tooltip: `Active 24h WhatsApp conversation window (${hours}h ${minutes}m left). Direct custom chat replies allowed.`,
      };
    }
    return {
      isActive: false,
      label: '24h Window Expired',
      remainingText: '',
      tooltip: 'More than 24 hours have elapsed since the parent last replied. Use Templates to reach out.',
    };
  })();

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSendError('');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setSendError('Unsupported file type. Please select a PDF document or an image (JPG, PNG, WEBP).');
      return;
    }

    const maxSize = isPdf ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSendError(`File exceeds maximum allowed size (${isPdf ? '15MB for PDF' : '5MB for Image'}).`);
      return;
    }

    setSelectedFile(file);
    if (isImage) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview({
        type: 'image',
        url: previewUrl,
        name: file.name,
        size: file.size,
      });
    } else {
      setFilePreview({
        type: 'document',
        url: null,
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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if ((!text && !selectedFile) || sending || uploadingMedia) return;

    setSending(true);
    setSendError('');
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
        phone_number: displayPhone,
        student_id: student?.id || studentId || null,
        message: text,
      };

      if (uploadedMediaUrl) {
        payload.media_url = uploadedMediaUrl;
        payload.media_type = detectedMediaType;
        payload.filename = uploadedFilename;
      }

      const res = await api.sendConversationMessage(payload);
      if (res && res.success !== false) {
        setInputMessage('');
        handleClearFile();
        await fetchConversation(false);
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 150);
      } else {
        const errMsg = res?.error || 'Failed to send WhatsApp message.';
        setSendError(errMsg);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  const handleSendTemplate = async (tpl) => {
    if (!tpl || sending) return;
    setSending(true);
    setSendError('');
    try {
      const payload = {
        phone_number: displayPhone,
        student_id: student?.id || studentId || null,
        template_name: tpl.name,
        language_code: tpl.language || 'en_US',
      };
      const res = await api.sendConversationMessage(payload);
      if (res && res.success !== false) {
        setShowTemplates(false);
        await fetchConversation(false);
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 150);
      } else {
        setSendError(res?.error || 'Failed to send template message.');
      }
    } catch (err) {
      console.error('Error sending template:', err);
      setSendError(err.message || 'Failed to send template message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render message status ticks
  const renderStatus = (msg) => {
    if (msg.direction === 'INBOUND') return null;

    const st = (msg.status || '').toUpperCase();
    if (st === 'READ') {
      return (
        <span className="inline-flex items-center text-sky-500" title="Read (Blue Ticks)">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }
    if (st === 'DELIVERED') {
      return (
        <span className="inline-flex items-center text-slate-400" title="Delivered">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }
    if (st === 'SENT') {
      return (
        <span className="inline-flex items-center text-slate-400" title="Sent to WhatsApp">
          <Check className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }
    if (st === 'FAILED') {
      return (
        <span className="inline-flex items-center text-rose-500" title="Failed to deliver">
          <AlertCircle className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-slate-400" title="Queued">
        <Clock className="w-3 h-3 stroke-[2]" />
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col transform transition-all duration-300 ease-in-out border-l border-slate-200 animate-slide-left">
          
          {/* Top Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 shrink-0 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-bold text-base border border-white/20 shrink-0 shadow-inner">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white tracking-tight truncate">
                    {displayName}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30">
                    WhatsApp Live
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      windowStatus.isActive
                        ? 'bg-emerald-300/25 text-emerald-100 border-emerald-300/40'
                        : 'bg-amber-400/20 text-amber-100 border-amber-400/30'
                    }`}
                    title={windowStatus.tooltip}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>{windowStatus.isActive ? `24h: ${windowStatus.remainingText}` : '24h Inactive'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-100/80 font-mono mt-0.5 truncate">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{displayPhone}</span>
                  {student?.class_name && (
                    <>
                      <span>•</span>
                      <span className="font-sans truncate">{student.class_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => fetchConversation(true)}
                className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
                title="Refresh Chat"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sibling Switcher Bar if multiple students share this phone number */}
          {allStudents.length > 1 && (
            <div className="bg-emerald-900/60 border-b border-emerald-700/60 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
              <span className="text-[11px] font-semibold text-emerald-200 shrink-0 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-300" />
                <span>Siblings ({allStudents.length}):</span>
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                {allStudents.map((s) => {
                  const isSelected = student?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveStudentId(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-white/60'
                          : 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700/80 hover:text-white'
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{s.student_name}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/40 text-emerald-300'
                        }`}
                      >
                        {s.class_name || 'Class'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student Info Bar if student details exist */}
          {student && (
            <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between text-xs text-slate-700 shrink-0">
              <div className="flex items-center gap-3 truncate">
                {student.parent_name && (
                  <span className="truncate">
                    <strong className="font-semibold text-slate-900">Parent:</strong> {student.parent_name}
                  </span>
                )}
                {Number(student.fees_due || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                    Fees Due: ₹{Number(student.fees_due).toLocaleString()}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>
          )}

          {/* Chat Messages Container Area */}
          <div className="flex-1 relative min-h-0 flex flex-col">
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/80 space-y-3.5"
              style={{
                backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.04) 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }}
            >
            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs font-medium">Loading conversation history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">No conversation history yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mb-3">
                  Send a WhatsApp message or template below to start the conversation with {displayName}.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOutbound = msg.direction === 'OUTBOUND';
                const formattedTime = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                const formattedDate = msg.created_at
                  ? new Date(msg.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })
                  : '';

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} group`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 shadow-xs transition-all relative ${
                        isOutbound
                          ? 'bg-emerald-600 text-white rounded-tr-xs'
                          : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs shadow-slate-100'
                      }`}
                    >
                      {/* Message Tag (Template or Sender Name) */}
                      {isOutbound && msg.template_name && (
                        <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-emerald-500/50">
                          <Sparkles className="w-3 h-3 text-emerald-200" />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                            {msg.template_name}
                          </span>
                        </div>
                      )}

                      {!isOutbound && (
                        <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-100">
                          <User className="w-3 h-3 text-emerald-600" />
                          <span className="font-semibold text-[11px] text-emerald-700">
                            {msg.sender_name || displayName}
                          </span>
                        </div>
                      )}

                      {/* Media Attachment: PDF Document or Image */}
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
                              className={`mb-2.5 p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all shadow-xs ${
                                isOutbound
                                  ? 'bg-emerald-700/80 border-emerald-500/50 text-white'
                                  : 'bg-slate-50 border-slate-200/90 text-slate-800'
                              }`}
                            >
                              <div 
                                onClick={() => setPreviewPdfModal({ url: fullUrl, name: docName })}
                                className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                                title="Click to view PDF"
                              >
                                <div className={`p-2 rounded-xl shrink-0 shadow-xs ${isOutbound ? 'bg-emerald-800/90 text-rose-200' : 'bg-rose-100 text-rose-600'}`}>
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate max-w-[150px] sm:max-w-[180px]" title={docName}>
                                    {docName}
                                  </p>
                                  <p className={`text-[10px] ${isOutbound ? 'text-emerald-200' : 'text-slate-400'}`}>
                                    PDF Document &bull; WhatsApp Attachment
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPdfModal({ url: fullUrl, name: docName })}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                    isOutbound
                                      ? 'bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                                  }`}
                                  title="View PDF directly in chat"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                  <span>View PDF</span>
                                </button>
                                <a
                                  href={fullUrl}
                                  download={docName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                    isOutbound
                                      ? 'bg-emerald-800/80 hover:bg-emerald-800 text-white'
                                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                  }`}
                                  title="Download or open PDF file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="relative group/img mb-2.5 overflow-hidden rounded-xl border border-black/10 shadow-xs bg-slate-900/5">
                            <img
                              src={fullUrl}
                              alt="WhatsApp photo attachment"
                              className="w-full max-h-64 object-cover rounded-xl transition-all duration-300 group-hover/img:scale-[1.02] cursor-pointer"
                              onClick={() => setPreviewImageModal({ url: fullUrl, name: msg.sender_name || displayName })}
                              loading="lazy"
                            />
                            <div
                              onClick={() => setPreviewImageModal({ url: fullUrl, name: msg.sender_name || displayName })}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer text-white text-xs font-semibold backdrop-blur-2xs"
                            >
                              <ZoomIn className="w-4 h-4" />
                              <span>Click to View Photo</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Content Body */}
                      <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans">
                        {msg.text_content || `[${msg.message_type || 'Message'}]`}
                      </p>

                      {/* Time and Status Footer */}
                      <div
                        className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-mono select-none ${
                          isOutbound ? 'text-emerald-100/90' : 'text-slate-400'
                        }`}
                      >
                        <span>{formattedDate} {formattedTime}</span>
                        {renderStatus(msg)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
              <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp-style Floating Scroll to Bottom Button */}
            {!isAtBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200/90 flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all transform hover:scale-105 active:scale-95 group focus:outline-none cursor-pointer"
                title="Scroll to latest message"
                aria-label="Scroll to bottom"
              >
                <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-bounce">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Conditional Messaging or Read-only Footer */}
          {canSendMessage ? (
            <>
              {/* Template Selection Overlay / Dropdown */}
              {showTemplates && (
                <div className="bg-slate-50 border-t border-slate-200 p-3 max-h-60 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Select Approved WhatsApp Template
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTemplates(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {loadingTemplates ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-1 text-emerald-600" /> Loading templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-500">
                      No approved templates found. You can send direct text messages below.
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.id || tpl.name}
                        className="p-2.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => handleSendTemplate(tpl)}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 font-mono">{tpl.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{tpl.body_preview || tpl.category}</div>
                        </div>
                        <button
                          type="button"
                          disabled={sending}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors shrink-0"
                        >
                          Send
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Send Error Notice */}
              {sendError && (
                <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-700">
                  <div className="flex items-center gap-2 truncate">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="truncate">{sendError}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplates(true);
                        setSendError('');
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors"
                    >
                      Use Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendError('')}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Chat Input Area */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        showTemplates
                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      {showTemplates ? 'Hide Templates' : 'Templates'}
                    </button>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        windowStatus.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                      title={windowStatus.tooltip}
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        {windowStatus.isActive
                          ? `24h Window: ${windowStatus.remainingText}`
                          : '24h Window Closed (Use Templates)'}
                      </span>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {inputMessage.length > 0 ? `${inputMessage.length} chars` : 'Enter ↵ to send'}
                  </span>
                </div>

                {/* Attachment Preview Strip */}
                {filePreview && (
                  <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 animate-fade-in">
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
                          {filePreview.type === 'document' ? 'PDF Document' : 'Image'} &bull; {(filePreview.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingMedia}
                    className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-slate-200 shrink-0 flex items-center justify-center"
                    title="Attach PDF Fee Receipt, Report Card, or Image"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedFile ? `Add an optional caption for ${selectedFile.name}...` : `Type a WhatsApp message to ${displayName}...`}
                      rows={2}
                      disabled={sending || uploadingMedia}
                      className="w-full resize-none px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending || uploadingMedia || (!inputMessage.trim() && !selectedFile)}
                    className="p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-md shadow-emerald-600/20 shrink-0 flex items-center justify-center"
                    title={selectedFile ? 'Send WhatsApp Attachment' : 'Send WhatsApp Message'}
                  >
                    {sending || uploadingMedia ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Read-only Footer Note for Message Logs */
            <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                Live conversation thread synchronized with WhatsApp Cloud API & Webhooks.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Enlarged Photo Preview Modal */}
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
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
                <a
                  href={previewImageModal.url}
                  download="whatsapp_photo.jpg"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Download image file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
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
            className="relative max-w-4xl max-h-[92vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col animate-scale-in"
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
};
