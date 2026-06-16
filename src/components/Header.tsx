'use client';

import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <header className="app-header">
      <style jsx>{`
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .user-menu {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-size: 13px;
        }
        .user-name {
          font-weight: 700;
          color: var(--text-primary);
        }
        .user-role {
          font-size: 10px;
          color: var(--brand-mint-solid);
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .logout-btn {
          background: none;
          border: 1px solid var(--border-color);
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .logout-btn:hover {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--status-danger);
          border-color: rgba(239, 68, 68, 0.2);
        }
        @media (max-width: 600px) {
          .user-info {
            display: none;
          }
        }
      `}</style>
      <div className="container header-content">
        <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div className="logo-icon">H</div>
          <h1 className="logo-text">
            hous<span>mata</span>
          </h1>
        </div>

        {user && (
          <div className="user-menu">
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn" title="Sign Out">
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
