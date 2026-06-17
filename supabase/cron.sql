-- Supabase scheduling for delivery sync + open reconcile.
-- Run in the Supabase SQL editor. Requires pg_cron + pg_net.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- One-time: store secrets in Vault (edit the CRON_SECRET value first):
--   select vault.create_secret('https://housmata-crm-marketing.vercel.app/api/cron/sync', 'app_cron_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');

-- Job 1: reconcile open stats (pure SQL, every minute)
SELECT cron.schedule('reconcile-email-open-stats', '* * * * *',
  $$ SELECT public.reconcile_email_open_stats(); $$);

-- Job 2: pull Resend delivery status via the app endpoint (every minute)
SELECT cron.schedule('sync-resend-delivery', '* * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);

-- Verify:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
