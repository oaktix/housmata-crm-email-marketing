import { Resend } from 'resend';

const fromEmail = process.env.RESEND_FROM_EMAIL || 'Housmata CRM <no-reply@housmata.com>';

// Fall back to a placeholder so the SDK can be instantiated at build/import time
// when RESEND_API_KEY is unset. A missing real key surfaces as an API error at
// send time, which sendEmail() throws below — preserving the throw-on-failure contract.
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export class MailerError extends Error {
  code?: string;       // resend error 'name' e.g. 'rate_limit_exceeded' | 'daily_quota_exceeded'
  statusCode?: number;
  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'MailerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface MailAttachment {
  filename: string;
  path?: string; // public URL Resend can fetch
  content?: string; // base64-encoded content
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

// ---------------------------------------------------------------------------
// Brevo (Sendinblue) fallback sender
// ---------------------------------------------------------------------------

// Whether a Brevo fallback is configured (just needs an API key).
export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

// Resolve the Brevo sender identity. Prefer the dedicated BREVO_FROM_EMAIL /
// BREVO_FROM_NAME env vars; otherwise parse the Resend "Name <email@x>" form;
// otherwise fall back to sensible Housmata defaults.
function resolveBrevoSender(): { name: string; email: string } {
  if (process.env.BREVO_FROM_EMAIL) {
    return {
      name: process.env.BREVO_FROM_NAME || 'Housmata CRM',
      email: process.env.BREVO_FROM_EMAIL,
    };
  }

  const match = fromEmail.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: (match[1] || '').trim() || 'Housmata CRM',
      email: match[2].trim(),
    };
  }

  // RESEND_FROM_EMAIL may be a bare email (no "Name <...>" wrapper). If it looks
  // like an email, use it directly rather than the hardcoded default.
  const bare = fromEmail.trim();
  if (bare.includes('@')) {
    return { name: 'Housmata CRM', email: bare };
  }

  return { name: 'Housmata CRM', email: 'no-reply@housmata.com' };
}

export async function sendEmailViaBrevo({ to, subject, html, attachments }: SendMailOptions): Promise<{ id: string } | null> {
  if (!process.env.BREVO_API_KEY) {
    throw new MailerError('Brevo is not configured', 'brevo_not_configured');
  }

  const sender = resolveBrevoSender();

  const payload: Record<string, any> = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  if (attachments && attachments.length > 0) {
    // Brevo expects an `attachment` array. A hosted URL maps to { url, name };
    // base64 content maps to { content, name }.
    const brevoAttachments = attachments
      .map((att): { url?: string; content?: string; name: string } | null =>
        att.path
          ? { url: att.path, name: att.filename }
          : att.content
            ? { content: att.content, name: att.filename }
            : null
      )
      .filter((a): a is { url?: string; content?: string; name: string } => a !== null);

    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as { code?: string; message?: string }));
      throw new MailerError(errBody.message || 'Brevo send failed', errBody.code, res.status);
    }

    const data = await res.json();
    return data.messageId ? { id: data.messageId } : null;
  } catch (err: any) {
    if (err instanceof MailerError) throw err;
    throw new MailerError(err?.message || 'Brevo send failed');
  }
}

export async function sendEmail({ to, subject, html, attachments }: SendMailOptions): Promise<{ id: string } | null> {
  const payload: Parameters<typeof resend.emails.send>[0] = {
    from: fromEmail,
    to,
    subject,
    html,
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map(att =>
      att.path
        ? { filename: att.filename, path: att.path }
        : { filename: att.filename, content: att.content as string }
    );
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    throw new MailerError(error.message, (error as any).name, (error as any).statusCode);
  }

  return data;
}
