import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer } from './components/Toast';
import { useNotification } from './hooks/useNotification';

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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const { toasts, addToast, removeToast } = useNotification();

  const handleNavigate = (tab: string, campaignId?: number) => {
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

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex min-h-screen bg-[#0b1120] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab === 'campaign-detail' ? 'campaigns' : activeTab}
        setActiveTab={(tab) => {
          setSelectedCampaignId(null);
          setActiveTab(tab);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onQuickSendClick={activeTab !== 'send-message' ? () => setActiveTab('send-message') : undefined}
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
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
            <TemplatesPage onNavigateToSend={() => setActiveTab('send-message')} />
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
