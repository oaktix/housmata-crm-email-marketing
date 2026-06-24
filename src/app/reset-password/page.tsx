'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle, ShieldAlert } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });

  // Extract access token from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setToken(accessToken);
      } else {
        setStatus({
          type: 'error',
          text: 'No access token found. Please click the reset link in your email again.'
        });
      }
    } else {
      // Check query parameters as a backup
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('access_token') || urlParams.get('token');
      if (queryToken) {
        setToken(queryToken);
      } else {
        setStatus({
          type: 'error',
          text: 'Reset link is invalid or has expired. Please request a new link.'
        });
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setStatus({ type: 'error', text: 'All fields are required.' });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (password.length < 6) {
      setStatus({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    setStatus({ type: null, text: '' });

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, access_token: token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setStatus({
        type: 'success',
        text: 'Your password has been successfully reset! Redirecting to login page...'
      });
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-wrapper">
      <style jsx global>{`
        .reset-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 10% 20%, rgba(0, 98, 77, 0.1) 0%, rgba(8, 15, 13, 0.95) 90%);
          padding: 24px;
          color: var(--text-primary);
        }
        .reset-card {
          width: 100%;
          max-width: 440px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 40px 32px;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(20px);
        }
        .reset-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .reset-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background-color: var(--brand-teal);
          color: var(--brand-mint);
          border-radius: 50%;
          font-weight: 800;
          font-size: 24px;
          margin-bottom: 16px;
          box-shadow: 0 0 20px var(--brand-mint-glow);
        }
        .reset-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--brand-teal);
        }
        @media (prefers-color-scheme: dark) {
          .reset-title {
            color: var(--text-primary);
          }
        }
        .reset-title span {
          color: var(--brand-mint);
        }
        .reset-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 8px;
        }
        .input-icon-wrapper {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .reset-input {
          padding-left: 44px !important;
        }
        .reset-btn {
          width: 100%;
          padding: 14px !important;
          font-size: 15px !important;
          margin-top: 8px;
        }
        .status-banner {
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        .status-banner.error {
          background-color: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--status-danger);
        }
        .status-banner.success {
          background-color: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: var(--status-success);
        }
        @media (max-width: 480px) {
          .reset-card {
            padding: 28px 20px;
          }
        }
      `}</style>

      <div className="reset-card">
        <div className="reset-header">
          <div className="reset-logo">H</div>
          <h1 className="reset-title">
            Reset <span>Password</span>
          </h1>
          <p className="reset-subtitle">
            Enter a secure new password for your account
          </p>
        </div>

        {status.type && (
          <div className={`status-banner ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
            <span>{status.text}</span>
          </div>
        )}

        {token && status.type !== 'success' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">New Password</label>
              <div className="input-icon-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="form-control reset-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirm New Password</label>
              <div className="input-icon-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="form-control reset-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-mint reset-btn" disabled={loading}>
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}

        {!token && status.type === 'error' && (
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '12px' }}
            onClick={() => router.push('/login')}
          >
            Return to Login
          </button>
        )}
      </div>
    </div>
  );
}
