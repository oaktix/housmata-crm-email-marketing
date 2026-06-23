-- Migration: record which provider delivered each email
-- Adds a `provider` text column to email_logs ('resend' | 'brevo') so the
-- Brevo daily-quota fallback can be attributed per dispatch.
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS provider text;
