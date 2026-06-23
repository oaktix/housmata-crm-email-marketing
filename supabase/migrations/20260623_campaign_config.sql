-- Migration: persist full campaign config for resend
-- Adds a jsonb `config` column to email_campaigns holding the full reusable
-- payload (title, body, actionText, actionUrl, properties, features, attachments).
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS config jsonb;
