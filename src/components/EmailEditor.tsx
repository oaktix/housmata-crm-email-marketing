'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Plus, Trash2, Eye, EyeOff, Sparkles, AlertCircle, Building2, Send, Check, Paperclip, Image as ImageIcon, Link2, Upload, Download, History } from 'lucide-react';
import { compileEmailTemplate, EmailCategory } from '@/utils/templates';
import confetti from 'canvas-confetti';

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface EmailEditorProps {
  initialEmails?: string[];
}

export default function EmailEditor({ initialEmails }: EmailEditorProps) {
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

  // Email attachments (hosted in Supabase Storage)
  const [attachments, setAttachments] = useState<Array<{ filename: string; url: string; contentType: string; size: number }>>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // Inline body image insertion
  const [insertImageUrl, setInsertImageUrl] = useState('');
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);

  // Per-property preview fetch state (keyed by index)
  const [previewLoadingIdx, setPreviewLoadingIdx] = useState<number | null>(null);
  const [propertyError, setPropertyError] = useState<{ idx: number; text: string } | null>(null);
  const [propUploadingIdx, setPropUploadingIdx] = useState<number | null>(null);

  const [users, setUsers] = useState<Recipient[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>(initialEmails || []);
  const [filterQuery, setFilterQuery] = useState('');
  const [isPreviewDark, setIsPreviewDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLast, setLoadingLast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Guards against the initial /api/users effect clobbering a selection that
  // "Resend Last Campaign" set before users finished loading.
  const lastCampaignLoadedRef = useRef(false);

  // File input + textarea refs
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const propImageInputRef = useRef<HTMLInputElement>(null);
  const propImageTargetIdx = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Upload a single file to /api/upload, returning the stored asset metadata.
  const uploadFile = async (file: File): Promise<{ url: string; filename: string; contentType: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  };

  // Handle attachment file selection
  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAttachments(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        setAttachments(prev => [...prev, result]);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Attachment upload failed: ${err.message}` });
    } finally {
      setUploadingAttachments(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  // Escape a value before interpolating it into a raw HTML attribute to
  // prevent attribute breakout / injection.
  const escAttr = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Insert an <img> tag into the body at the caret (or append to the end)
  const insertImageIntoBody = (imageUrl: string) => {
    const tag = `<img src="${escAttr(imageUrl)}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`;
    const textarea = bodyRef.current;
    if (textarea && typeof textarea.selectionStart === 'number') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = body.slice(0, start) + tag + body.slice(end);
      setBody(next);
    } else {
      setBody(body + tag);
    }
  };

  // Upload an image file then insert it into the body
  const handleBodyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBodyImage(true);
    try {
      const result = await uploadFile(file);
      insertImageIntoBody(result.url);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Image upload failed: ${err.message}` });
    } finally {
      setUploadingBodyImage(false);
      if (bodyImageInputRef.current) bodyImageInputRef.current.value = '';
    }
  };

  const handleInsertImageUrl = () => {
    if (!insertImageUrl.trim()) return;
    insertImageIntoBody(insertImageUrl.trim());
    setInsertImageUrl('');
  };

  // Upload an image for a specific property row
  const handlePropImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = propImageTargetIdx.current;
    if (!file || idx === null) return;
    setPropUploadingIdx(idx);
    try {
      const result = await uploadFile(file);
      const copy = [...properties];
      copy[idx] = { ...copy[idx], image: result.url };
      setProperties(copy);
    } catch (err: any) {
      setPropertyError({ idx, text: `Image upload failed: ${err.message}` });
    } finally {
      setPropUploadingIdx(null);
      propImageTargetIdx.current = null;
      if (propImageInputRef.current) propImageInputRef.current.value = '';
    }
  };

  // Fetch Open Graph preview for a property's URL and populate empty fields
  const handleFetchPreview = async (idx: number) => {
    const prop = properties[idx];
    if (!prop.url || prop.url === '#') {
      setPropertyError({ idx, text: 'Enter a Property URL first.' });
      return;
    }
    setPreviewLoadingIdx(idx);
    setPropertyError(null);
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(prop.url)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Preview fetch failed');

      const copy = [...properties];
      const updated = { ...copy[idx] };
      if (result.image) updated.image = result.image;
      if (result.title && !updated.title) updated.title = result.title;
      if (result.siteName && !updated.location) updated.location = result.siteName;
      if (result.price && !updated.price) updated.price = result.price;
      copy[idx] = updated;
      setProperties(copy);
    } catch (err: any) {
      setPropertyError({ idx, text: err.message });
    } finally {
      setPreviewLoadingIdx(null);
    }
  };

  // Fetch recipients
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        // Don't overwrite a selection already set by "Resend Last Campaign".
        if (lastCampaignLoadedRef.current) return;
        if (!initialEmails || initialEmails.length === 0) {
          if (data.length > 0) {
            setSelectedEmails(data.map((u: any) => u.email));
          }
        } else {
          setSelectedEmails(initialEmails);
        }
      })
      .catch(err => console.error('Failed to load recipients:', err));
  }, [initialEmails]);

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

  const handleLoadLastCampaign = async () => {
    setLoadingLast(true);
    setStatusMessage({ type: null, text: '' });
    try {
      const res = await fetch('/api/campaigns/last');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load last campaign.');

      const payload = data.campaign;
      if (!payload) {
        setStatusMessage({ type: 'error', text: 'No previous campaign found.' });
        return;
      }

      setCategory(payload.category as EmailCategory);
      setSubject(payload.subject ?? '');
      setTitle(payload.title ?? '');
      setBody(payload.body ?? '');
      setActionText(payload.actionText ?? '');
      setActionUrl(payload.actionUrl ?? '');
      if (Array.isArray(payload.properties) && payload.properties.length > 0) {
        setProperties(payload.properties);
      }
      if (Array.isArray(payload.features) && payload.features.length > 0) {
        setFeatures(payload.features);
      }
      setAttachments(payload.attachments || []);

      // Preselect the previous audience, intersected with currently loaded
      // users. The button is gated on users being loaded, so `users` is
      // populated here; only select emails that still exist in the list.
      const recipientEmails: string[] = (data.recipients || []).map((r: any) => r.email);
      const known = new Set(users.map(u => u.email));
      setSelectedEmails(recipientEmails.filter(e => known.has(e)));
      // Backstop: prevent the initial /api/users effect from clobbering this
      // selection if it resolves after this handler.
      lastCampaignLoadedRef.current = true;

      setStatusMessage({ type: 'success', text: 'Loaded last campaign — review and click Send to resend.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingLast(false);
    }
  };

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
          attachments,
          recipients: selectedRecipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch campaign.');

      // Prefer server-provided counts; fall back to local count for older responses.
      const sentCount = typeof data.sentCount === 'number' ? data.sentCount : selectedRecipients.length;
      const failedCount = typeof data.failedCount === 'number' ? data.failedCount : 0;
      const skippedCount = typeof data.skippedCount === 'number' ? data.skippedCount : 0;
      const brevoSentCount = typeof data.brevoSentCount === 'number' ? data.brevoSentCount : 0;
      const fallbackUsed = !!data.fallbackUsed || brevoSentCount > 0;
      const brevoNote = brevoSentCount > 0 ? ` — ${brevoSentCount} delivered via Brevo fallback` : '';

      if (data.dailyLimitReached) {
        // If a fallback was attempted but both providers are now exhausted,
        // make that explicit; otherwise keep the plain daily-limit message.
        const text = fallbackUsed
          ? `Daily limits reached on both providers. Sent ${sentCount}, skipped ${skippedCount}.`
          : `Daily limit reached. Sent ${sentCount}, skipped ${skippedCount}.`;
        setStatusMessage({ type: 'error', text });
      } else if (failedCount > 0) {
        setStatusMessage({ type: 'error', text: `Sent ${sentCount}, failed ${failedCount}.` });
      } else {
        setStatusMessage({ type: 'success', text: `Campaign sent to ${sentCount} recipients${brevoNote}.` });
      }

      // Only celebrate when something sent and nothing failed.
      if (sentCount > 0 && failedCount === 0 && !data.dailyLimitReached) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              <Mail size={20} color="var(--brand-mint)" />
              Configure Campaign Alert
            </h2>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              disabled={loadingLast || users.length === 0}
              onClick={handleLoadLastCampaign}
            >
              <History size={14} /> {loadingLast ? 'Loading...' : 'Resend Last Campaign'}
            </button>
          </div>

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
              ref={bodyRef}
              className="form-control"
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
              <input
                ref={bodyImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBodyImageUpload}
              />
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                disabled={uploadingBodyImage}
                onClick={() => bodyImageInputRef.current?.click()}
              >
                <Upload size={14} /> {uploadingBodyImage ? 'Uploading...' : 'Upload Image'}
              </button>
              <input
                type="text"
                className="form-control"
                placeholder="Paste image URL to insert..."
                value={insertImageUrl}
                onChange={e => setInsertImageUrl(e.target.value)}
                style={{ flex: 1, minWidth: '160px', fontSize: '12px', padding: '8px 12px' }}
              />
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleInsertImageUrl}
              >
                <Link2 size={14} /> Insert URL
              </button>
            </div>
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
              <input
                ref={propImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePropImageUpload}
              />
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
                  <div style={{ marginBottom: '8px' }}>
                    <input type="text" className="form-control" placeholder="Location" value={prop.location} onChange={e => {
                      const copy = [...properties]; copy[idx].location = e.target.value; setProperties(copy);
                    }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" className="form-control" placeholder="Image URL" value={prop.image} onChange={e => {
                      const copy = [...properties]; copy[idx].image = e.target.value; setProperties(copy);
                    }} />
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      disabled={propUploadingIdx === idx}
                      onClick={() => { propImageTargetIdx.current = idx; propImageInputRef.current?.click(); }}
                    >
                      <ImageIcon size={14} /> {propUploadingIdx === idx ? 'Uploading...' : 'Upload image'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" className="form-control" placeholder="Property URL" value={prop.url} onChange={e => {
                      const copy = [...properties]; copy[idx].url = e.target.value; setProperties(copy);
                    }} />
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      disabled={previewLoadingIdx === idx}
                      onClick={() => handleFetchPreview(idx)}
                    >
                      <Download size={14} /> {previewLoadingIdx === idx ? 'Fetching...' : 'Fetch preview'}
                    </button>
                  </div>
                  {propertyError && propertyError.idx === idx && (
                    <div style={{ fontSize: '12px', color: 'var(--status-danger)', marginBottom: '8px' }}>
                      {propertyError.text}
                    </div>
                  )}
                  <button className="btn btn-secondary" style={{ color: 'var(--status-danger)', width: '100%' }} onClick={() => setProperties(properties.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} /> Remove
                  </button>
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

          {/* Attachments */}
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paperclip size={14} /> Attachments ({attachments.length})
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                disabled={uploadingAttachments}
                onClick={() => attachmentInputRef.current?.click()}
              >
                <Plus size={12} /> {uploadingAttachments ? 'Uploading...' : 'Add Files'}
              </button>
            </label>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleAttachmentChange}
            />
            {attachments.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {attachments.map((att, idx) => (
                  <div key={idx} className="dynamic-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.filename} <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({(att.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ color: 'var(--status-danger)', padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recipient Targeting Selector */}
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Target Recipients ({selectedEmails.length}/{users.length})</label>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={toggleSelectAll}>
                {selectedEmails.length === users.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <input
              type="text"
              className="form-control"
              placeholder="Search target list by email or name..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              style={{ fontSize: '12px', padding: '8px 12px', marginBottom: '8px' }}
            />

            <div className="recipient-list">
              {users.filter(u => 
                u.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
                `${u.first_name} ${u.last_name}`.toLowerCase().includes(filterQuery.toLowerCase())
              ).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No matching contacts.
                </div>
              ) : (
                users.filter(u => 
                  u.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
                  `${u.first_name} ${u.last_name}`.toLowerCase().includes(filterQuery.toLowerCase())
                ).map(user => (
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
                ))
              )}
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
