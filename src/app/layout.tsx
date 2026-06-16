import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Housmata CRM - Email Marketing Hub',
  description: 'Internal campaign publisher and performance tracker for Housmata CRM alerts.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="container header-content">
            <div className="logo-container">
              <div className="logo-icon">H</div>
              <h1 className="logo-text">
                hous<span>mata</span>
              </h1>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Campaign Hub 🚀
            </div>
          </div>
        </header>
        <main className="container" style={{ flex: 1, padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
