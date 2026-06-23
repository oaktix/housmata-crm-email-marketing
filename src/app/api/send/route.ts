import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { compileEmailTemplate, EmailCategory } from '@/utils/templates';
import { sendEmail, SendMailOptions } from '@/utils/mailer';

// Pace sends safely under Resend's 5 req/sec limit (~4/sec) and retry transient 429s.
const MIN_SEND_INTERVAL_MS = 250;
const MAX_RETRIES = 4;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Detect transient rate-limit (429) errors that are worth retrying.
// Checks the structured signal (code/statusCode from MailerError) first, then
// falls back to message-substring matching.
function isRateLimitError(err: any): boolean {
  if (err?.code === 'rate_limit_exceeded' || err?.statusCode === 429) return true;
  const m = (err?.message || '').toLowerCase();
  return (
    m.includes('too many requests') ||
    m.includes('rate limit') ||
    m.includes('rate_limit')
  );
}

// Detect daily-quota exhaustion (e.g. Resend free tier: 100 emails/day).
// Checks the structured signal (code from MailerError) first, then falls back
// to message-substring matching.
function isDailyLimitError(err: any): boolean {
  if (err?.code === 'daily_quota_exceeded') return true;
  const m = (err?.message || '').toLowerCase();
  return m.includes('daily');
}

