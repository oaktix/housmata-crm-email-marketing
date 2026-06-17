import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { compileEmailTemplate, EmailCategory } from '@/utils/templates';
import { sendEmail } from '@/utils/mailer';

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
      staffId,
    } = bodyData;

    if (!subject || !category || !title || !body || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create a campaign record
    let campaignId = null;
    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        subject,
        body,
        category,
        sent_by: staffId || null,
        sent_count: recipients.length,
      })
      .select()
      .single();

    if (!campaignErr && campaign) {
      campaignId = campaign.id;
    } else {
      console.warn('Failed to insert campaign record in Supabase:', campaignErr?.message);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const dispatchResults = [];

    // 2. Dispatch emails
    for (const recipient of recipients) {
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

      try {
        // Send email via Resend
        const sendRes = await sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: htmlContent,
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

    return NextResponse.json({
      message: 'Campaign dispatch completed',
      campaignId,
      results: dispatchResults,
    });
  } catch (err: any) {
    console.error('Campaign sending route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
