'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Mail, CheckCircle, Eye, RefreshCw, Layers } from 'lucide-react';

interface Campaign {
  id: string;
  subject: string;
  category: string;
  sent_count: number;
  open_count: number;
  created_at: string;
}

interface Summary {
  totalSent: number;
  totalOpens: number;
  avgOpenRate: number;
  deliveryRate: number;
}

export default function DashboardOverview() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalSent: 0, totalOpens: 0, avgOpenRate: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setDailyStats(data.dailyStats || []);
      setSummary(data.summary || { totalSent: 0, totalOpens: 0, avgOpenRate: 0, deliveryRate: 0 });
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style jsx>{`
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .summary-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }
        .icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .stat-label {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .recent-campaigns {
          margin-top: 8px;
        }
        .campaign-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .campaign-item:last-child {
          border-bottom: none;
        }
        .camp-title {
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary);
        }
        .camp-meta {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .camp-stats {
          text-align: right;
          font-size: 13px;
        }
        .refresh-btn {
          background: none;
          border: 1px solid var(--border-color);
          padding: 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .refresh-btn:hover {
          background-color: var(--bg-input);
        }
        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .editor-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 550px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Marketing Performance Dashboard</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Real-time overview of campaign performance and opens</p>
        </div>
        <button className="refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="icon-wrapper" style={{ backgroundColor: 'rgba(0, 98, 77, 0.1)', color: 'var(--brand-teal)' }}>
            <Mail size={24} />
          </div>
          <div>
            <div className="stat-value">{summary.totalSent}</div>
            <div className="stat-label">Total Sent</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="icon-wrapper" style={{ backgroundColor: 'rgba(27, 188, 163, 0.1)', color: 'var(--brand-mint)' }}>
            <Eye size={24} />
          </div>
          <div>
            <div className="stat-value">{summary.totalOpens}</div>
            <div className="stat-label">Total Opens</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--status-info)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="stat-value">{summary.avgOpenRate}%</div>
            <div className="stat-label">Avg Open Rate</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="stat-value">{summary.deliveryRate}%</div>
            <div className="stat-label">Delivery Rate</div>
          </div>
        </div>
      </div>

      {/* Graph and Campaign list grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }} className="editor-grid-responsive">
        {/* Weekly Stats Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="card-title">Weekly Dispatch vs Open Performance</h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px'
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="sent" name="Sent Emails" fill="var(--brand-teal)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="opens" name="Opened Emails" fill="var(--brand-mint)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Campaigns list */}
        <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <Layers size={18} color="var(--brand-mint)" />
            Recent Campaigns
          </h3>
          <div style={{ flex: 1, overflowY: 'auto' }} className="recent-campaigns">
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No campaigns dispatched yet.
              </div>
            ) : (
              campaigns.slice(0, 5).map(camp => (
                <div key={camp.id} className="campaign-item">
                  <div style={{ maxWidth: '70%' }}>
                    <div className="camp-title" title={camp.subject}>{camp.subject}</div>
                    <div className="camp-meta">{camp.category} • {new Date(camp.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="camp-stats">
                    <strong>{camp.sent_count}</strong> sent
                    <div style={{ fontSize: '11px', color: 'var(--brand-mint-solid)', fontWeight: 'bold' }}>
                      {camp.sent_count > 0 ? ((camp.open_count / camp.sent_count) * 100).toFixed(0) : 0}% opens
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
