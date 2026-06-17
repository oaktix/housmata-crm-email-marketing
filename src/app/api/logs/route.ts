import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ---------------------------------------------------------------------
    // CORE delivery data. These queries must NOT reference any open-tracking
    // column (opened_at / open_count). Their success is what makes the
    // Delivery Logs view work. If the open-tracking layer is broken on the
    // live DB, these queries are unaffected and the delivery log still renders.
    // ---------------------------------------------------------------------

    // CORE campaigns query (no open-tracking columns). On error, fall back to empty.
    let campaigns: any[] = [];
    {
      const { data, error } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, subject, category, sent_count, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch email_campaigns, treating as empty:', error.message);
      } else {
        campaigns = data || [];
      }
    }

    // CORE logs query (no open-tracking columns), newest first, capped at 500.
    // On error, fall back to empty.
    let logs: any[] = [];
    {
      const { data, error } = await supabaseAdmin
        .from('email_logs')
        .select('id, recipient_email, recipient_name, category, status, error_message, sent_at')
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) {
        console.warn('Failed to fetch email_logs, treating as empty:', error.message);
      } else {
        logs = data || [];
      }
    }

    // ---------------------------------------------------------------------
    // OPEN-TRACKING data. Fetched and guarded INDEPENDENTLY of the core data.
    // Any error here (broken opened_at / open_count columns, missing
    // email_opens table, broken on_email_opened trigger, etc.) must degrade
    // to zero/empty without affecting the core delivery data above.
    // ---------------------------------------------------------------------

    // opened_at per log id. Own guard; empty map on error => treated as no opens.
    const openedAtByLogId = new Map<any, string | null>();
    {
      try {
        const { data, error } = await supabaseAdmin
          .from('email_logs')
          .select('id, opened_at')
          .order('sent_at', { ascending: false })
          .limit(500);

        if (error) {
          console.warn('Failed to fetch email_logs open data, treating opens as empty:', error.message);
        } else {
          for (const row of data || []) {
            openedAtByLogId.set(row.id, row.opened_at ?? null);
          }
        }
      } catch (openErr: any) {
        console.warn('Failed to fetch email_logs open data, treating opens as empty:', openErr?.message);
      }
    }

    // open_count per campaign id. Own guard; missing => treated as 0.
    const openCountByCampaignId = new Map<any, number>();
    {
      try {
        const { data, error } = await supabaseAdmin
          .from('email_campaigns')
          .select('id, open_count');

        if (error) {
          console.warn('Failed to fetch email_campaigns open data, treating open counts as 0:', error.message);
        } else {
          for (const row of data || []) {
            openCountByCampaignId.set(row.id, row.open_count ?? 0);
          }
        }
      } catch (openErr: any) {
        console.warn('Failed to fetch email_campaigns open data, treating open counts as 0:', openErr?.message);
      }
    }

    // ---------------------------------------------------------------------
    // Merge open data back onto the core rows. Response shapes stay identical
    // to before: logs include opened_at; campaigns include open_count.
    // ---------------------------------------------------------------------
    logs = logs.map((l) => ({
      ...l,
      opened_at: openedAtByLogId.has(l.id) ? openedAtByLogId.get(l.id) ?? null : null,
    }));

    campaigns = campaigns.map((c) => ({
      ...c,
      open_count: openCountByCampaignId.get(c.id) ?? 0,
    }));

    // ---------------------------------------------------------------------
    // Summary metrics. totalSent / deliveryRate derive purely from the core
    // delivery data and are correct regardless of open-data availability.
    // totalOpens / avgOpenRate derive from the merged opened_at values and
    // naturally become 0 when open data is unavailable.
    // ---------------------------------------------------------------------
    const totalSent = logs.filter((l) => l.status === 'sent').length;
    const totalOpens = logs.filter((l) => l.opened_at != null).length;
    const attempted = logs.filter((l) => l.status !== 'pending').length;

    const avgOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
    const deliveryRate = attempted > 0 ? Math.round((totalSent / attempted) * 100) : 0;

    // Build daily buckets for the last 7 calendar days (oldest -> newest), keyed by local date.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const dailyStats: Array<{ date: string; sent: number; opens: number }> = [];
    const buckets = new Map<string, { date: string; sent: number; opens: number }>();

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dayKey(d);
      const entry = {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sent: 0,
        opens: 0,
      };
      buckets.set(key, entry);
      dailyStats.push(entry);
    }

    for (const log of logs) {
      // `sent` derives purely from core delivery data.
      if (log.status === 'sent' && log.sent_at) {
        const bucket = buckets.get(dayKey(new Date(log.sent_at)));
        if (bucket) bucket.sent++;
      }
      // `opens` derives from merged open data; 0 when open data is unavailable.
      if (log.opened_at) {
        const bucket = buckets.get(dayKey(new Date(log.opened_at)));
        if (bucket) bucket.opens++;
      }
    }

    return NextResponse.json({
      campaigns,
      logs,
      dailyStats,
      summary: { totalSent, totalOpens, avgOpenRate, deliveryRate },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
