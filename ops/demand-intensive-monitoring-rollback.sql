BEGIN;
SELECT cron.alter_job(jobid,schedule := '23 */6 * * *') FROM cron.job WHERE jobname='septlion-platform-buyers-6h';
SELECT cron.alter_job(jobid,schedule := '25 */6 * * *') FROM cron.job WHERE jobname='septlion-platform-buyers-ingest';
SELECT cron.alter_job(jobid,schedule := '17 */6 * * *') FROM cron.job WHERE jobname='septlion-tradewheel-country-6h';
SELECT cron.alter_job(jobid,schedule := '21 */6 * * *') FROM cron.job WHERE jobname='septlion-tradewheel-country-ingest';
SELECT cron.alter_job(jobid,schedule := '17 */6 * * *') FROM cron.job WHERE jobname='septlion-demand-collector-6h';
SELECT cron.alter_job(jobid,schedule := '41 2 * * *') FROM cron.job WHERE jobname='septlion-demand-patterns-daily';
UPDATE public."DemandSource" SET "cadenceMinutes"=360,"updatedAt"=now() WHERE id IN ('platform-buyers','tradewheel-buyers','go4worldbusiness-buyers','world-bank-procurement','tradewheel-country-buyers');
COMMIT;