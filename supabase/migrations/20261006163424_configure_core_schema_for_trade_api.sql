-- The trade-api uses admin.schema('core'); PostgREST must include that schema.
-- Core tables remain RLS-enabled and have no anon/authenticated table grants.
-- This changes the server schema routing only.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='core' AND c.relkind='r'
    AND (NOT c.relrowsecurity
      OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
  ) THEN
    RAISE EXCEPTION 'Core must remain RLS enabled without public client table grants';
  END IF;
END
$guard$;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, core';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
