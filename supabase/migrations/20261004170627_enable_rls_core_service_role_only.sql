do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='core'
  loop
    execute format('alter table core.%I enable row level security', r.tablename);
  end loop;
end $$;
