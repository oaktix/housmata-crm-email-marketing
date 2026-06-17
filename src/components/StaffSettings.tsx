'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Plus, Key, Check, AlertCircle } from 'lucide-react';

interface Staff {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'marketer';
  created_at: string;
}

export default function StaffSettings() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'marketer'>('marketer');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setStatus({ type: 'error', text: 'Name, email and temporary password are required.' });
      return;
    }
    if (password.length < 6) {
      setStatus({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    setLoading(true);
    setStatus({ type: null, text: '' });

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register staff member.');

      setStatus({ type: 'success', text: data.message || 'Staff member registered successfully!' });
      setName('');
      setEmail('');
      setPassword('');
      fetchStaff();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="settings-grid-responsive">
      <style jsx>{`
        .staff-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        .staff-item:last-child {
          border-bottom: none;
        }
        .role-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 12px;
          text-transform: uppercase;
        }
        .role-badge.admin { background-color: rgba(0, 98, 77, 0.15); color: var(--brand-mint-solid); }
        .role-badge.marketer { background-color: var(--bg-input); color: var(--text-secondary); }
        .setup-guide {
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 16px;
          margin-top: 16px;
          font-size: 13px;
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .settings-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Staff Management Form & List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <h2 className="card-title">
            <Shield size={20} color="var(--brand-mint)" />
            Add Staff Member
          </h2>

          {status.type && (
            <div className={`alert-toast ${status.type}`} style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '16px',
              backgroundColor: status.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: status.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'
            }}>
              {status.text}
            </div>
          )}

          <form onSubmit={handleAddStaff}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Samuel Green"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-control" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="e.g. samuel@housmata.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Minimum 6 characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <select 
                className="form-control" 
                value={role} 
                onChange={e => setRole(e.target.value as any)}
              >
                <option value="marketer">Marketer (Send & Analyze)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              <Plus size={16} /> Add Member
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title">Active Staff Members</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {staffList.map(st => (
              <div key={st.id} className="staff-item">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{st.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{st.email}</div>
                </div>
                <span className={`role-badge ${st.role}`}>{st.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email delivery configuration guide */}
      <div className="card">
        <h2 className="card-title">
          <Key size={20} color="var(--brand-mint)" />
          Email & Server Setup
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Follow these guidelines to authenticate your Resend email service and Supabase database.
        </p>

        <div className="setup-guide">
          <strong style={{ display: 'block', marginBottom: '8px' }}>1. Local Configuration (.env.local)</strong>
          Create a file named `.env.local` in the root folder and add the following keys:
          <pre style={{
            backgroundColor: 'var(--bg-card)', 
            padding: '12px', 
            borderRadius: '6px', 
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            overflowX: 'auto',
            marginTop: '8px',
            fontFamily: 'Courier New, monospace'
          }}>
{`NEXT_PUBLIC_SUPABASE_URL=https://your-proj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey... (service role key)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Housmata CRM <updates@housmata.com.ng>
NEXT_PUBLIC_APP_URL=https://housmata-crm-marketing.vercel.app`}
          </pre>
        </div>

        <div className="setup-guide">
          <strong style={{ display: 'block', marginBottom: '4px' }}>2. Resend Domain Verification</strong>
          Ensure the domain of your sending address (`RESEND_FROM_EMAIL`) is fully verified in the Resend dashboard (Domains → Add Domain → add the DNS records). Until the domain is verified, Resend only allows sending to your own account email.
        </div>

        <div className="setup-guide" style={{ borderLeft: '4px solid var(--brand-mint)' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-mint-solid)' }}>
            <Check size={16} /> Open Tracking Ready
          </strong>
          Open-tracking reports automatically trigger when recipients load images in their mail client. Set `NEXT_PUBLIC_APP_URL` to your live Vercel URL to enable tracker callbacks.
        </div>
      </div>
    </div>
  );
}
