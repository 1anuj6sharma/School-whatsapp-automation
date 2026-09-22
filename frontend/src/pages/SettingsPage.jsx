import React, { useEffect, useState } from 'react';
import {
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage = ({ showToast }) => {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Test Message Form
  const [testNumber, setTestNumber] = useState('');
  const [testTemplate, setTestTemplate] = useState('hello_world');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleCopy = async (text, key) => {
    if (!text) {
      showToast({ type: 'warning', title: 'Nothing to copy' });
      return;
    }

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.error('Copy fallback failed', e);
      }
    }

    if (copied) {
      setCopiedKey(key);
      showToast({ type: 'success', title: 'Copied to clipboard' });
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    } else {
      showToast({ type: 'error', title: 'Could not copy', message: 'Please copy manually.' });
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testNumber.trim()) {
      showToast({ type: 'warning', title: 'Please enter a recipient number' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const result = await api.sendTestMessage({
        recipient_number: testNumber.trim(),
        template_name: testTemplate.trim(),
      });

      setTestResult(result);
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Meta WhatsApp Message Sent!',
          message: `Message ID: ${result.message_id}`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Meta API Error',
          message: result.error || 'Failed to send test message.',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Request failed';
      setTestResult({
        success: false,
        error: errorMsg,
      });
      showToast({
        type: 'error',
        title: 'Communication Error',
        message: errorMsg,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const wa = health?.whatsapp || {};

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
          <span>System Settings &amp; WhatsApp Diagnostics</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Verify Meta Cloud API connectivity, inspect active credentials, and test direct message routing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Direct Test Dispatcher */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Direct Meta API Test</h3>
                <p className="text-xs text-slate-500">
                  Sends an immediate <span className="font-mono text-emerald-700 font-semibold">hello_world</span> message to verify credentials.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient WhatsApp Number *
                </label>
                <input
                  type="text"
                  required
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="e.g. 919876543210 (without '+')"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your verified Meta test recipient phone number.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={testTemplate}
                  onChange={(e) => setTestTemplate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingTest}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Meta API...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Real WhatsApp Message</span>
                  </>
                )}
              </button>
            </form>

            {/* Test Result Box */}
            {testResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-800">Message Delivered via Meta!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-800">Meta Delivery Failed</span>
                    </>
                  )}
                </div>

                {testResult.success ? (
                  <div className="space-y-1 font-mono text-[11px] pt-1 text-emerald-800">
                    <p>WhatsApp Message ID: {testResult.message_id}</p>
                    <p>Recipient: {testResult.recipient}</p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px] pt-1">
                    <p className="font-semibold text-rose-800">{testResult.error}</p>
                    {testResult.meta_error && (
                      <pre className="p-2 bg-rose-100/70 rounded-lg overflow-x-auto text-[10px] text-rose-900 font-mono mt-2 border border-rose-200">
                        {JSON.stringify(testResult.meta_error, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Meta WhatsApp Cloud API Credentials & Configuration Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Meta WhatsApp Credentials</h3>
                  <p className="text-[11px] text-slate-500">Live configuration loaded from environment</p>
                </div>
              </div>
              <span className="font-semibold text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{health?.status === 'ok' ? 'Online' : 'Checking...'}</span>
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* WhatsApp Phone Number ID */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Phone Number ID</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(wa.phone_number_id, 'phone_id')}
                    className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'phone_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedKey === 'phone_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-emerald-700 font-bold text-xs tracking-wider">
                  {wa.phone_number_id || (loadingHealth ? 'Loading...' : 'Not Configured')}
                </div>
              </div>

              {/* WhatsApp Business Account ID (WABA ID) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Business Account ID (WABA ID)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(wa.business_account_id, 'waba_id')}
                    className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'waba_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedKey === 'waba_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-slate-900 font-bold text-xs tracking-wider">
                  {wa.business_account_id || (loadingHealth ? 'Loading...' : 'Not Configured')}
                </div>
              </div>

              {/* Meta Access Token */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Meta Access Token</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{showToken ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(wa.access_token, 'token')}
                      className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copiedKey === 'token' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className="font-mono text-slate-800 text-[11px] break-all select-all">
                  {showToken ? (wa.access_token || 'Not Configured') : (wa.access_token_masked || '••••••••••••••••••••')}
                </div>
              </div>

              {/* Webhook Verification Token */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Webhook Verification Token</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(wa.verify_token || 'school_whatsapp_verify_token_secret_123', 'verify_token')}
                    className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'verify_token' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedKey === 'verify_token' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-slate-900 font-bold text-xs">
                  {wa.verify_token || 'school_whatsapp_verify_token_secret_123'}
                </div>
              </div>

              {/* Meta Graph API Version & Webhook Endpoint Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block font-medium">API Version</span>
                  <span className="font-mono font-bold text-xs text-slate-800">{wa.api_version || 'v26.0'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block font-medium">Webhook Endpoint</span>
                  <span className="font-mono font-bold text-xs text-emerald-700">{wa.webhook_endpoint || '/webhooks/whatsapp'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


