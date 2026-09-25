import React, { useEffect, useState, useRef } from 'react';
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
  Sparkles,
  Zap,
  RefreshCw,
  LogOut,
  ExternalLink,
  HelpCircle,
  Save,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage = ({ showToast }) => {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Embedded Signup State
  const [embeddedConfig, setEmbeddedConfig] = useState(null);
  const [metaAppIdInput, setMetaAppIdInput] = useState('');
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('');
  const [metaConfigIdInput, setMetaConfigIdInput] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupStatusMessage, setSignupStatusMessage] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  // Manual Credentials Update Form
  const [manualPhoneId, setManualPhoneId] = useState('');
  const [manualWabaId, setManualWabaId] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Test Message Form
  const [testNumber, setTestNumber] = useState('');
  const [testTemplate, setTestTemplate] = useState('hello_world');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const capturedSessionRef = useRef({ waba_id: '', phone_number_id: '' });

  const fetchHealthAndConfig = async () => {
    try {
      setLoadingHealth(true);
      const [healthData, authConfig] = await Promise.all([
        api.getHealth(),
        api.getWhatsAppEmbeddedConfig().catch(() => null),
      ]);
      setHealth(healthData);
      setEmbeddedConfig(authConfig);
      if (authConfig?.meta_app_id) {
        setMetaAppIdInput(authConfig.meta_app_id);
      }
      if (authConfig?.meta_config_id) {
        setMetaConfigIdInput(authConfig.meta_config_id);
      }
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthAndConfig();
  }, []);

  // Listen to Meta Embedded Signup session events (waba_id, phone_number_id, current_step)
  useEffect(() => {
    const handleMetaMessage = (event) => {
      // Validate origin if coming from facebook
      if (
        event.origin.includes('facebook.com') ||
        event.origin.includes('fb.com')
      ) {
        try {
          const rawData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (rawData && (rawData.type === 'WA_EMBEDDED_SIGNUP' || rawData.event === 'FINISH')) {
            const data = rawData.data || rawData;
            if (data.waba_id || data.phone_number_id) {
              capturedSessionRef.current = {
                waba_id: data.waba_id || '',
                phone_number_id: data.phone_number_id || '',
              };
            }
          }
        } catch {
          // Non-JSON message from other extensions, ignore safely
        }
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, []);

  // Dynamically load Facebook JavaScript SDK
  const loadFacebookSDK = (appId) => {
    return new Promise((resolve, reject) => {
      if (window.FB) {
        window.FB.init({
          appId: appId.trim(),
          cookie: true,
          xfbml: true,
          version: 'v21.0',
        });
        return resolve(window.FB);
      }

      window.fbAsyncInit = function () {
        window.FB.init({
          appId: appId.trim(),
          cookie: true,
          xfbml: true,
          version: 'v21.0',
        });
        resolve(window.FB);
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Facebook SDK. Please check internet access or adblocker.'));
      document.body.appendChild(script);
    });
  };

  const handleLaunchEmbeddedSignup = async () => {
    const targetAppId = metaAppIdInput.trim() || embeddedConfig?.meta_app_id;
    if (!targetAppId) {
      showToast({
        type: 'warning',
        title: 'Meta App ID Required',
        message: 'Please enter your Meta App ID to launch WhatsApp Embedded Signup.',
      });
      return;
    }

    setIsSigningUp(true);
    setSignupStatusMessage('Initializing Meta Facebook SDK...');

    try {
      await loadFacebookSDK(targetAppId);
      setSignupStatusMessage('Opening Meta WhatsApp Embedded Signup Modal...');

      // Use 'token' response_type so Meta returns the accessToken directly in the popup.
      // 'code' flow causes redirect_uri mismatch because the FB JS SDK popup internally
      // binds the code to a Facebook-owned URL that cannot be replicated server-side.
      const loginOptions = {
        response_type: 'token',
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: 3,
        },
      };

      if (metaConfigIdInput.trim() || embeddedConfig?.meta_config_id) {
        loginOptions.config_id = (metaConfigIdInput.trim() || embeddedConfig?.meta_config_id);
      } else {
        loginOptions.scope = 'whatsapp_business_management,whatsapp_business_messaging';
      }

      const handleFBResponse = async (response) => {
        // Support both token flow (accessToken) and code flow (code) responses
        const accessToken = response?.authResponse?.accessToken;
        const code = response?.authResponse?.code;

        if (response && response.authResponse && (accessToken || code)) {
          setSignupStatusMessage('Connecting WhatsApp Business App with Cloud API...');

          try {
            const result = await api.exchangeWhatsAppSignupCode({
              code: code || null,
              access_token: accessToken || null,
              waba_id: capturedSessionRef.current.waba_id,
              phone_number_id: capturedSessionRef.current.phone_number_id,
              app_id: targetAppId,
              app_secret: metaAppSecretInput.trim() || undefined,
            });

            if (result.success) {
              showToast({
                type: 'success',
                title: 'WhatsApp Connected!',
                message: `Successfully linked ${result.phone_info?.display_phone_number || 'your WhatsApp number'}. Cloud API is active!`,
              });
              await fetchHealthAndConfig();
            } else {
              showToast({
                type: 'error',
                title: 'Linkage Failed',
                message: result.error || 'Could not finalize WhatsApp connection.',
              });
            }
          } catch (err) {
            showToast({
              type: 'error',
              title: 'Backend Exchange Error',
              message: err.message || 'Failed to exchange token with server.',
            });
          } finally {
            setIsSigningUp(false);
            setSignupStatusMessage('');
          }
        } else {
          setIsSigningUp(false);
          setSignupStatusMessage('');
          if (response && response.status !== 'unknown') {
            showToast({
              type: 'warning',
              title: 'Signup Cancelled',
              message: 'Embedded Signup was closed or cancelled by the user.',
            });
          }
        }
      };

      window.FB.login(function (response) {
        handleFBResponse(response);
      }, loginOptions);
    } catch (err) {
      setIsSigningUp(false);
      setSignupStatusMessage('');
      showToast({
        type: 'error',
        title: 'Embedded Signup Error',
        message: err.message || 'Could not launch Meta popup.',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect active WhatsApp credentials?')) {
      return;
    }
    try {
      await api.disconnectWhatsApp();
      showToast({ type: 'success', title: 'Disconnected', message: 'WhatsApp credentials cleared.' });
      await fetchHealthAndConfig();
    } catch (err) {
      showToast({ type: 'error', title: 'Disconnect Error', message: err.message });
    }
  };

  const handleSaveManualCredentials = async (e) => {
    e.preventDefault();
    if (!manualPhoneId.trim() || !manualToken.trim()) {
      showToast({ type: 'warning', title: 'Missing required fields', message: 'Phone Number ID and Access Token are required.' });
      return;
    }
    setIsSavingManual(true);
    try {
      await api.saveWhatsAppCredentials({
        phone_number_id: manualPhoneId.trim(),
        waba_id: manualWabaId.trim(),
        access_token: manualToken.trim(),
      });
      showToast({ type: 'success', title: 'Credentials Saved', message: 'Active WhatsApp credentials updated successfully.' });
      setShowManualForm(false);
      await fetchHealthAndConfig();
    } catch (err) {
      showToast({ type: 'error', title: 'Save Failed', message: err.message });
    } finally {
      setIsSavingManual(false);
    }
  };

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
  const isConnected = !!(wa.phone_number_id && (wa.access_token || wa.access_token_masked));

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>WhatsApp Embedded Signup &amp; System Settings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Connect your official Meta WhatsApp Business Account, verify API connectivity, and dispatch test messages without webhooks.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchHealthAndConfig}
          disabled={loadingHealth}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Main WhatsApp Embedded Signup Banner / Action Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 p-6 sm:p-8 text-white shadow-lg border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Meta WhatsApp Embedded Signup &bull; Coexistence Supported</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                WhatsApp Business App &amp; Cloud API Coexistence
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Connect your existing WhatsApp Business App number directly to Meta Cloud API without deleting your phone app. Keep chatting on your mobile while enabling automated bulk campaigns and alerts from this software.
              </p>
            </div>

            {/* Connection Status Badge */}
            <div className="shrink-0 flex items-center gap-3">
              {isConnected ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300 text-xs font-bold shadow-xs backdrop-blur-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Dual Coexistence Active</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Phone App + Cloud API Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300 text-xs font-bold shadow-xs backdrop-blur-xs">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Not Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* 3-Step Coexistence Explainer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950/40 rounded-xl p-3.5 border border-emerald-500/20">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-white block font-medium">Meta App ID / Config</strong>
                <span className="text-slate-400 text-[11px]">App ID or Configuration ID enter karein.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-white block font-medium">Choose Existing Number</strong>
                <span className="text-slate-400 text-[11px]">Meta popup me apna WhatsApp Business App number select karein.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-white block font-medium">Scan QR / Confirm on Phone</strong>
                <span className="text-slate-400 text-[11px]">Phone app me confirm karein &mdash; no deletion required!</span>
              </div>
            </div>
          </div>

          {/* Embedded Signup Action Controls */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-4 sm:p-5 border border-slate-700/60 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Meta App ID (Client ID)
                </label>
                <input
                  type="text"
                  value={metaAppIdInput}
                  onChange={(e) => setMetaAppIdInput(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Meta App Secret <span className="text-slate-400 font-normal">(Optional if in .env)</span>
                </label>
                <input
                  type="password"
                  value={metaAppSecretInput}
                  onChange={(e) => setMetaAppSecretInput(e.target.value)}
                  placeholder="Enter App Secret if testing"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Configuration ID <span className="text-slate-400 font-normal">(Optional Config ID)</span>
                </label>
                <input
                  type="text"
                  value={metaConfigIdInput}
                  onChange={(e) => setMetaConfigIdInput(e.target.value)}
                  placeholder="e.g. 987654321098"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLaunchEmbeddedSignup}
                  disabled={isSigningUp}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSigningUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>{signupStatusMessage || 'Launching Meta Signup...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                      <span>{isConnected ? 'Reconnect / Switch WhatsApp Account' : 'Connect WhatsApp via Meta Signup'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {showManualForm ? 'Hide Manual Setup' : 'Manual Credentials / Token'}
                </button>
              </div>

              {isConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/50 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          </div>

          {/* Manual Credentials Setup Drawer */}
          {showManualForm && (
            <form
              onSubmit={handleSaveManualCredentials}
              className="bg-slate-900/90 rounded-xl p-5 border border-emerald-500/40 space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Manual WhatsApp Cloud API / System User Token Setup</span>
                </h4>
                <span className="text-[11px] text-slate-400">Direct override</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualPhoneId}
                    onChange={(e) => setManualPhoneId(e.target.value)}
                    placeholder="e.g. 1393372873849630"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    WABA ID (Account ID)
                  </label>
                  <input
                    type="text"
                    value={manualWabaId}
                    onChange={(e) => setManualWabaId(e.target.value)}
                    placeholder="e.g. 1086203377344807"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Permanent / System Access Token *
                  </label>
                  <input
                    type="password"
                    required
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="EAA..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {isSavingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save &amp; Apply Credentials</span>
                </button>
              </div>
            </form>
          )}

          {/* Meta Coexistence Checklist & Webhook Fields Info */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Meta Coexistence Configuration &amp; Webhook Fields</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                featureType: whatsapp_business_app_onboarding
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <strong className="text-white block font-semibold text-xs text-emerald-400">☑ Meta Developer App Requirements</strong>
                <ul className="space-y-1 text-slate-400">
                  <li>&bull; <strong className="text-slate-200">Permissions:</strong> whatsapp_business_management, whatsapp_business_messaging</li>
                  <li>&bull; <strong className="text-slate-200">App Mode:</strong> Live / Advanced Access for Business Management</li>
                  <li>&bull; <strong className="text-slate-200">Embedded Signup:</strong> Configuration ID created in Login for Business</li>
                </ul>
              </div>

              <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <strong className="text-white block font-semibold text-xs text-emerald-400">☑ Subscribed Webhook Fields</strong>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] border border-slate-700">messages</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] border border-slate-700">smb_message_echoes</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] border border-slate-700">history</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] border border-slate-700">smb_app_state_sync</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] border border-slate-700">message_template_status_update</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics & Live API Test Row */}
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
                className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${testResult.success
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
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Active Meta Credentials</h3>
                  <p className="text-[11px] text-slate-500">Live configuration loaded in memory / environment</p>
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

              {/* Meta Graph API Version & Webhook Verification Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block font-medium">API Version</span>
                  <span className="font-mono font-bold text-xs text-slate-800">{wa.api_version || 'v26.0'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block font-medium">Verification Token</span>
                  <span className="font-mono font-bold text-xs text-emerald-700">{wa.verify_token || 'school'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
