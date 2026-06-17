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
