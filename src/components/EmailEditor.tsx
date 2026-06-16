'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Plus, Trash2, Eye, EyeOff, Sparkles, AlertCircle, Building2, Send, Check } from 'lucide-react';
import { compileEmailTemplate, EmailCategory } from '@/utils/templates';
import confetti from 'canvas-confetti';

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function EmailEditor() {
  const [category, setCategory] = useState<EmailCategory>('Regular Alerts');
  const [subject, setSubject] = useState('Important Update from Housmata CRM');
  const [title, setTitle] = useState('New System Update');
  const [body, setBody] = useState('We have updated our internal CRM platforms to support better alerts and reporting.');
  const [actionText, setActionText] = useState('Access Dashboard');
  const [actionUrl, setActionUrl] = useState('https://housmata.com');
  
  // Custom category structures
  const [properties, setProperties] = useState<Array<{title: string, price: string, location: string, image: string, url: string}>>([
    { title: '3 Bedroom Penthouse', price: '₦120,000,000', location: 'Lekki Scheme 1, Lagos', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&auto=format&fit=crop&q=60', url: '#' }
  ]);
  
  const [features, setFeatures] = useState<Array<{title: string, description: string, icon: string}>>([
    { title: 'Interactive Analytics', description: 'Track all sales pipelines with gorgeous charts.', icon: '📊' }
  ]);

  const [users, setUsers] = useState<Recipient[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isPreviewDark, setIsPreviewDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch recipients
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        if (data.length > 0) {
          setSelectedEmails(data.map((u: any) => u.email));
        }
      })
      .catch(err => console.error('Failed to load recipients:', err));
  }, []);

  // Update Preview iframe
  const compiledHtml = compileEmailTemplate({
    category,
    subject,
    title,
    body,
    actionText,
    actionUrl,
    properties: category === 'New Property Alert' ? properties : [],
    features: category === 'New Features Alert' ? features : [],
  });

  useEffect(() => {
    if (previewIframeRef.current) {
      const doc = previewIframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        // Force dark mode simulator headers in document if toggled
        let targetHtml = compiledHtml;
        if (isPreviewDark) {
          targetHtml = targetHtml.replace('</head>', `
            <style>
              body, .email-wrapper { background-color: #0b1a17 !important; color: #f0f5f4 !important; }
              .email-container { background-color: #0d1b18 !important; border: 1px solid #1bbca333; }
              .content-body { color: #e2e8f0 !important; }
              .property-card, .alert-box, .features-card, .footer-bar { background-color: #112521 !important; border-color: #1c3631 !important; }
              .property-card div, .alert-box strong, .features-card h4 { color: #ffffff !important; }
              .footer-bar { color: #8fa09d !important; border-top-color: #1c3631 !important; }
            </style>
          </head>`);
        }
        doc.write(targetHtml);
        doc.close();
      }
    }
  }, [compiledHtml, isPreviewDark]);

  const handleSendCampaign = async () => {
    if (selectedEmails.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one recipient.' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const selectedRecipients = users
        .filter(u => selectedEmails.includes(u.email))
        .map(u => ({ email: u.email, first_name: u.first_name }));

      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          category,
          title,
          body,
          actionText,
          actionUrl,
          properties: category === 'New Property Alert' ? properties : [],
          features: category === 'New Features Alert' ? features : [],
          recipients: selectedRecipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch campaign.');

      setStatusMessage({ type: 'success', text: `Campaign sent successfully to ${selectedRecipients.length} recipients!` });
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedEmails.length === users.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(users.map(u => u.email));
    }
  };

  const toggleSelectEmail = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="editor-grid-responsive">
      <style jsx>{`
        .editor-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .preview-box {
          position: sticky;
          top: 90px;
          height: calc(100vh - 140px);
          display: flex;
          flex-direction: column;
        }
        .iframe-container {
          flex: 1;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: #ffffff;
        }
        .recipient-list {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 8px;
          margin-top: 8px;
          background-color: var(--bg-input);
        }
        .recipient-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
        }
        .recipient-item:last-child {
          border-bottom: none;
        }
        .pill-select {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .pill {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background-color: var(--bg-input);
          color: var(--text-secondary);
        }
        .pill.active {
          background-color: var(--brand-teal);
          color: #ffffff;
          border-color: var(--brand-teal);
        }
        .dynamic-row {
          background-color: var(--bg-input);
          padding: 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          margin-bottom: 12px;
        }
        .alert-toast {
          padding: 12px 16px;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .alert-toast.success { background-color: rgba(16, 185, 129, 0.15); color: var(--status-success); }
        .alert-toast.error { background-color: rgba(239, 68, 68, 0.15); color: var(--status-danger); }
        @media (max-width: 900px) {
          .editor-grid-responsive {
            grid-template-columns: 1fr !important;
          }
          .preview-box {
            position: relative;
            top: 0;
            height: 500px;
          }
        }
      `}</style>

      {/* Editor Controls */}
      <div className="editor-container">
        <div className="card">
          <h2 className="card-title">
            <Mail size={20} color="var(--brand-mint)" />
            Configure Campaign Alert
          </h2>

          {statusMessage.type && (
            <div className={`alert-toast ${statusMessage.type}`}>
              {statusMessage.text}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Alert Category (Theme)</label>
            <div className="pill-select">
              {(['New Property Alert', 'Downtime Alert', 'Newsletter', 'New Features Alert', 'Regular Alerts'] as EmailCategory[]).map(cat => (
                <div 
                  key={cat} 
                  className={`pill ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Subject Header</label>
            <input 
              type="text" 
              className="form-control" 
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              placeholder="e.g. Weekly Real Estate newsletter"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Main Heading</label>
              <input 
                type="text" 
                className="form-control" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Call to Action Link</label>
              <input 
                type="text" 
                className="form-control" 
                value={actionUrl} 
                onChange={e => setActionUrl(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Call to Action Button Text</label>
            <input 
              type="text" 
              className="form-control" 
              value={actionText} 
              onChange={e => setActionText(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Alert Content (HTML / Text)</label>
            <textarea 
              className="form-control" 
              rows={4} 
              value={body} 
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {/* New Property Fields */}
          {category === 'New Property Alert' && (
            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Matched Property Showcase Card</span>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setProperties([...properties, { title: 'New Flat', price: '₦50,000,000', location: 'Lekki Phase 2', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&auto=format&fit=crop&q=60', url: '#' }])}
                >
                  <Plus size={12} /> Add
                </button>
              </label>
              {properties.map((prop, idx) => (
                <div key={idx} className="dynamic-row">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" className="form-control" placeholder="Property Title" value={prop.title} onChange={e => {
                      const copy = [...properties]; copy[idx].title = e.target.value; setProperties(copy);
                    }} />
                    <input type="text" className="form-control" placeholder="Price" value={prop.price} onChange={e => {
                      const copy = [...properties]; copy[idx].price = e.target.value; setProperties(copy);
                    }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                    <input type="text" className="form-control" placeholder="Location" value={prop.location} onChange={e => {
                      const copy = [...properties]; copy[idx].location = e.target.value; setProperties(copy);
                    }} />
                    <button className="btn btn-secondary" style={{ color: 'var(--status-danger)' }} onClick={() => setProperties(properties.filter((_, i) => i !== idx))}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Feature Fields */}
          {category === 'New Features Alert' && (
            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Announce New Product Features</span>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setFeatures([...features, { title: 'New Tools', description: 'Quick description', icon: '⚡' }])}
                >
                  <Plus size={12} /> Add
                </button>
              </label>
              {features.map((feat, idx) => (
                <div key={idx} className="dynamic-row">
                  <div style={{ display: 'grid', gridTemplateColumns: '0.2fr 0.8fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" className="form-control" placeholder="Icon" value={feat.icon} onChange={e => {
                      const copy = [...features]; copy[idx].icon = e.target.value; setFeatures(copy);
                    }} />
                    <input type="text" className="form-control" placeholder="Feature Title" value={feat.title} onChange={e => {
                      const copy = [...features]; copy[idx].title = e.target.value; setFeatures(copy);
                    }} />
                    <input type="text" className="form-control" placeholder="Description" value={feat.description} onChange={e => {
                      const copy = [...features]; copy[idx].description = e.target.value; setFeatures(copy);
                    }} />
                  </div>
                  <button className="btn btn-secondary" style={{ color: 'var(--status-danger)', width: '100%' }} onClick={() => setFeatures(features.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} /> Remove Feature Card
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recipient Targeting Selector */}
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Target Recipients ({selectedEmails.length}/{users.length})</label>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={toggleSelectAll}>
                {selectedEmails.length === users.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="recipient-list">
              {users.map(user => (
                <div key={user.id} className="recipient-item">
                  <input 
                    type="checkbox" 
                    id={`u-${user.id}`}
                    checked={selectedEmails.includes(user.email)} 
                    onChange={() => toggleSelectEmail(user.email)}
                  />
                  <label htmlFor={`u-${user.id}`} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}>
                    <span>{user.first_name} {user.last_name} ({user.email})</span>
                    <span style={{ fontSize: '10px', backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                      {user.role}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button 
            className="btn btn-mint" 
            style={{ width: '100%', padding: '16px' }}
            disabled={loading}
            onClick={handleSendCampaign}
          >
            {loading ? (
              'Dispatching Campaign...'
            ) : (
              <>
                <Send size={16} /> Send Email Campaign
              </>
            )}
          </button>

        </div>
      </div>

      {/* Simulator Preview */}
      <div className="preview-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} /> Live Rendering Simulator
          </h3>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setIsPreviewDark(!isPreviewDark)}
          >
            {isPreviewDark ? <Eye size={14} /> : <EyeOff size={14} />} 
            {isPreviewDark ? 'Light Scheme Preview' : 'Dark Scheme Preview'}
          </button>
        </div>

        <div className="iframe-container">
          <iframe 
            ref={previewIframeRef}
            title="Email Preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
