
INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","lastError","config")
VALUES (
  'uk-contracts-finder',
  'UK Contracts Finder',
  'API',
  'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search',
  true,
  80,
  ARRAY['wheat_flour','food_supply'],
  ARRAY['United Kingdom'],
  'collect-contracts-finder',
  360,
  NULL,
  '{"official":true,"auth_required":false,"format":"OCDS 1.1","publisher":"Cabinet Office","license":"Open Government Licence 3.0"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "name"=excluded."name",
  "sourceType"=excluded."sourceType",
  "endpoint"=excluded."endpoint",
  "active"=true,
  "priority"=excluded."priority",
  "productFocus"=excluded."productFocus",
  "marketFocus"=excluded."marketFocus",
  "collector"=excluded."collector",
  "cadenceMinutes"=excluded."cadenceMinutes",
  "lastError"=NULL,
  "config"=excluded."config",
  "updatedAt"=now();

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-contracts-finder-6h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'septlion-contracts-finder-6h',
  '47 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='septlion_project_url' order by created_at desc limit 1) || '/functions/v1/collect-contracts-finder',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1),
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1)
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $$
);
