import { Resend } from 'resend';

const fromEmail = process.env.RESEND_FROM_EMAIL || 'Housmata CRM <no-reply@housmata.com>';

// Fall back to a placeholder so the SDK can be instantiated at build/import time
// when RESEND_API_KEY is unset. A missing real key surfaces as an API error at
// send time, which sendEmail() throws below — preserving the throw-on-failure contract.
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendMailOptions): Promise<{ id: string } | null> {
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
