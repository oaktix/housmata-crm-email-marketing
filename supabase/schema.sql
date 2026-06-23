-- Housmata Email Marketing Tool - Database Schema
-- Run this in the Supabase SQL Editor

-- Create Staff Table to manage application access
CREATE TABLE IF NOT EXISTS public.staff_members (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'marketer')),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for Staff
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Campaign Log Table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL,
    body text NOT NULL,
    category text NOT NULL CHECK (category IN ('New Property Alert', 'Downtime Alert', 'Newsletter', 'New Features Alert', 'Regular Alerts')),
    sent_by uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
    sent_count integer DEFAULT 0,
    open_count integer DEFAULT 0,
    config jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Individual Email Dispatch Logs
CREATE TABLE IF NOT EXISTS public.email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    recipient_email text NOT NULL,
    recipient_name text,
    category text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message text,
    sent_at timestamp with time zone DEFAULT now(),
    opened_at timestamp with time zone
);

-- Email Open Tracking Events
CREATE TABLE IF NOT EXISTS public.email_opens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_log_id uuid REFERENCES public.email_logs(id) ON DELETE CASCADE,
    opened_at timestamp with time zone DEFAULT now(),
    user_agent text,
    ip_address text
);

-- Enable RLS for email marketing tables
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;

-- Policies: Only authenticated users who are staff can view or edit these tables
CREATE POLICY "Allow all actions for authenticated staff" ON public.staff_members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all actions for staff on campaigns" ON public.email_campaigns
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.staff_members WHERE id = auth.uid())
    );

CREATE POLICY "Allow all actions for staff on logs" ON public.email_logs
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.staff_members WHERE id = auth.uid())
    );

CREATE POLICY "Allow all actions for staff on opens" ON public.email_opens
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.staff_members WHERE id = auth.uid())
    );

-- Allow public inserts to email opens so tracking pixel works
CREATE POLICY "Allow public insert for tracking opens" ON public.email_opens
    FOR INSERT TO public WITH CHECK (true);

-- Function to handle auto-increment open count in campaign
CREATE OR REPLACE FUNCTION public.increment_campaign_open_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.email_campaigns
    SET open_count = open_count + 1
    WHERE id = (
        SELECT campaign_id FROM public.email_logs WHERE id = NEW.email_log_id
    );
    
    UPDATE public.email_logs
    SET opened_at = NEW.opened_at
    WHERE id = NEW.email_log_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_email_opened
AFTER INSERT ON public.email_opens
FOR EACH ROW EXECUTE FUNCTION public.increment_campaign_open_count();

-- ============================================================
-- Delivery sync + open-stat reconcile (pg_cron) additions
-- ============================================================
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status     text,
  ADD COLUMN IF NOT EXISTS delivery_synced_at  timestamp with time zone;

CREATE INDEX IF NOT EXISTS email_logs_provider_message_id_idx ON public.email_logs (provider_message_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx             ON public.email_logs (sent_at);

-- ============================================================
-- Campaign config (for resend last campaign) addition
-- ============================================================
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS config jsonb;

CREATE OR REPLACE FUNCTION public.reconcile_email_open_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Backfill opened_at from the EARLIEST open event per log.
  UPDATE public.email_logs l
  SET opened_at = e.first_open
  FROM (SELECT email_log_id, MIN(opened_at) AS first_open
        FROM public.email_opens GROUP BY email_log_id) e
  WHERE e.email_log_id = l.id
    AND (l.opened_at IS NULL OR l.opened_at <> e.first_open);

  -- 2) open_count = count of opened logs per campaign.
  UPDATE public.email_campaigns c
  SET open_count = COALESCE(s.cnt, 0)
  FROM (SELECT campaign_id, COUNT(*) AS cnt
        FROM public.email_logs WHERE opened_at IS NOT NULL
        GROUP BY campaign_id) s
  WHERE s.campaign_id = c.id AND c.open_count <> COALESCE(s.cnt, 0);

  -- 3) Zero out campaigns that now have no opened logs.
  UPDATE public.email_campaigns c
  SET open_count = 0
  WHERE c.open_count <> 0
    AND NOT EXISTS (SELECT 1 FROM public.email_logs l
                    WHERE l.campaign_id = c.id AND l.opened_at IS NOT NULL);
END;
$$;
