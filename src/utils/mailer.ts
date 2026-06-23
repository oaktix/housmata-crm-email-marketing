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
