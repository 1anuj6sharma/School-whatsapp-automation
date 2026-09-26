import React, { useEffect, useState, useRef } from 'react';
import {
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  RefreshCw,
  Plus,
  ExternalLink,
  Clock,
  XCircle,
  Sparkles,
  Eye,
  HelpCircle,
  Trash2,
  Image as ImageIcon,
  Upload,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';

export const TemplatesPage = ({ onNavigateToSend, showToast }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Template Form State
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState('NONE'); // NONE, IMAGE, TEXT
  const [headerText, setHeaderText] = useState('');
  const [sampleImageUrl, setSampleImageUrl] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [bodyText, setBodyText] = useState('');
  const [sampleValues, setSampleValues] = useState({});

  const pollingRef = useRef(null);

  // Fetch templates from DB (which auto-syncs if empty)
  const fetchTemplates = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates', err);
      if (!silent && showToast) {
        showToast({
          type: 'error',
          title: 'Failed to fetch templates',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Sync directly from Meta WhatsApp Manager
  const handleSyncMeta = async () => {
    setSyncing(true);
    try {
      const result = await api.syncTemplates();
      if (showToast) {
        showToast({
          type: 'success',
          title: 'Meta Templates Synchronized',
          message: `Synced ${result.count || result.length || 0} templates directly from Meta WhatsApp Manager.`,
        });
      }
      await fetchTemplates(true);
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Meta Sync Failed',
          message: err instanceof Error ? err.message : 'Could not connect to Meta Graph API.',
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Auto-polling when there are PENDING templates
  useEffect(() => {
    const hasPending = templates.some(
      (t) => t.status === 'PENDING' || t.status === 'IN_REVIEW' || t.status === 'IN_APPEAL'
    );

    if (hasPending) {
      pollingRef.current = setInterval(async () => {
        try {
          await api.syncTemplates();
          const updated = await api.getTemplates();
          setTemplates(updated);
        } catch (e) {
          console.debug('Background template poll failed:', e);
        }
      }, 10000); // Check Meta every 10s
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [templates]);

  // Detect variable placeholders like {{1}}, {{2}} in body text
  const detectedVariables = React.useMemo(() => {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [bodyText]);

  // Insert {{1}}, {{2}}, etc. at cursor or end
  const handleInsertVariable = () => {
    const nextNum = detectedVariables.length + 1;
    setBodyText((prev) => `${prev} {{${nextNum}}}`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    try {
      const objectUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(objectUrl);
    } catch (_) {}

    setImageUploading(true);
    try {
      const res = await api.uploadMedia(file);
      if (res.url) {
        setSampleImageUrl(res.url);
        if (showToast) {
          showToast({
            type: 'success',
            title: 'Sample Image Uploaded',
            message: 'Image hosted and attached to template sample.',
          });
        }
      }
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Image Upload Failed',
          message: err instanceof Error ? err.message : 'Could not upload image.',
        });
      }
    } finally {
      setImageUploading(false);
    }
  };

  // Real-time preview with substituted sample values
  const getPreviewText = () => {
    if (!bodyText.trim()) return 'Your message template text will appear here...';
    let preview = bodyText;
    detectedVariables.forEach((num) => {
      const sample = sampleValues[num] || `[Sample ${num}]`;
      preview = preview.replaceAll(`{{${num}}}`, sample);
    });
    return preview;
  };

  // Create Template submission to Meta
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      if (showToast) showToast({ type: 'warning', title: 'Please enter a template name' });
      return;
    }
    if (!bodyText.trim()) {
      if (showToast) showToast({ type: 'warning', title: 'Please enter body text' });
      return;
    }

    if (headerType === 'TEXT' && !headerText.trim()) {
      if (showToast) showToast({ type: 'warning', title: 'Please enter Header Text' });
      return;
    }

    // Check if sample values are filled for each detected variable
    for (const v of detectedVariables) {
      if (!sampleValues[v] || !sampleValues[v].trim()) {
        if (showToast) {
          showToast({
            type: 'warning',
            title: 'Sample Value Required',
            message: `Meta requires a sample value for placeholder {{${v}}}.`,
          });
        }
        return;
      }
    }

    const orderedSamples = detectedVariables.map((v) => sampleValues[v].trim());

    setIsSubmitting(true);
    try {
      await api.createTemplate({
        name: templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category,
        language,
        header_type: headerType,
        header_text: headerType === 'TEXT' ? headerText.trim() : null,
        sample_image_url: headerType === 'IMAGE' ? sampleImageUrl.trim() : null,
        body_text: bodyText,
        sample_values: orderedSamples,
        description: `Created from School WhatsApp UI on ${new Date().toLocaleDateString()}` + (headerType === 'IMAGE' ? ' [Image Header]' : ''),
      });

      if (showToast) {
        showToast({
          type: 'success',
          title: 'Template Created on Meta!',
          message: `Template '${templateName}' submitted to Meta. Status is now PENDING review.`,
        });
      }

      setShowCreateModal(false);
      setTemplateName('');
      setHeaderType('NONE');
      setHeaderText('');
      setSampleImageUrl('');
      setBodyText('');
      setSampleValues({});
      await fetchTemplates(true);
    } catch (err) {
      if (showToast) {
        showToast({
          type: 'error',
          title: 'Meta Template Creation Failed',
          message: err instanceof Error ? err.message : 'Error submitting template to Meta.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return tpl.status === 'ACTIVE' || tpl.status === 'APPROVED';
    if (filterStatus === 'PENDING') return tpl.status === 'PENDING' || tpl.status === 'IN_REVIEW';
    if (filterStatus === 'REJECTED') return tpl.status === 'REJECTED';
    return true;
  });

  const activeCount = templates.filter((t) => t.status === 'ACTIVE' || t.status === 'APPROVED').length;
  const pendingCount = templates.filter((t) => t.status === 'PENDING' || t.status === 'IN_REVIEW').length;
  const rejectedCount = templates.filter((t) => t.status === 'REJECTED').length;

  if (loading) {
    return <LoadingSpinner message="Fetching templates directly from Meta WhatsApp Manager..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileCode className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Meta WhatsApp Templates</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time synchronization with Meta WhatsApp Template Manager
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSyncMeta}
            disabled={syncing}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync with Meta'}</span>
          </button>

          {/* Create Template Button */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>

          {/* Broadcast Link */}
          <button
            type="button"
            onClick={onNavigateToSend}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <span>Broadcast</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta Manager Info Banner */}
      <div className="bg-sky-50/80 p-4 rounded-2xl border border-sky-200 text-xs text-sky-900 flex items-start justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sky-950 text-sm">Meta Review &amp; Approval Process</h4>
            <p className="text-sky-900/90 leading-relaxed font-sans">
              Templates created here (including <strong>Image Header</strong> templates) are sent directly to Meta Graph API and placed in <strong>PENDING</strong> review. Meta typically approves templates within 1 to 5 minutes. As soon as approved, status updates live to <strong>ACTIVE</strong>.
            </p>
          </div>
        </div>

        <a
          href="https://business.facebook.com/latest/whatsapp_manager/message_templates/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100/80 hover:bg-sky-200/80 text-sky-900 font-semibold text-[11px] whitespace-nowrap transition-colors"
        >
          <span>Open Meta Manager</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              filterStatus === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              filterStatus === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({pendingCount})</span>
          </button>
          {rejectedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                filterStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected ({rejectedCount})</span>
            </button>
          )}
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-700 font-medium animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Live auto-checking Meta review status every 10s...</span>
          </div>
        )}
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <FileCode className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No templates found in this tab</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click &quot;Sync with Meta&quot; to fetch latest templates from your Meta account or &quot;Create Template&quot; to add one.
          </p>
          <button
            type="button"
            onClick={handleSyncMeta}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync with Meta Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTemplates.map((tpl) => {
            const isActive = tpl.status === 'ACTIVE' || tpl.status === 'APPROVED';
            const isPending = tpl.status === 'PENDING' || tpl.status === 'IN_REVIEW';
            const isRejected = tpl.status === 'REJECTED';
            const isImageTemplate = tpl.header_type === 'IMAGE';

            return (
              <div
                key={tpl.id}
                className={`bg-white p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-xs ${
                  isActive
                    ? 'border-emerald-300 hover:border-emerald-400 hover:shadow-sm'
                    : isPending
                    ? 'border-amber-300 bg-amber-50/10 hover:border-amber-400'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-black text-slate-900">{tpl.name}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {tpl.category}
                      </span>
                      {isImageTemplate && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>Image Header</span>
                        </span>
                      )}
                      {tpl.meta_template_id && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ID: {tpl.meta_template_id}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={tpl.status} />
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">{tpl.description}</p>
                  )}

                  {/* Simulated Bubble Preview */}
                  <div className="rounded-xl whatsapp-chat-bg border border-slate-300 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Message Preview ({tpl.language})
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">WhatsApp Cloud API</span>
                    </div>

                    <div className="whatsapp-bubble-received p-3.5 text-slate-900 text-xs whitespace-pre-wrap leading-relaxed shadow-xs border border-slate-200/50 font-sans space-y-2.5">
                      {isImageTemplate && (
                        <div className="w-full h-32 rounded-xl bg-gradient-to-br from-purple-50 to-slate-100 border border-purple-200/80 flex flex-col items-center justify-center text-slate-400 gap-1 overflow-hidden relative shadow-inner">
                          {tpl.sample_image_url ? (
                            <img
                              src={tpl.sample_image_url}
                              alt="Template header"
                              className="w-full h-full object-cover rounded-xl"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="flex flex-col items-center justify-center gap-1 text-purple-700 py-3 text-center pointer-events-none">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold text-purple-900">Image Header Template</span>
                            <span className="text-[9px] text-purple-600 font-medium">Dynamic image attached per campaign broadcast</span>
                          </div>
                        </div>
                      )}

                      {tpl.header_type === 'TEXT' && tpl.header_text && (
                        <p className="font-black text-slate-900 text-xs border-b border-slate-200 pb-1">{tpl.header_text}</p>
                      )}

                      <div>
                        {tpl.name === 'hello_world' ? (
                          <>
                            <p className="font-bold text-slate-900">Hello World</p>
                            <p className="mt-1 text-slate-700">
                              Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.
                            </p>
                          </>
                        ) : (
                          tpl.body_preview || 'No preview available.'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">Language: {tpl.language}</span>

                  {isActive ? (
                    <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready for Broadcast</span>
                    </span>
                  ) : isPending ? (
                    <span className="flex items-center gap-1.5 font-bold text-amber-700 animate-pulse">
                      <Clock className="w-4 h-4" />
                      <span>In Review with Meta</span>
                    </span>
                  ) : isRejected ? (
                    <span className="flex items-center gap-1.5 font-bold text-rose-700">
                      <XCircle className="w-4 h-4" />
                      <span>Rejected by Meta</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{tpl.status}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Template on Meta */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New WhatsApp Template (Meta Graph API)"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5 text-slate-900">
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <p>
              Submitting this form creates a template directly in your <strong>Meta WhatsApp Business Account</strong>. Supports standard text or <strong>Image Media Headers</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Template Name */}
            <div className="sm:col-span-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-900">
                Template Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g. annual_sports_day"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
              />
              <span className="text-[10px] text-slate-400 block font-sans">
                Only lowercase &amp; underscores.
              </span>
            </div>

            {/* Category */}
            <div className="sm:col-span-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-900">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
              >
                <option value="UTILITY">UTILITY (School Notices, Fees, Attendance)</option>
                <option value="MARKETING">MARKETING (Admissions, Events, Photos)</option>
                <option value="AUTHENTICATION">AUTHENTICATION (OTP, Verification)</option>
              </select>
            </div>

            {/* Language */}
            <div className="sm:col-span-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-900">
                Language <span className="text-rose-600">*</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
              >
                <option value="en_US">English (US) - en_US</option>
                <option value="en_GB">English (UK) - en_GB</option>
                <option value="en">English - en</option>
                <option value="hi">Hindi - hi</option>
              </select>
            </div>
          </div>

          {/* Header Format Selection */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Template Header Type (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-500">Optional top media / text banner</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setHeaderType('NONE')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  headerType === 'NONE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                None (Text Body Only)
              </button>
              <button
                type="button"
                onClick={() => setHeaderType('IMAGE')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  headerType === 'IMAGE'
                    ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>Image Header</span>
              </button>
              <button
                type="button"
                onClick={() => setHeaderType('TEXT')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  headerType === 'TEXT'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Text Header
              </button>
            </div>

            {headerType === 'IMAGE' && (
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg space-y-2 text-xs">
                <label className="font-bold text-purple-900 block">
                  Sample Image for Meta Review (JPEG / PNG, max 5MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={sampleImageUrl}
                    onChange={(e) => setSampleImageUrl(e.target.value)}
                    placeholder="https://example.com/sample-school-flyer.png or upload below"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>{imageUploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={imageUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                {sampleImageUrl && (
                  <div className="flex items-center gap-2 text-[11px] text-purple-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="truncate">Attached sample: {sampleImageUrl}</span>
                  </div>
                )}
              </div>
            )}

            {headerType === 'TEXT' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Header Text</label>
                <input
                  type="text"
                  required
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="e.g. Important School Circular"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {/* Body Text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">
                Message Body Text <span className="text-rose-600">*</span>
              </label>
              <button
                type="button"
                onClick={handleInsertVariable}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
              >
                + Insert Placeholder &#123;&#123;{detectedVariables.length + 1}&#125;&#125;
              </button>
            </div>
            <textarea
              rows={4}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Dear Parent, this is to inform that {{1}} has an upcoming event on {{2}}. Please contact school office for any queries."
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-sans shadow-xs"
            />
            <p className="text-[10px] text-slate-400">
              Use <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">&#123;&#123;1&#125;&#125;</code>, <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">&#123;&#123;2&#125;&#125;</code> for dynamic values like student name, date, amount.
            </p>
          </div>

          {/* Sample Variables Inputs if detected */}
          {detectedVariables.length > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Meta Sample Values (Required by Meta for Review)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detectedVariables.map((v) => (
                  <div key={v} className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-slate-700">
                      Sample for &#123;&#123;{v}&#125;&#125; <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`e.g. Rahul Sharma or 25th Oct`}
                      value={sampleValues[v] || ''}
                      onChange={(e) =>
                        setSampleValues((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Bubble Preview in Modal */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live WhatsApp Message Preview</span>
            </span>
            <div className="rounded-xl whatsapp-chat-bg border border-slate-300 p-3 shadow-xs">
              <div className="whatsapp-bubble-received p-3 text-slate-900 text-xs whitespace-pre-wrap leading-relaxed shadow-xs border border-slate-200/50 space-y-2">
                {headerType === 'IMAGE' && (
                  <div className="w-full h-36 rounded-xl bg-gradient-to-br from-purple-50 to-slate-100 border border-purple-200 flex flex-col items-center justify-center text-slate-400 gap-1.5 overflow-hidden relative shadow-inner">
                    {(localPreviewUrl || sampleImageUrl) ? (
                      <img
                        src={localPreviewUrl || sampleImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-purple-700 py-4 px-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-purple-900">Image Header Template</span>
                        <span className="text-[10px] text-purple-600 font-medium">
                          Click &quot;Upload Image&quot; above to preview your sample image
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {headerType === 'TEXT' && headerText && (
                  <p className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">{headerText}</p>
                )}
                <div>{getPreviewText()}</div>
              </div>
            </div>
          </div>

          {/* Form CTA */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting to Meta...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Submit to Meta for Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
