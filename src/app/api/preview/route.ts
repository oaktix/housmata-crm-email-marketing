import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns';

const FETCH_TIMEOUT_MS = 5000;
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024; // 2 MB hard cap
const MAX_PARSE_LENGTH = 1 * 1024 * 1024; // truncate to 1 MB before regex parsing

// Reject loopback, private, link-local (incl. cloud metadata), and unspecified
// addresses to prevent SSRF against internal services.
function isBlockedAddress(ip: string): boolean {
  // Normalise IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const addr = v4Mapped ? v4Mapped[1] : ip;

  if (addr.includes('.')) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
      return true; // malformed -> block
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8 (incl. unspecified)
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. metadata)
    return false;
  }

  // IPv6
  const lower = addr.toLowerCase();
  if (lower === '::' || lower === '::1') return true; // unspecified / loopback
  if (lower.startsWith('fe80')) return true; // fe80::/10 link-local
  // fc00::/7 unique local (fc00 - fdff)
  if (/^f[cd]/.test(lower)) return true;
  return false;
}

// Decode the most common HTML entities found in meta tag content.
function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

// Match a meta tag for a given og/name key, handling BOTH attribute orders:
//   <meta property="og:title" content="...">  and
//   <meta content="..." property="og:title">
function getMetaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // property/name appears before content
  const before = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  // content appears before property/name
  const after = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`,
    'i'
  );
  const m = html.match(before) || html.match(after);
  return m ? decodeEntities(m[1].trim()) : '';
}

// Empty preview payload returned when a URL is fetchable but yields no usable
// preview (e.g. a redirect we refuse to follow).
function emptyPreview(url: string) {
  return NextResponse.json({
    title: '',
    description: '',
    image: '',
    siteName: '',
    price: '',
    url,
  });
}

export async function GET(req: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate the URL scheme and host before making any request (SSRF guard).
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost') {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    // Resolve the hostname and reject if ANY resolved address is internal.
    try {
      const resolved = await dns.promises.lookup(hostname, { all: true });
      if (resolved.length === 0 || resolved.some(r => isBlockedAddress(r.address))) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HousmataBot/1.0; +https://housmata.com)',
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    // Do not follow redirects automatically to avoid redirect-based SSRF
    // bypass. Treat any 3xx as "no preview available".
    if (res.status >= 300 && res.status < 400) {
      return emptyPreview(url);
    }

    // Reject oversized responses based on the declared content length.
    const contentLength = Number(res.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    // Truncate the body before regex parsing to bound work on large responses.
    const html = (await res.text()).slice(0, MAX_PARSE_LENGTH);

    let title = getMetaContent(html, 'og:title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        title = decodeEntities(titleMatch[1].trim());
      }
    }

    let description = getMetaContent(html, 'og:description');
    if (!description) {
      description = getMetaContent(html, 'description');
    }

    let image = getMetaContent(html, 'og:image');
    const siteName = getMetaContent(html, 'og:site_name');
    const ogUrl = getMetaContent(html, 'og:url');
    const price =
      getMetaContent(html, 'product:price:amount') ||
      getMetaContent(html, 'og:price:amount') ||
      '';

    // Resolve relative / protocol-relative image URLs to absolute
    if (image && !/^https?:\/\//i.test(image)) {
      try {
        image = new URL(image, url).href;
      } catch {
        // leave image as-is if it cannot be resolved
      }
    }

    return NextResponse.json({
      title,
      description,
      image,
      siteName,
      price,
      url: ogUrl || url,
    });
  } catch (err: any) {
    console.error('Preview route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
