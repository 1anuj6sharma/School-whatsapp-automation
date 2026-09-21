import React, { useState } from 'react';
import {
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage = ({ showToast }) => {
  // Test Message Form
  const [testNumber, setTestNumber] = useState('');
  const [testTemplate, setTestTemplate] = useState('hello_world');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

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

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-emerald-600" />
          <span>System Settings &amp; WhatsApp Diagnostics</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Verify Meta Cloud API connectivity and test direct message routing.
        </p>
      </div>

      {/* Direct Test Dispatcher */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Direct Meta API Test</h3>
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
  );
};

