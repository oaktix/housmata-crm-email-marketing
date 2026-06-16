import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

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

    // Log the open event asynchronously without blocking the GIF delivery
    supabaseAdmin
      .from('email_opens')
      .insert({
        email_log_id: emailLogId,
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Failed to log email open event:', error.message);
        } else {
          console.log(`Email open recorded for log ID: ${emailLogId}`);
        }
      });
  }

  // Return the pixel image
  return new NextResponse(ONEXONE_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
