import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Resend last_event values that should mark a log as failed.
const FAILED_EVENTS = new Set([
  'bounced',
  'complained',
  'failed',
  'suppressed',
  'canceled',
]);

// Resend last_event values that mean delivery is progressing/succeeded.
// We never downgrade an already-'sent' log for these.
const HEALTHY_EVENTS = new Set([
  'delivered',
  'sent',
  'queued',
  'scheduled',
  'delivery_delayed',
]);

export async function POST(req: NextRequest) {
  // Counters returned in the summary.
  let scanned = 0;
  let matched = 0;
  let updatedDelivered = 0;
  let updatedFailed = 0;
  let updatedOpened = 0;
  let unmatched = 0;
  let pages = 0;

  try {
    // 1. Auth.
    const authHeader = req.headers.get('authorization');
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 2. Resend client.
    const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

    const windowMs = 48 * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);
    const windowStartIso = windowStart.toISOString();

    // 3. Candidate logs from Supabase.
    const candidates = new Map<string, { id: string; opened_at: string | null }>();
    {
      const { data: rows, error: rowsErr } = await supabaseAdmin
        .from('email_logs')
        .select('id, provider_message_id, status, opened_at')
        .not('provider_message_id', 'is', null)
        .in('status', ['sent', 'pending'])
        .gt('sent_at', windowStartIso)
        .order('sent_at', { ascending: false })
        .limit(500);

      if (rowsErr) {
        console.error('cron/sync: failed to load candidate logs:', rowsErr.message);
      } else if (rows) {
        for (const row of rows) {
          if (row.provider_message_id) {
            candidates.set(row.provider_message_id, {
              id: row.id,
              opened_at: row.opened_at ?? null,
            });
          }
        }
      }
    }

    // 4. Fetch recent emails from Resend with bounded pagination.
    let resendError: string | undefined;
    const emails: Array<{
      id: string;
      last_event: string;
      created_at: string;
    }> = [];

    try {
      let after: string | undefined;
      while (pages < 5) {
        const options: { limit: number; after?: string } = { limit: 100 };
        if (after) options.after = after;

        const { data: listData, error: listErr } = await resend.emails.list(options);
        if (listErr) {
          resendError = listErr.message;
          break;
        }
        if (!listData) {
          break;
        }

        pages += 1;

        const pageItems = listData.data ?? [];
        for (const item of pageItems) {
          emails.push({
            id: item.id,
            last_event: item.last_event,
            created_at: item.created_at,
          });
        }

        // Stop conditions.
        if (pageItems.length === 0) break;

        const oldestCreatedAt = pageItems
          .map((it) => new Date(it.created_at).getTime())
          .reduce((min, t) => (t < min ? t : min), Number.POSITIVE_INFINITY);
        if (oldestCreatedAt < windowStart.getTime()) break;

        if (!listData.has_more) break;

        after = pageItems[pageItems.length - 1]?.id;
        if (!after) break;
      }
    } catch (err: any) {
      resendError = err?.message || String(err);
    }

    scanned = emails.length;

    // 5. Reconcile each fetched email against the candidate map.
    for (const email of emails) {
      const candidate = candidates.get(email.id);
      if (!candidate) {
        unmatched += 1;
        continue;
      }
      matched += 1;

      const nowIso = new Date().toISOString();
      const patch: {
        delivery_status: string;
        delivery_synced_at: string;
        status?: string;
        error_message?: string;
        opened_at?: string;
      } = {
        delivery_status: email.last_event,
        delivery_synced_at: nowIso,
      };

      let countFailed = false;
      let countDelivered = false;
      let countOpened = false;

      if (FAILED_EVENTS.has(email.last_event)) {
        patch.status = 'failed';
        patch.error_message = 'Resend: ' + email.last_event;
        countFailed = true;
      } else if (HEALTHY_EVENTS.has(email.last_event)) {
        // Leave status as 'sent' — do not downgrade. Omit status from the patch.
        countDelivered = true;
      } else if (email.last_event === 'opened') {
        if (candidate.opened_at === null) {
          patch.opened_at = nowIso;
          countOpened = true;
        }
      }

      try {
        const { error: updErr } = await supabaseAdmin
          .from('email_logs')
          .update(patch)
          .eq('provider_message_id', email.id);

        if (updErr) {
          console.error(
            `cron/sync: failed updating log for ${email.id}:`,
            updErr.message
          );
          continue;
        }

        if (countFailed) updatedFailed += 1;
        if (countDelivered) updatedDelivered += 1;
        if (countOpened) updatedOpened += 1;
      } catch (err: any) {
        console.error(
          `cron/sync: error updating log for ${email.id}:`,
          err?.message || err
        );
      }
    }

    return NextResponse.json({
      scanned,
      matched,
      updatedDelivered,
      updatedFailed,
      updatedOpened,
      unmatched,
      pages,
      ...(resendError ? { error: resendError } : {}),
    });
  } catch (err: any) {
    // pg_net is fire-and-forget; surface the error in a 200 body so it is
    // visible via curl rather than swallowed as an invisible 500.
    return NextResponse.json({
      scanned,
      matched,
      updatedDelivered,
      updatedFailed,
      updatedOpened,
      unmatched,
      pages,
      error: err?.message || String(err),
    });
  }
}
