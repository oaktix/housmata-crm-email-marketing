'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldAlert, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if already logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          router.push('/');
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Successful login, redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style jsx global>{`
        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 10% 20%, rgba(0, 98, 77, 0.1) 0%, rgba(8, 15, 13, 0.95) 90%);
          padding: 24px;
          color: var(--text-primary);
        }
        .login-card {
          width: 100%;
          max-width: 440px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 40px 32px;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(20px);
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo {
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
        .login-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--brand-teal);
        }
        @media (prefers-color-scheme: dark) {
          .login-title {
            color: var(--text-primary);
          }
        }
        .login-title span {
          color: var(--brand-mint);
        }
        .login-subtitle {
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
        .login-input {
          padding-left: 44px !important;
        }
        .login-btn {
          width: 100%;
          padding: 14px !important;
          font-size: 15px !important;
          margin-top: 8px;
        }
        .error-banner {
          background-color: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          color: var(--status-danger);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">H</div>
          <h1 className="login-title">
            hous<span>mata</span> CRM
          </h1>
          <p className="login-subtitle">
            Enter credentials to access Email Marketing System
          </p>
        </div>

        {errorMessage && (
          <div className="error-banner">
            <ShieldAlert size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                className="form-control login-input"
                placeholder="hello@housmata.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                className="form-control login-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-mint login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Hub'}
          </button>
        </form>
      </div>
    </div>
  );
}
