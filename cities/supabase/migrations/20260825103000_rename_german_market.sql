-- Use the user-facing Swiss-German market name consistently in storage and UI.
alter table public."Gemeinde"
  drop constraint if exists "Gemeinde_market_check";

update public."Gemeinde"
set market = 'Uf Tüütsch'
where market = 'CH-D';

alter table public."Gemeinde"
  add constraint "Gemeinde_market_check"
  check (market in ('Uf Tüütsch', 'Welsch', 'Ticino'));

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260825103000',
  array['Rename CH-D market to Uf Tüütsch in Gemeinde','Align the market constraint with the public labels'],
  'rename_german_market'
)
on conflict (version) do nothing;
