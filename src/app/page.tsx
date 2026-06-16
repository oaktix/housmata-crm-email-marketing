'use client';

import React, { useState } from 'react';
import { Mail, BarChart3, Settings, AlertCircle } from 'lucide-react';
import EmailEditor from '@/components/EmailEditor';
import Analytics from '@/components/Analytics';
import StaffSettings from '@/components/StaffSettings';

type ActiveTab = 'campaigns' | 'analytics' | 'settings';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('campaigns');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style jsx>{`
        .sub-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .intro-text h2 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .intro-text p {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .tab-content {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Sub Header & Tab Menu */}
      <div className="sub-header">
        <div className="intro-text">
          <h2>Email Marketing Suite</h2>
          <p>Compose responsive theme-based email campaigns and monitor read activity</p>
        </div>

        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <Mail size={16} />
            Campaigns
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} />
            Analytics & Logs
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            SMTP & Staff
          </button>
        </nav>
      </div>

      {/* Active Tab Content Rendering */}
      <div className="tab-content">
        {activeTab === 'campaigns' && <EmailEditor />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && <StaffSettings />}
      </div>
    </div>
  );
}
