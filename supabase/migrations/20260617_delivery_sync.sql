-- Migration: delivery sync + open reconcile
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status     text,
  ADD COLUMN IF NOT EXISTS delivery_synced_at  timestamp with time zone;

CREATE INDEX IF NOT EXISTS email_logs_provider_message_id_idx ON public.email_logs (provider_message_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx             ON public.email_logs (sent_at);

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
