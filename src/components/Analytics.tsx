'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Mail, CheckCircle, Eye, AlertTriangle, RefreshCw, Search } from 'lucide-react';

interface Campaign {
  id: string;
  subject: string;
  category: string;
  sent_count: number;
  open_count: number;
  created_at: string;
}

interface Log {
  id: string;
  recipient_email: string;
  recipient_name: string;
  category: string;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  sent_at: string;
  opened_at?: string;
}

interface Summary {
  totalSent: number;
  totalOpens: number;
  avgOpenRate: number;
  deliveryRate: number;
}

export default function Analytics() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalSent: 0, totalOpens: 0, avgOpenRate: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setLogs(data.logs || []);
      setDailyStats(data.dailyStats || []);
      setSummary(data.summary || { totalSent: 0, totalOpens: 0, avgOpenRate: 0, deliveryRate: 0 });
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (log.recipient_name && log.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || log.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        .logs-table-wrapper {
          overflow-x: auto;
          margin-top: 16px;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 14px;
        }
        .logs-table th {
          padding: 12px 16px;
          border-bottom: 2px solid var(--border-color);
          color: var(--text-secondary);
          font-weight: 600;
        }
        .logs-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-primary);
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status-badge.sent { background-color: rgba(16, 185, 129, 0.15); color: var(--status-success); }
        .status-badge.failed { background-color: rgba(239, 68, 68, 0.15); color: var(--status-danger); }
        .status-badge.pending { background-color: rgba(245, 158, 11, 0.15); color: var(--status-warning); }
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
        }
        @media (max-width: 550px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Delivery & Open Analytics</h2>
        <button className="refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Stats
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
            <div className="stat-label">Delivery Success</div>
          </div>
        </div>
      </div>

      {/* Graph Section */}
      <div className="card" style={{ height: '350px' }}>
        <h3 className="card-title">Weekly Sent vs Open Performance</h3>
        <div style={{ width: '100%', height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
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

      {/* Details Table */}
      <div className="card">
        <h3 className="card-title">Email Dispatch History</h3>
        
        {/* Search / filter control bar */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search recipient..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          
          <select 
            className="form-control" 
            style={{ width: '200px' }} 
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="New Property Alert">New Property Alert</option>
            <option value="Downtime Alert">Downtime Alert</option>
            <option value="Newsletter">Newsletter</option>
            <option value="New Features Alert">New Features Alert</option>
            <option value="Regular Alerts">Regular Alerts</option>
          </select>
        </div>

        <div className="logs-table-wrapper">
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No matches found in logs.
            </div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Dispatch Time</th>
                  <th>Opened Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div><strong>{log.recipient_name || 'Anonymous Recipient'}</strong></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.recipient_email}</div>
                      {log.error_message && (
                        <div style={{ fontSize: '11px', color: 'var(--status-danger)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={10} /> {log.error_message}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{log.category}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${log.status}`}>{log.status}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>{new Date(log.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>
                        {log.opened_at ? (
                          <span style={{ color: 'var(--brand-mint-solid)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={12} /> Opened at {new Date(log.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unread</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
