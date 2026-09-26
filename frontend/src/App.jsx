import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer } from './components/Toast';
import { useNotification } from './hooks/useNotification';
import { api, authStorage } from './services/api';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SendMessagePage } from './pages/SendMessagePage';
import { StudentsPage } from './pages/StudentsPage';
import { ClassesPage } from './pages/ClassesPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { MessageLogsPage } from './pages/MessageLogsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const [currentUser, setCurrentUser] = useState(() => authStorage.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(authStorage.getToken()));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, addToast, removeToast } = useNotification();

  // Verify stored token on initial mount
  useEffect(() => {
    const checkSession = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsCheckingAuth(false);
        return;
      }

      try {
        const data = await api.getMe();
        if (data.authenticated && data.user) {
          setIsAuthenticated(true);
          setCurrentUser(data.user);
          authStorage.setUser(data.user);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
          authStorage.clear();
        }
      } catch {
        // If server not reachable or invalid session, fallback to stored session or reset
        const cachedUser = authStorage.getUser();
        if (cachedUser && token) {
          setIsAuthenticated(true);
          setCurrentUser(cachedUser);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Logged Out',
      message: 'You have been signed out of your administrator session.',
    });
  };

  const handleNavigate = (tab, campaignId) => {
    if (tab === 'campaign-detail' && campaignId) {
      setSelectedCampaignId(campaignId);
      setActiveTab('campaign-detail');
    } else {
      setActiveTab(tab);
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard Overview', subtitle: 'Real-time overview of school messaging & broadcasts' };
      case 'send-message':
        return { title: 'Broadcast Messaging', subtitle: 'Send individual Meta WhatsApp messages to whole classes' };
      case 'students':
        return { title: 'Students Directory', subtitle: 'Manage student phone records and WhatsApp consent' };
      case 'classes':
        return { title: 'Class Sections', subtitle: 'Organize academic classrooms and student rosters' };
      case 'templates':
        return { title: 'Meta WhatsApp Templates', subtitle: 'Approved template catalog for school communications' };
      case 'campaigns':
        return { title: 'Broadcast Campaigns', subtitle: 'Live status and history of classroom broadcasts' };
      case 'campaign-detail':
        return { title: `Campaign #${selectedCampaignId || ''}`, subtitle: 'Live message delivery breakdown' };
      case 'logs':
        return { title: 'Delivery Audit Logs', subtitle: 'Granular logs and WhatsApp message receipts' };
      case 'settings':
        return { title: 'System Diagnostics & Testing', subtitle: 'Verify Meta Cloud API connectivity & send test messages' };
      default:
        return { title: 'School WhatsApp Automation', subtitle: 'Broadcast Suite' };
    }
  };

  // While checking initial authentication token
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-medium tracking-wide">Starting School WhatsApp...</p>
        </div>
      </div>
    );
  }

  // If not logged in, render LoginPage
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} showToast={addToast} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white font-sans">
      {/* Sidebar (Desktop Sticky + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab === 'campaign-detail' ? 'campaigns' : activeTab}
        setActiveTab={(tab) => {
          setSelectedCampaignId(null);
          setActiveTab(tab);
        }}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <Header
          title={title}
          subtitle={subtitle}
          onQuickSendClick={activeTab !== 'send-message' ? () => setActiveTab('send-message') : undefined}
          onMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
          {activeTab === 'send-message' && (
            <SendMessagePage
              onNavigateToCampaign={(id) => handleNavigate('campaign-detail', id)}
              showToast={addToast}
            />
          )}
          {activeTab === 'students' && <StudentsPage showToast={addToast} />}
          {activeTab === 'classes' && (
            <ClassesPage
              onNavigateToSendMessage={() => setActiveTab('send-message')}
              showToast={addToast}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesPage
              onNavigateToSend={() => setActiveTab('send-message')}
              showToast={addToast}
            />
          )}
          {activeTab === 'campaigns' && (
            <CampaignsPage
              onNavigateToDetail={(id) => handleNavigate('campaign-detail', id)}
              onNavigateToSend={() => setActiveTab('send-message')}
            />
          )}
          {activeTab === 'campaign-detail' && selectedCampaignId && (
            <CampaignDetailPage
              campaignId={selectedCampaignId}
              onBack={() => setActiveTab('campaigns')}
            />
          )}
          {activeTab === 'logs' && <MessageLogsPage />}
          {activeTab === 'settings' && <SettingsPage showToast={addToast} />}
        </main>
      </div>

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;

