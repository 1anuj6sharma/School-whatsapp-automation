import React, { useEffect, useState } from 'react';
import {
  Settings,
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Key,
  Globe,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { HealthStatus, TestMessageResult } from '../types';

interface SettingsPageProps {
  showToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ showToast }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Test Message Form
  const [testNumber, setTestNumber] = useState('');
  const [testTemplate, setTestTemplate] = useState('hello_world');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestMessageResult | null>(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
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

  const handleSendTestMessage = async (e: React.FormEvent) => {
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

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-emerald-400" />
          <span>System Settings &amp; WhatsApp Diagnostics</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Verify Meta Cloud API connectivity, test direct message routing, and inspect webhook configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Direct Test Dispatcher */}
        <div className="md:col-span-6 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Direct Meta API Test</h3>
                <p className="text-xs text-slate-400">
                  Sends an immediate <span className="font-mono text-emerald-300">hello_world</span> message to verify credentials.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Recipient WhatsApp Number *
                </label>
                <input
                  type="text"
                  required
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="e.g. 919876543210 (without '+')"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your verified Meta test recipient phone number.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={testTemplate}
                  onChange={(e) => setTestTemplate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingTest}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all"
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
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Message Delivered via Meta!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-rose-300">Meta Delivery Failed</span>
                    </>
                  )}
                </div>

                {testResult.success ? (
                  <div className="space-y-1 font-mono text-[11px] pt-1">
                    <p>WhatsApp Message ID: {testResult.message_id}</p>
                    <p>Recipient: {testResult.recipient}</p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px] pt-1">
                    <p className="font-semibold text-rose-200">{testResult.error}</p>
                    {testResult.meta_error && (
                      <pre className="p-2 bg-black/40 rounded-lg overflow-x-auto text-[10px] text-rose-300 font-mono mt-2">
                        {JSON.stringify(testResult.meta_error, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: System Diagnostics & Webhook Guide */}
        <div className="md:col-span-6 space-y-6">
          {/* Health Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>System &amp; Database Health</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span className="text-slate-400">Backend API Status:</span>
                <span className="font-semibold text-emerald-400">
                  {health?.status === 'ok' ? 'Online (FastAPI)' : 'Checking...'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span className="text-slate-400">Database Connection:</span>
                <span className="font-semibold text-white">
                  {health?.database || 'Connected'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span className="text-slate-400">WhatsApp Phone ID:</span>
                <span className="font-mono text-emerald-400 font-semibold">1756936935540279</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span className="text-slate-400">Meta API Version:</span>
                <span className="font-mono text-emerald-300 font-semibold">v26.0</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Webhook Endpoint:</span>
                <span className="font-mono text-sky-300 font-semibold">/webhooks/whatsapp</span>
              </div>
            </div>
          </div>

          {/* Webhook & Tunnel Guide */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 text-xs text-slate-300">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Configuring Meta Delivery Webhooks</span>
            </h4>
            <p className="leading-relaxed text-slate-400">
              For local testing of <code className="text-sky-300">DELIVERED</code> and <code className="text-sky-300">READ</code> status receipts, create a public HTTPS tunnel with Cloudflare:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-emerald-300 border border-slate-800 flex items-center justify-between">
              <span>cloudflared tunnel --url http://localhost:8000</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              In Meta Developer Portal &rarr; WhatsApp &rarr; Configuration &rarr; Callback URL, enter:
              <br />
              <code className="text-slate-300">https://your-tunnel.trycloudflare.com/webhooks/whatsapp</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
