import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { compileEmailTemplate, EmailCategory } from '@/utils/templates';
import { sendEmail, sendEmailViaBrevo, isBrevoConfigured, SendMailOptions } from '@/utils/mailer';

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

// Detect Brevo daily/quota exhaustion. Brevo signals an exhausted allowance via
// a 402 status and/or credit/quota messages.
function isBrevoQuotaError(err: any): boolean {
  if (err?.statusCode === 402) return true;
  const m = (err?.message || '').toLowerCase();
  return (
    m.includes('not enough credit') ||
    m.includes('credits') ||
    m.includes('quota')
  );
}

// Send with exponential-backoff retry ONLY on rate-limit errors. The actual
// send is provided as a thunk so the caller can swap providers (Resend/Brevo).
async function sendWithRetry(send: () => Promise<{ id: string } | null>): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await send();
    } catch (err: any) {
      // Retry ONLY transient rate-limit errors, and only if we have attempts
      // left. Terminal cases (daily quota, Brevo credit/402, etc.) throw
      // immediately so the caller's catch can stop gracefully / fall back.
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
    const dispatchResults: Array<{ email: string; success: boolean; error?: string; skipped?: boolean; provider?: string }> = [];

    let dailyLimitReached = false;
    let brevoLimitReached = false;
    let lastSendStartedAt = 0;

    // Once Resend's daily quota is hit we fall back to Brevo for the rest of the
    // dispatch (when Brevo is configured).
    let useBrevoFallback = false;
    const brevoAvailable = isBrevoConfigured();
    let brevoSentCount = 0;

    // Update an email_logs row, gracefully degrading if the `provider` column
    // doesn't exist yet (retries the update without it).
    const updateLog = async (logId: string, fields: Record<string, any>) => {
      const { error } = await supabaseAdmin.from('email_logs').update(fields).eq('id', logId);
      if (error && (error.message || '').toLowerCase().includes('provider') && 'provider' in fields) {
        const { provider: _omit, ...rest } = fields;
        await supabaseAdmin.from('email_logs').update(rest).eq('id', logId);
      }
    };

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

      // Build the send options once; the provider is chosen at send time.
      // The client sends attachments as { filename, url, contentType, size };
      // map them to the mailer's shape so a hosted attachment URL reaches the
      // provider as { filename, path }.
      const sendOptions: SendMailOptions = {
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
      };

      // Pace requests to stay under the provider's rate limit.
      const waitMs = lastSendStartedAt + MIN_SEND_INTERVAL_MS - Date.now();
      if (waitMs > 0) await sleep(waitMs);

      const currentProvider: 'resend' | 'brevo' = useBrevoFallback ? 'brevo' : 'resend';

      try {
        lastSendStartedAt = Date.now();
        const sendRes = await sendWithRetry(() =>
          currentProvider === 'brevo' ? sendEmailViaBrevo(sendOptions) : sendEmail(sendOptions)
        );

        // Update log to 'sent'
        if (campaignId) {
          await updateLog(logId, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: sendRes?.id ?? null,
            provider: currentProvider,
          });
        }

        if (currentProvider === 'brevo') brevoSentCount++;
        dispatchResults.push({ email: recipient.email, success: true, provider: currentProvider });
      } catch (sendErr: any) {
        console.error(`Failed sending to ${recipient.email} via ${currentProvider}:`, sendErr.message);

        // Resend daily-limit reached while NOT already in fallback mode.
        if (!useBrevoFallback && isDailyLimitError(sendErr)) {
          if (brevoAvailable) {
            // Switch to Brevo and immediately retry THIS recipient via Brevo.
            useBrevoFallback = true;
            try {
              const brevoRes = await sendEmailViaBrevo(sendOptions);
              if (campaignId) {
                await updateLog(logId, {
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  provider_message_id: brevoRes?.id ?? null,
                  provider: 'brevo',
                });
              }
              brevoSentCount++;
              dispatchResults.push({ email: recipient.email, success: true, provider: 'brevo' });
            } catch (brevoErr: any) {
              console.error(`Brevo fallback failed for ${recipient.email}:`, brevoErr.message);

              // Brevo is also exhausted on its very first attempt: route through
              // the same "both providers exhausted → stop gracefully" logic.
              if (isBrevoQuotaError(brevoErr)) {
                brevoLimitReached = true;
                dailyLimitReached = true;

                if (campaignId) {
                  await updateLog(logId, { status: 'failed', error_message: brevoErr.message, provider: 'brevo' });
                }

                dispatchResults.push({
                  email: recipient.email,
                  success: false,
                  skipped: true,
                  provider: 'brevo',
                  error: brevoErr.message,
                });

                // Mark all remaining (un-attempted) recipients as skipped.
                for (let j = i + 1; j < recipients.length; j++) {
                  dispatchResults.push({
                    email: recipients[j].email,
                    success: false,
                    error: 'Skipped — daily sending limit reached on both providers',
                    skipped: true,
                  });
                }
                break;
              }

              // Ordinary Brevo failure: mark failed and continue to next recipient.
              if (campaignId) {
                await updateLog(logId, { status: 'failed', error_message: brevoErr.message, provider: 'brevo' });
              }
              dispatchResults.push({ email: recipient.email, success: false, error: brevoErr.message, provider: 'brevo' });
              continue;
            }
            continue;
          }

          // No Brevo fallback configured: preserve existing skip-the-rest behavior.
          dailyLimitReached = true;

          if (campaignId) {
            await updateLog(logId, {
              status: 'failed',
              error_message: 'Resend daily sending limit reached',
              provider: 'resend',
            });
          }

          dispatchResults.push({
            email: recipient.email,
            success: false,
            error: 'Resend daily sending limit reached',
            skipped: true,
            provider: 'resend',
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

        // Brevo also exhausted while in fallback mode: stop gracefully.
        if (useBrevoFallback && isBrevoQuotaError(sendErr)) {
          brevoLimitReached = true;
          dailyLimitReached = true;

          if (campaignId) {
            await updateLog(logId, {
              status: 'failed',
              error_message: 'Brevo daily/credit limit reached',
              provider: 'brevo',
            });
          }

          dispatchResults.push({
            email: recipient.email,
            success: false,
            error: 'Brevo daily/credit limit reached',
            skipped: true,
            provider: 'brevo',
          });

          // Mark all remaining (un-attempted) recipients as skipped.
          for (let j = i + 1; j < recipients.length; j++) {
            dispatchResults.push({
              email: recipients[j].email,
              success: false,
              error: 'Skipped — daily sending limit reached on both providers',
              skipped: true,
            });
          }
          break;
        }

        // Ordinary failure on either provider.
        if (campaignId) {
          await updateLog(logId, { status: 'failed', error_message: sendErr.message, provider: currentProvider });
        }

        dispatchResults.push({ email: recipient.email, success: false, error: sendErr.message, provider: currentProvider });
      }
    }

    const sentCount = dispatchResults.filter(r => r.success).length;
    const skippedCount = dispatchResults.filter(r => r.skipped).length;
    const failedCount = dispatchResults.filter(r => !r.success && !r.skipped).length;

    return NextResponse.json({
      message: 'Campaign dispatch completed',
      campaignId,
      dailyLimitReached,
      brevoLimitReached,
      fallbackUsed: useBrevoFallback || brevoSentCount > 0,
      brevoSentCount,
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
