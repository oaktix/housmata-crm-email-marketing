'use client';

import React, { useState } from 'react';
import { Mail, Settings, Users, LayoutDashboard, History, Menu, X } from 'lucide-react';
import DashboardOverview from '@/components/DashboardOverview';
import EmailEditor from '@/components/EmailEditor';
import RecipientsDirectory from '@/components/RecipientsDirectory';
import Analytics from '@/components/Analytics';
import StaffSettings from '@/components/StaffSettings';

type ActiveTab = 'dashboard' | 'campaigns' | 'recipients' | 'analytics' | 'settings';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [composeEmails, setComposeEmails] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleComposeEmails = (emails: string[]) => {
    setComposeEmails(emails);
    setActiveTab('campaigns');
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'recipients', label: 'Recipients', icon: Users },
    { id: 'analytics', label: 'Delivery Logs', icon: History },
    { id: 'settings', label: 'Email & Staff', icon: Settings },
  ] as const;

  return (
    <div className="layout-grid">
      <style jsx>{`
        .layout-grid {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: calc(100vh - 90px);
          margin-top: 10px;
          gap: 32px;
          width: 100%;
        }
        .sidebar {
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 24px 16px;
          height: fit-content;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: var(--shadow-md);
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }
        .sidebar-item:hover {
          background-color: var(--bg-input);
          color: var(--text-primary);
        }
        .sidebar-item.active {
          background-color: var(--brand-teal);
          color: #ffffff;
        }
        .main-content {
          min-width: 0; /* Prevents grid layout breaking with tables */
          animation: fade-in 0.3s ease-out;
        }
        .mobile-nav-toggle {
          display: none;
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          padding: 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-primary);
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 16px;
          width: fit-content;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .layout-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .sidebar {
            display: ${mobileMenuOpen ? 'flex' : 'none'};
            position: fixed;
            top: 64px;
            left: 24px;
            right: 24px;
            z-index: 90;
            max-height: calc(100vh - 64px - 24px);
            overflow-y: auto;
            box-shadow: var(--shadow-lg);
          }
          .mobile-nav-toggle {
            display: inline-flex;
          }
        }
      `}</style>

      {/* Mobile Toggle Button */}
      <button 
        className="mobile-nav-toggle" 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        <span>Menu / Tool Suite</span>
      </button>

      {/* Navigation Sidebar */}
      <aside className="sidebar">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => selectTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Workspace Pages Content */}
      <div className="main-content">
        {activeTab === 'dashboard' && <DashboardOverview />}
        {activeTab === 'campaigns' && <EmailEditor initialEmails={composeEmails} />}
        {activeTab === 'recipients' && <RecipientsDirectory onComposeEmails={handleComposeEmails} />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && <StaffSettings />}
      </div>
    </div>
  );
}
