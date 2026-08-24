create table public."Product" (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."GemeindeProduct" (
  bfs_id integer not null references public."Gemeinde"(bfs_id) on delete cascade,
  product_id uuid not null references public."Product"(id) on delete cascade,
  confidence text not null default 'confirmed' check (confidence in ('unknown','suspected','confirmed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bfs_id, product_id)
);

create trigger product_updated_at before update on public."Product"
for each row execute function public.set_updated_at();
create trigger gemeinde_product_updated_at before update on public."GemeindeProduct"
for each row execute function public.set_updated_at();

insert into public."Product" (code, name) values ('eadmin', 'eAdmin')
on conflict (code) do update set name = excluded.name, active = true;

insert into public."GemeindeProduct" (bfs_id, product_id, confidence)
select gp.bfs_id, (select id from public."Product" where code = 'eadmin'), gp.confidence
from public."GemeindeProfil" gp
join public."Gemeinde" g on g.bfs_id = gp.bfs_id
join public."Software" sw on sw.id = gp.software_id
where g.canton = 'GE' and sw.code = 'calvin_eadmin'
on conflict (bfs_id, product_id) do update set confidence = excluded.confidence;

update public."GemeindeProfil" gp
set software_id = (select id from public."Software" where code = 'calvin')
from public."Gemeinde" g
where g.bfs_id = gp.bfs_id and g.canton = 'GE';

update public."Software" set active = false where code = 'calvin_eadmin';

create or replace view public."GemeindeAktuell" as
select distinct on (g.bfs_id)
  g.bfs_id, g.name, g.canton, g.market, g.active,
  ds.expected_population, ds.received_population, ds.received_on,
  ds.delivery_status, ds.comment, ds.ech_version, ds.missing_ewid, ds.ewid_error_rate,
  vp.name as integrator, sw.name as software,
  gp.sales_status, gp.confidence, gp.notes, gp.updated_at as profile_updated_at,
  di.reference_date, di.completed_at as delimo_updated_at,
  coalesce((select array_agg(p.name order by p.name) from public."GemeindeProduct" gpr join public."Product" p on p.id = gpr.product_id where gpr.bfs_id = g.bfs_id), '{}'::text[]) as products
from public."Gemeinde" g
left join public."GemeindeProfil" gp on gp.bfs_id = g.bfs_id
left join public."VP" vp on vp.id = gp.vp_id
left join public."Software" sw on sw.id = gp.software_id
left join public."DelimoStand" ds on ds.bfs_id = g.bfs_id
left join public."DelimoImport" di on di.id = ds.import_id and di.status = 'success'
order by g.bfs_id, di.completed_at desc nulls last;

alter table public."Product" enable row level security;
alter table public."GemeindeProduct" enable row level security;
create policy authenticated_read_product on public."Product" for select to authenticated using (true);
create policy authenticated_read_gemeinde_product on public."GemeindeProduct" for select to authenticated using (true);
create policy authenticated_write_gemeinde_product on public."GemeindeProduct" for all to authenticated using (true) with check (true);
grant select on public."Product", public."GemeindeProduct" to authenticated;
grant insert, update, delete on public."GemeindeProduct" to authenticated;
grant select on public."GemeindeAktuell" to anon;
