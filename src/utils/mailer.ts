import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'smtp.mail.us-east-1.awsapps.com'; // Default placeholder, user overrides it
const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPassword = process.env.SMTP_PASSWORD || '';
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@housmata.com';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // True for 465, false for 587/other
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendMailOptions) {
  const info = await transporter.sendMail({
    from: `"Housmata CRM" <${smtpFromEmail}>`,
    to,
    subject,
    html,
  });

  return info;
}