// Send with exponential-backoff retry ONLY on rate-limit errors.
async function sendWithRetry(options: SendMailOptions): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await sendEmail(options);
    } catch (err: any) {
      // Daily-limit errors are not retryable — let the caller stop gracefully.
      if (isDailyLimitError(err)) throw err;
      // Retry only rate-limit errors, and only if we have attempts left.
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        await sleep(Math.min(1000 * 2 ** attempt, 8000));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies the type checker.
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const bodyData = await req.json();
    const {
      subject,
      category,
      title,
      body,
      recipients, // Array of { email: string, first_name?: string }
      actionText,
      actionUrl,
      properties,
      features,
      attachments,
      staffId,
    } = bodyData;

    if (!subject || !category || !title || !body || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Full reusable payload, persisted so a campaign can be reloaded/resent.
    const campaignConfig = {
      subject,
      category,
      title,
      body,
      actionText,
      actionUrl,
      properties: properties || [],
      features: features || [],
      attachments: attachments || [],
    };

    // 1. Create a campaign record
    let campaignId = null;
    const baseCampaignRow = {
      subject,
      body,
      category,
      sent_by: staffId || null,
      sent_count: recipients.length,
    };

    let { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({ ...baseCampaignRow, config: campaignConfig })
      .select()
      .single();

    // Graceful degradation: the live DB may not have the `config` column yet.
    // If the insert failed specifically because of that column, retry without it.
    if (campaignErr && (campaignErr.message || '').toLowerCase().includes('config')) {
      console.warn('email_campaigns.config column missing — inserting without config:', campaignErr.message);
      ({ data: campaign, error: campaignErr } = await supabaseAdmin
        .from('email_campaigns')
        .insert(baseCampaignRow)
        .select()
        .single());
    }

    if (!campaignErr && campaign) {
      campaignId = campaign.id;
    } else {
      console.warn('Failed to insert campaign record in Supabase:', campaignErr?.message);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const dispatchResults: Array<{ email: string; success: boolean; error?: string; skipped?: boolean }> = [];

    let dailyLimitReached = false;
    let lastSendStartedAt = 0;

    // 2. Dispatch emails
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      // Create a unique log ID for this email dispatch to track opens
      let logId = crypto.randomUUID();

      // Attempt to register individual log row in Supabase
      if (campaignId) {
        const { data: logRow, error: logErr } = await supabaseAdmin
          .from('email_logs')
          .insert({
            id: logId,
            campaign_id: campaignId,
            recipient_email: recipient.email,
            recipient_name: recipient.first_name || null,
            category,
            status: 'pending',
          })
          .select()
          .single();

        if (logErr) {
          console.error('Failed to log individual email prep:', logErr.message);
        } else if (logRow) {
          logId = logRow.id;
        }
      }

      // Generate tracking URL linking to this dispatch log ID
      const trackingUrl = `${appUrl}/api/track?id=${logId}`;

      // Replace personalization tags in subject, title, and body for this recipient
      const personalizedSubject = subject
        .replace(/\{\{first_name\}\}/gi, recipient.first_name || '')
        .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
        .replace(/\{\{email\}\}/gi, recipient.email || '');

      const personalizedTitle = title
        .replace(/\{\{first_name\}\}/gi, recipient.first_name || '')
        .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
        .replace(/\{\{email\}\}/gi, recipient.email || '');

      const personalizedBody = body
        .replace(/\{\{first_name\}\}/gi, recipient.first_name || '')
        .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
        .replace(/\{\{email\}\}/gi, recipient.email || '');

      // Compile template
      const htmlContent = compileEmailTemplate({
        category: category as EmailCategory,
        subject: personalizedSubject,
        recipientName: recipient.first_name,
        title: personalizedTitle,
        body: personalizedBody,
        actionText,
        actionUrl,
        properties,
        features,
      }, trackingUrl);

      // Pace requests to stay under Resend's rate limit.
      const waitMs = lastSendStartedAt + MIN_SEND_INTERVAL_MS - Date.now();
      if (waitMs > 0) await sleep(waitMs);

      try {
        // Send email via Resend. The client sends attachments as
        // { filename, url, contentType, size }; map them to the mailer's
        // shape so a hosted attachment URL reaches Resend as { filename, path }.
        lastSendStartedAt = Date.now();
        const sendRes = await sendWithRetry({
          to: recipient.email,
          subject: personalizedSubject,
          html: htmlContent,
          attachments: attachments?.length
            ? attachments.map((a: any) => ({
                filename: a.filename,
                path: a.url || a.path,
                content: a.content,
              }))
            : undefined,
        });

        // Update log to 'sent'
        if (campaignId) {
          await supabaseAdmin
            .from('email_logs')
            .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: sendRes?.id ?? null })
            .eq('id', logId);
        }

        dispatchResults.push({ email: recipient.email, success: true });
      } catch (sendErr: any) {
        console.error(`Failed sending to ${recipient.email}:`, sendErr.message);

        // Daily-limit reached: stop and skip the rest. Keep the DB row marked
        // 'failed', but flag the result as `skipped` so the returned counts
        // attribute this recipient to skippedCount (Sent + skipped covers all
        // non-sent recipients in the daily-limit case).
        if (isDailyLimitError(sendErr)) {
          dailyLimitReached = true;

          if (campaignId) {
            await supabaseAdmin
              .from('email_logs')
              .update({ status: 'failed', error_message: 'Resend daily sending limit reached' })
              .eq('id', logId);
          }

          dispatchResults.push({
            email: recipient.email,
            success: false,
            error: 'Resend daily sending limit reached',
            skipped: true,
          });

          // Mark all remaining (un-attempted) recipients as skipped.
          for (let j = i + 1; j < recipients.length; j++) {
            dispatchResults.push({
              email: recipients[j].email,
              success: false,
              error: 'Skipped — daily sending limit reached',
              skipped: true,
            });
          }
          break;
        }

        // Update log to 'failed'
        if (campaignId) {
          await supabaseAdmin
            .from('email_logs')
            .update({ status: 'failed', error_message: sendErr.message })
            .eq('id', logId);
        }

        dispatchResults.push({ email: recipient.email, success: false, error: sendErr.message });
      }
    }

    const sentCount = dispatchResults.filter(r => r.success).length;
    const skippedCount = dispatchResults.filter(r => r.skipped).length;
    const failedCount = dispatchResults.filter(r => !r.success && !r.skipped).length;

    return NextResponse.json({
      message: 'Campaign dispatch completed',
      campaignId,
      dailyLimitReached,
      sentCount,
      failedCount,
      skippedCount,
      results: dispatchResults,
    });
  } catch (err: any) {
    console.error('Campaign sending route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
