// Housmata CRM Email Templates Compiler
// Contains responsive layouts, brand color schemes, dark mode styles, and CSS animations.

export type EmailCategory = 'New Property Alert' | 'Downtime Alert' | 'Newsletter' | 'New Features Alert' | 'Regular Alerts';

export interface EmailTemplateData {
  category: EmailCategory;
  subject: string;
  recipientName?: string;
  title: string;
  body: string; // Markdown/HTML body
  actionUrl?: string;
  actionText?: string;
  properties?: Array<{
    title: string;
    price: string;
    location: string;
    image: string;
    url: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
}

export function compileEmailTemplate(data: EmailTemplateData, trackingUrl?: string): string {
  const { category, subject, recipientName, title, body, actionUrl, actionText } = data;
  const brandTeal = '#00624d'; // Deep forest teal/green
  const brandMint = '#1bbca3'; // Bright minty teal
  const bgLight = '#f8fafc';
  const textLight = '#1e293b';

  // Base styling and container configurations per category
  let categoryStyles = '';
  let categoryContent = '';
  let animationStyles = '';

  // 1. CSS animations keyframes definition
  const keyframes = `
    @keyframes pulse-radar {
      0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(27, 188, 163, 0.4); }
      70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 10px rgba(27, 188, 163, 0); }
      100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(27, 188, 163, 0); }
    }
    @keyframes alert-pulse {
      0% { transform: scale(0.95); opacity: 0.5; }
      50% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.5; }
    }
    @keyframes soft-float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
      100% { transform: translateY(0px); }
    }
    @keyframes slide-highlight {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes subtle-fade {
      from { opacity: 0.8; }
      to { opacity: 1; }
    }
  `;

  // Define template content and styles per category
  switch (category) {
    case 'New Property Alert':
      animationStyles = `
        .cta-btn {
          animation: pulse-radar 3s infinite ease-in-out;
        }
        .property-card {
          transition: transform 0.3s ease;
        }
        .property-card:hover {
          transform: translateY(-4px);
        }
      `;
      categoryStyles = `
        .header-bar { background: linear-gradient(135deg, ${brandTeal} 0%, #0d2b25 100%); border-bottom: 4px solid ${brandMint}; }
        .hero-title { color: #ffffff; }
      `;
      // Property showcase details if available
      if (data.properties && data.properties.length > 0) {
        categoryContent = `
          <div style="margin-top: 24px;">
            <h3 style="color: ${brandTeal}; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px;">Latest Matches for You</h3>
            <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 16px;">
              ${data.properties.map(prop => `
                <div class="property-card" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
                  ${prop.image ? `<img src="${prop.image}" alt="${prop.title}" style="width: 100%; height: 180px; object-fit: cover;" />` : ''}
                  <div style="padding: 16px;">
                    <div style="font-weight: bold; font-size: 18px; color: ${brandTeal};">${prop.price}</div>
                    <div style="font-weight: bold; font-size: 16px; margin-top: 4px; color: #1e293b;">${prop.title}</div>
                    <div style="font-size: 14px; color: #64748b; margin-top: 2px;">📍 ${prop.location}</div>
                    <a href="${prop.url}" style="display: inline-block; margin-top: 12px; font-size: 14px; color: ${brandMint}; font-weight: bold; text-decoration: none;">View Property Detail →</a>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      break;

    case 'Downtime Alert':
      animationStyles = `
        .alert-badge {
          animation: alert-pulse 2s infinite ease-in-out;
        }
      `;
      categoryStyles = `
        .header-bar { background: #7f1d1d; border-bottom: 4px solid #ef4444; }
        .hero-title { color: #ffffff; }
        .alert-box { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin: 20px 0; }
      `;
      categoryContent = `
        <div class="alert-box">
          <div style="display: flex; align-items: center;">
            <span class="alert-badge" style="display: inline-block; width: 12px; height: 12px; background-color: #ef4444; border-radius: 50%; margin-right: 8px;"></span>
            <strong style="color: #7f1d1d;">Scheduled / Active Outage Warning</strong>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #991b1b;">Our system might experience intermittent downtime while we roll out upgrades. Thanks for your patience.</p>
        </div>
      `;
      break;

    case 'Newsletter':
      animationStyles = `
        .newsletter-graphic {
          animation: soft-float 4s infinite ease-in-out;
        }
      `;
      categoryStyles = `
        .header-bar { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 4px solid ${brandTeal}; }
        .hero-title { color: #ffffff; font-family: 'Playfair Display', Georgia, serif; }
      `;
      categoryContent = `
        <div style="text-align: center; padding: 24px 0;" class="newsletter-graphic">
          <span style="font-size: 48px;">📰</span>
        </div>
      `;
      break;

    case 'New Features Alert':
      animationStyles = `
        .sparkle-text {
          background: linear-gradient(90deg, ${brandMint}, #3b82f6, ${brandMint});
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: slide-highlight 3s linear infinite;
        }
      `;
      categoryStyles = `
        .header-bar { background: linear-gradient(135deg, #0b1a17 0%, ${brandTeal} 100%); border-bottom: 4px solid ${brandMint}; }
        .hero-title { color: #ffffff; }
      `;
      if (data.features && data.features.length > 0) {
        categoryContent = `
          <div style="margin-top: 24px;">
            <h3 class="sparkle-text" style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">What's New!</h3>
            <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
              ${data.features.map(feat => `
                <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                  <div style="font-size: 24px; margin-bottom: 8px;">${feat.icon || '✨'}</div>
                  <h4 style="margin: 0; color: ${brandTeal}; font-size: 16px;">${feat.title}</h4>
                  <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">${feat.description}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      break;

    default: // Regular Alerts
      animationStyles = `
        .container {
          animation: subtle-fade 1.5s ease-out;
        }
      `;
      categoryStyles = `
        .header-bar { background: ${brandTeal}; border-bottom: 4px solid ${brandMint}; }
        .hero-title { color: #ffffff; }
      `;
      break;
  }

  // Tracking Image HTML code if enabled
  const trackingPixel = trackingUrl ? `<img src="${trackingUrl}" width="1" height="1" style="display:none !important; width:1px !important; height:1px !important;" alt="" />` : '';

  // Construct complete HTML string
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject}</title>
  <style>
    /* CSS Reset */
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: ${bgLight};
      color: ${textLight};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    img {
      max-width: 100%;
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }

    /* Layout Elements */
    .email-wrapper {
      width: 100%;
      background-color: ${bgLight};
      padding: 24px 12px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header-bar {
      padding: 32px 24px;
      text-align: center;
    }
    .content-body {
      padding: 32px 24px;
      line-height: 1.6;
      font-size: 16px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .cta-btn {
      display: inline-block;
      background-color: ${brandMint};
      color: #000000 !important;
      padding: 14px 28px;
      font-weight: bold;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    .footer-bar {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
    }

    /* Keyframes Animations */
    ${keyframes}
    
    /* Category Specific Styles */
    ${categoryStyles}
    ${animationStyles}

    /* Dark Mode Overrides (Devices supporting CSS preferences-color-scheme) */
    @media (prefers-color-scheme: dark) {
      body, .email-wrapper {
        background-color: #0b1a17 !important;
        color: #f0f5f4 !important;
      }
      .email-container {
        background-color: #0d1b18 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
        border: 1px solid #1bbca333;
      }
      .content-body {
        color: #e2e8f0 !important;
      }
      .property-card, .alert-box, .features-card, .footer-bar {
        background-color: #112521 !important;
        border-color: #1c3631 !important;
      }
      .property-card div, .alert-box strong, .features-card h4 {
        color: #ffffff !important;
      }
      .footer-bar {
        color: #8fa09d !important;
        border-top-color: #1c3631 !important;
      }
      .logo-image {
        /* Filter to convert black/dark text elements of Logo Alt 1 to white/light */
        filter: brightness(0) invert(1);
      }
      a {
        color: ${brandMint} !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      
      <!-- Email Header Banner -->
      <div class="header-bar">
        <!-- Brand identity -->
        <h2 class="hero-title" style="margin: 0; font-size: 24px; font-weight: 800; tracking: -0.025em;">
          hous<span style="color: ${brandMint};">mata</span>
        </h2>
        <div style="font-size: 12px; margin-top: 6px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; color: #ffffff;">
          ${category}
        </div>
      </div>

      <!-- Email Body -->
      <div class="content-body">
        ${recipientName ? `<p style="margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>` : ''}
        <h2 style="font-size: 20px; font-weight: 700; color: ${brandTeal}; margin-top: 0; margin-bottom: 16px;">${title}</h2>
        <div style="margin-bottom: 24px;">
          ${body}
        </div>

        <!-- Render Custom components dynamic content (Properties/Features/Outage details) -->
        ${categoryContent}

        <!-- Call to action button -->
        ${actionUrl && actionText ? `
          <div class="cta-container">
            <a href="${actionUrl}" class="cta-btn">${actionText}</a>
          </div>
        ` : ''}
      </div>

      <!-- Footer Info -->
      <div class="footer-bar">
        <p style="margin: 0 0 8px 0;">This email is sent on behalf of <strong>Housmata CRM</strong></p>
        <p style="margin: 0 0 16px 0;">If you no longer wish to receive these emails, you can <a href="#" style="color: ${brandTeal}; text-decoration: underline;">unsubscribe here</a>.</p>
        <p style="margin: 0; font-size: 10px; opacity: 0.7;">© 2026 Housmata CRM Inc. All rights reserved.</p>
      </div>

    </div>
  </div>
  <!-- Open Tracking pixel -->
  ${trackingPixel}
</body>
</html>`;
}
