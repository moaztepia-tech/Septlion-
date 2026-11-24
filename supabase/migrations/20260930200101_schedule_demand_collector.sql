-- Copied from the production migration history. Secret values were removed from the
-- repository copy: set them with `set app.<name> = '...'` before applying to a new
-- project. Production already holds them in Vault and is not re-run.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select vault.create_secret(current_setting('app.septlion_project_url'), 'septlion_project_url');
select vault.create_secret(current_setting('app.septlion_anon_key'), 'septlion_anon_key');

select cron.schedule(
  'septlion-demand-collector-6h',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='septlion_project_url' order by created_at desc limit 1) || '/functions/v1/collect-demand-signals',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1),
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1)
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $$
);
