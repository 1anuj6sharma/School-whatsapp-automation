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
  Phone,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

export const ConversationDrawer = ({
  isOpen,
  onClose,
  studentId,
  phoneNumber,
  studentName: initialStudentName,
}) => {
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const identifier = studentId || phoneNumber;

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
      fetchConversation(true);
      // Auto-poll conversation updates every 4 seconds
      const interval = setInterval(() => {
        fetchConversation(false);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, identifier]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages, autoScroll]);

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

  if (!isOpen) return null;

  const student = conversation?.student;
  const rawMessages = conversation?.messages || [];
  // Exclude queued, failed, skipped, or unconfirmed sent messages; only show delivered, read, or inbound
  const messages = rawMessages.filter((msg) => {
    if (msg.direction === 'INBOUND') return true;
    const st = (msg.status || '').toUpperCase();
    return st === 'DELIVERED' || st === 'READ';
  });
  const displayName = student?.student_name || conversation?.recipient_name || initialStudentName || 'User Conversation';
  const displayPhone = student?.whatsapp_number || conversation?.phone_number || phoneNumber || '';

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

          {/* Chat Messages Container */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/80 space-y-3.5 relative"
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
                <p className="text-xs text-slate-500 max-w-xs">
                  Sent broadcast messages and parent replies for {displayName} will be stored and displayed here automatically.
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

                      {/* Media Image Attachment */}
                      {msg.media_url && (
                        <div className="mb-2.5 overflow-hidden rounded-xl border border-black/10 shadow-xs bg-black/5">
                          <img
                            src={
                              msg.media_url.startsWith('http') || msg.media_url.startsWith('data:')
                                ? msg.media_url
                                : `${window.location.origin}${msg.media_url.startsWith('/') ? '' : '/'}${msg.media_url}`
                            }
                            alt="Attachment"
                            className="w-full max-h-56 object-cover rounded-xl hover:opacity-95 transition-opacity cursor-pointer"
                            onClick={() => {
                              const fullUrl = msg.media_url.startsWith('http')
                                ? msg.media_url
                                : `${window.location.origin}${msg.media_url.startsWith('/') ? '' : '/'}${msg.media_url}`;
                              window.open(fullUrl, '_blank');
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

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

          {/* Footer note */}
          <div className="px-4 py-2.5 bg-white border-t border-slate-200 shrink-0 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              Live conversation thread synchronized with WhatsApp Cloud API & Webhooks.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

