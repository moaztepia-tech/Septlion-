
INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","lastError","config")
VALUES
(
  'ted-eu',
  'TED — European Union Procurement',
  'API',
  'https://api.ted.europa.eu/v3/notices/search',
  false,
  85,
  ARRAY['wheat_flour'],
  ARRAY['EU/EEA'],
  NULL,
  360,
  'QUERY_TUNING_REQUIRED',
  '{"official":true,"auth_required":false,"classification":"CPV 15612100 Wheat flour","note":"Adapter is registered but not activated until the CPV expert-query mapping is validated against live results."}'::jsonb
),
(
  'ungm',
  'UN Global Marketplace',
  'API',
  'https://www.ungm.org/API/Notices',
  false,
  95,
  ARRAY['wheat_flour','food_supply'],
  ARRAY['Global'],
  NULL,
  360,
  'OAUTH_ACCESS_REQUIRED',
  '{"official":true,"auth_required":true,"note":"UNGM notice retrieval requires an OAuth access token. Public helper endpoints do not expose all procurement notices."}'::jsonb
),
(
  'adb-institutional',
  'Asian Development Bank — Procurement Notices',
  'HTML',
  'https://www.adb.org/business/institutional-procurement/notices',
  false,
  55,
  ARRAY['food_supply','wheat_flour'],
  ARRAY['Asia-Pacific'],
  NULL,
  720,
  'ADAPTER_PENDING',
  '{"official":true,"auth_required":false,"note":"Official public notices source. HTML adapter must be rate-limited and validated before activation."}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "name"=excluded."name",
  "sourceType"=excluded."sourceType",
  "endpoint"=excluded."endpoint",
  "priority"=excluded."priority",
  "productFocus"=excluded."productFocus",
  "marketFocus"=excluded."marketFocus",
  "config"=excluded."config",
  "updatedAt"=now();
