import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch campaigns (newest first). On query error, fall back to an empty set.
    let campaigns: any[] = [];
    {
      const { data, error } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, subject, category, sent_count, open_count, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch email_campaigns, treating as empty:', error.message);
      } else {
        campaigns = data || [];
      }
    }

    // Fetch logs (newest first, capped at most recent 500). On query error, fall back to empty.
    let logs: any[] = [];
    {
      const { data, error } = await supabaseAdmin
        .from('email_logs')
        .select('id, recipient_email, recipient_name, category, status, error_message, sent_at, opened_at')
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) {
        console.warn('Failed to fetch email_logs, treating as empty:', error.message);
      } else {
        logs = data || [];
      }
    }

    // Summary metrics derived from the fetched logs.
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
      if (log.status === 'sent' && log.sent_at) {
        const bucket = buckets.get(dayKey(new Date(log.sent_at)));
        if (bucket) bucket.sent++;
      }
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
