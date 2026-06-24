'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Users, Mail, CheckSquare, Square, ChevronRight } from 'lucide-react';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
}

interface RecipientsDirectoryProps {
  onComposeEmails: (emails: string[]) => void;
}

export default function RecipientsDirectory({ onComposeEmails }: RecipientsDirectoryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load users:', err);
        setLoading(false);
      });
  }, []);

  const roles = ['All', ...Array.from(new Set(users.map(u => u.role)))];

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'All' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const toggleSelectEmail = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleSelectAll = () => {
    const filteredEmails = filteredUsers.map(u => u.email);
    const allFilteredAreSelected = filteredEmails.every(e => selectedEmails.includes(e));

    if (allFilteredAreSelected) {
      // Deselect only the filtered items
      setSelectedEmails(prev => prev.filter(e => !filteredEmails.includes(e)));
    } else {
      // Select all filtered items
      setSelectedEmails(prev => Array.from(new Set([...prev, ...filteredEmails])));
    }
  };

  const handleComposeClick = () => {
    if (selectedEmails.length === 0) return;
    onComposeEmails(selectedEmails);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style jsx>{`
        .directory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .controls-bar {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: center;
        }
        .search-box {
          position: relative;
          flex: 1 1 220px;
          min-width: 0;
        }
        .role-filter {
          width: 160px;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .search-input {
          padding-left: 42px !important;
        }
        .compose-bar {
          background-color: var(--brand-teal-light);
          border: 1px solid var(--brand-teal);
          border-radius: var(--radius-md);
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #ffffff;
          box-shadow: var(--shadow-md);
          animation: slide-down 0.3s ease-out;
        }
        .compose-text {
          font-weight: 600;
          font-size: 15px;
        }
        .compose-text span {
          color: var(--brand-mint);
          font-weight: 800;
        }
        .users-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
          margin-top: 8px;
        }
        .user-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 18px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
        }
        .user-card:hover {
          border-color: var(--brand-mint);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .user-card.selected {
          border-color: var(--brand-mint);
          background-color: var(--brand-mint-glow);
        }
        .checkbox-container {
          color: var(--text-muted);
          margin-top: 2px;
          transition: color 0.2s ease;
        }
        .user-card.selected .checkbox-container {
          color: var(--brand-mint-solid);
        }
        .user-details {
          flex: 1;
        }
        .user-fullname {
          font-weight: 700;
          font-size: 15px;
          color: var(--text-primary);
        }
        .user-email {
          font-size: 13px;
          color: var(--text-secondary);
          word-break: break-all;
          margin-top: 2px;
        }
        .badge-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .user-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .user-badge.role {
          background-color: var(--bg-input);
          color: var(--text-secondary);
        }
        .user-badge.status {
          background-color: rgba(16, 185, 129, 0.12);
          color: var(--status-success);
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary);
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 600px) {
          .search-box,
          .role-filter,
          .select-all-btn {
            width: 100%;
            min-width: 0;
            flex: 1 1 100%;
          }
        }
      `}</style>

      {/* Directory Title */}
      <div className="directory-header">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Recipients Database</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Browse and search contacts loaded directly from Supabase ({users.length} total)
          </p>
        </div>

        <div className="controls-bar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="form-control search-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="form-control role-filter"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
          >
            <option value="All">All Roles</option>
            {roles.filter(r => r !== 'All').map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <button className="btn btn-secondary select-all-btn" onClick={toggleSelectAll} style={{ height: '45px' }}>
            Select/Deselect All Filtered
          </button>
        </div>
      </div>

      {/* Selection floating banner */}
      {selectedEmails.length > 0 && (
        <div className="compose-bar">
          <div className="compose-text">
            <span>{selectedEmails.length}</span> recipient{selectedEmails.length > 1 ? 's' : ''} selected for targeting
          </div>
          <button className="btn btn-mint" onClick={handleComposeClick}>
            <Mail size={16} /> Compose Email <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* User database grid */}
      {loading ? (
        <div className="empty-state">
          <p>Loading recipients from database...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>No Contacts Found</h3>
          <p style={{ marginTop: '4px' }}>Try adjusting your search criteria or role filters.</p>
        </div>
      ) : (
        <div className="users-list">
          {filteredUsers.map(user => {
            const isSelected = selectedEmails.includes(user.email);
            return (
              <div
                key={user.id}
                className={`user-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleSelectEmail(user.email)}
              >
                <div className="checkbox-container">
                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div className="user-details">
                  <div className="user-fullname">{user.first_name} {user.last_name}</div>
                  <div className="user-email">{user.email}</div>
                  <div className="badge-row">
                    <span className="user-badge role">{user.role}</span>
                    <span className="user-badge status">active</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
