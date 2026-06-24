import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import Header from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Housmata CRM - Email Marketing Hub',
  description: 'Internal campaign publisher and performance tracker for Housmata CRM alerts.',
  icons: {
    icon: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('housmata_session');
  
  let user = null;
  if (sessionCookie && sessionCookie.value) {
    try {
      user = JSON.parse(sessionCookie.value).user;
    } catch (e) {
      console.error('Failed to parse user session cookie:', e);
    }
  }

  return (
    <html lang="en">
      <body>
        <Header user={user} />
        <main className="container" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}

