import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch the most recent campaign. Prefer selecting `config`, but fall back
    // to the flat columns if the live DB doesn't have the column yet.
    let { data: campaign, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('id, subject, body, category, config, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && (error.message || '').toLowerCase().includes('config')) {
      ({ data: campaign, error } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, subject, body, category, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    if (error || !campaign) {
      return NextResponse.json({ campaign: null });
    }

    // Recover recipients from the per-email logs, de-duplicated by email.
    const { data: logs } = await supabaseAdmin
      .from('email_logs')
      .select('recipient_email, recipient_name')
      .eq('campaign_id', campaign.id);

    const seen = new Set<string>();
    const recipients: Array<{ email: string; first_name: string | null }> = [];
    for (const log of logs || []) {
      if (!log.recipient_email || seen.has(log.recipient_email)) continue;
      seen.add(log.recipient_email);
      recipients.push({ email: log.recipient_email, first_name: log.recipient_name ?? null });
    }

    // Prefer the persisted full config; fall back to flat columns.
    const config: any = (campaign as any).config || null;
    const payload = {
      subject: config?.subject ?? campaign.subject,
      category: config?.category ?? campaign.category,
      title: config?.title ?? '',
      body: config?.body ?? campaign.body,
      actionText: config?.actionText ?? '',
      actionUrl: config?.actionUrl ?? '',
      properties: config?.properties ?? [],
      features: config?.features ?? [],
      attachments: config?.attachments ?? [],
    };

    return NextResponse.json({
      campaign: { ...payload, id: campaign.id, created_at: campaign.created_at },
      recipients,
    });
  } catch (err: any) {
    console.error('Last campaign route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
