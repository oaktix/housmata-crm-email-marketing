import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

// 1x1 transparent GIF base64
const ONEXONE_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailLogId = searchParams.get('id');

  if (emailLogId) {
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'Unknown';

    // Record the open event synchronously (awaited) before returning the pixel.
    // On serverless runtimes the function may be frozen/terminated right after
    // the response is sent, so fire-and-forget inserts are unreliable.
    try {
      const { error: insertError } = await supabaseAdmin
        .from('email_opens')
        .insert({
          email_log_id: emailLogId,
          user_agent: userAgent,
          ip_address: ipAddress,
        });

      if (insertError) {
        console.error('Failed to log email open event:', insertError.message);
      }

      // Idempotently record the FIRST open time on the email log. The
      // `.is('opened_at', null)` filter makes this a no-op when the
      // `on_email_opened` DB trigger has already set opened_at, so it is safe.
      // NOTE: do NOT touch email_campaigns.open_count here — the
      // on_email_opened trigger handles that and updating it would double-count.
      const { error: updateError } = await supabaseAdmin
        .from('email_logs')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', emailLogId)
        .is('opened_at', null);

      if (updateError) {
        console.error('Failed to update email log opened_at:', updateError.message);
      }
    } catch (err) {
      console.error('Unexpected error recording email open:', err);
    }
  }

  // Always return the pixel image, regardless of whether tracking succeeded.
  return new NextResponse(ONEXONE_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
