'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldAlert, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    setErrorMessage('');
    setSuccessMessage('');

    if (isForgotMode) {
      if (!email) {
        setErrorMessage('Please fill in your email address.');
        return;
      }
      setLoading(true);

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to trigger password recovery.');
        }

        setSuccessMessage(data.message || 'Verification link sent!');
        setEmail('');
      } catch (err: any) {
        setErrorMessage(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!email || !password) {
        setErrorMessage('Please fill in all fields.');
        return;
      }
      setLoading(true);

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

        router.push('/');
        router.refresh();
      } catch (err: any) {
        setErrorMessage(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleMode = () => {
    setIsForgotMode(!isForgotMode);
    setErrorMessage('');
    setSuccessMessage('');
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
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .logo-dark {
          display: none;
        }
        @media (prefers-color-scheme: dark) {
          .logo-light {
            display: none;
          }
          .logo-dark {
            display: block;
          }
        }
        .login-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 12px;
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
        .success-banner {
          background-color: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          color: var(--status-success);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        .forgot-link-btn {
          background: none;
          border: none;
          color: var(--brand-mint-solid);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          align-self: flex-end;
          padding: 4px 0;
          transition: opacity 0.2s ease;
        }
        .forgot-link-btn:hover {
          text-decoration: underline;
        }
        .back-login-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 16px;
          width: 100%;
          transition: color 0.2s ease;
        }
        .back-login-btn:hover {
          color: var(--text-primary);
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .login-card {
            padding: 28px 20px;
          }
        }
      `}</style>

      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" className="logo-light" alt="Housmata Logo" style={{ height: '45px', width: 'auto', display: 'block' }} />
          <img src="/alt_logo.png" className="logo-dark" alt="Housmata Logo" style={{ height: '45px', width: 'auto', display: 'block' }} />
          <p className="login-subtitle">
            {isForgotMode 
              ? 'Request a password recovery link via email' 
              : 'Enter credentials to access Email Marketing System'}
          </p>
        </div>

        {errorMessage && (
          <div className="error-banner">
            <ShieldAlert size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="success-banner">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
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

          {!isForgotMode && (
            <>
              <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <button type="button" className="forgot-link-btn" onClick={toggleMode}>
                    Forgot Password?
                  </button>
                </div>
                <div className="input-icon-wrapper" style={{ marginTop: '8px', position: 'relative' }}>
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn btn-mint login-btn" disabled={loading}>
            {loading 
              ? (isForgotMode ? 'Sending Link...' : 'Authenticating...') 
              : (isForgotMode ? 'Send Reset Link' : 'Sign In to Hub')}
          </button>

          {isForgotMode && (
            <button type="button" className="back-login-btn" onClick={toggleMode}>
              <ArrowLeft size={14} /> Back to Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
