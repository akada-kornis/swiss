-- Prime Communes 1.1.3
-- Separate the commercial Prime relationship from the integrator, add ERP data,
-- and expose transverse modules independently from the métier software.

alter table public."GemeindeProfil"
  add column if not exists prime_client boolean not null default false;

create table if not exists public."ERP" (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."GemeindeProfil"
  add column if not exists erp_id uuid references public."ERP"(id) on delete set null;

create index if not exists gemeinde_profil_erp_idx on public."GemeindeProfil"(erp_id);

drop trigger if exists erp_updated_at on public."ERP";
create trigger erp_updated_at before update on public."ERP"
for each row execute function public.set_updated_at();

insert into public."ERP" (code,name) values
  ('abacus','Abacus'),
  ('urbanus','Urbanus'),
  ('citizen','Citizen'),
  ('bdi','BDI'),
  ('epsilon','Epsilon'),
  ('cresus','Crésus'),
  ('ruf','Ruf'),
  ('opale','Opale')
on conflict (code) do update set name=excluded.name,active=true;

-- Existing Prime integrator clients remain Prime clients.
update public."GemeindeProfil" gp
set prime_client=true
from public."VP" vp
where gp.vp_id=vp.id and vp.code='prime';

-- In Geneva, an eAdmin installation identifies a Prime commercial client even
-- when the métier integrator is not Prime.
update public."GemeindeProfil" gp
set prime_client=true
from public."Gemeinde" g
where g.bfs_id=gp.bfs_id
  and g.canton='GE'
  and exists (
    select 1
    from public."GemeindeProduct" gpr
    join public."Product" p on p.id=gpr.product_id
    where gpr.bfs_id=g.bfs_id and p.code='eadmin'
  );

-- ERP inferred only when the métier product gives an explicit correspondence.
update public."GemeindeProfil" gp
set erp_id=erp.id
from public."Software" sw
join public."ERP" erp on erp.code=case sw.code
  when 'etic' then 'abacus'
  when 'urbanus' then 'urbanus'
  when 'citizen' then 'citizen'
  when 'bdi' then 'bdi'
  when 'epsilon' then 'epsilon'
  when 'cresus' then 'cresus'
  when 'ruf' then 'ruf'
  when 'calvin' then 'opale'
end
where gp.software_id=sw.id
  and sw.code in ('etic','urbanus','citizen','bdi','epsilon','cresus','ruf','calvin');

-- Clever.Tax is the module name; KMS is its editor.
insert into public."Product" (code,name)
values ('clevertax','Clever.Tax')
on conflict (code) do update set name=excluded.name,active=true;

insert into public."GemeindeProduct" (bfs_id,product_id,confidence,notes)
select 2206,p.id,'confirmed','Éditeur : KMS'
from public."Product" p
where p.code='clevertax'
on conflict (bfs_id,product_id) do update
set confidence=excluded.confidence,notes=excluded.notes,updated_at=now();

create or replace view public."GemeindeAktuell" as
select distinct on (g.bfs_id)
  g.bfs_id,g.name,g.canton,g.market,g.active,
  ds.expected_population,ds.received_population,ds.received_on,ds.delivery_status,ds.comment,ds.ech_version,ds.missing_ewid,ds.ewid_error_rate,
  vp.name as integrator,sw.name as software,gp.sales_status,gp.confidence,gp.notes,gp.updated_at as profile_updated_at,
  di.reference_date,di.completed_at as delimo_updated_at,
  coalesce((select array_agg(p.name order by p.name) from public."GemeindeProduct" gpr join public."Product" p on p.id=gpr.product_id where gpr.bfs_id=g.bfs_id), '{}'::text[]) as products,
  g.bezirk_code,b.name as bezirk,
  gp.prime_client,erp.name as erp
from public."Gemeinde" g
left join public."Bezirk" b on b.code=g.bezirk_code
left join public."GemeindeProfil" gp on gp.bfs_id=g.bfs_id
left join public."VP" vp on vp.id=gp.vp_id
left join public."Software" sw on sw.id=gp.software_id
left join public."ERP" erp on erp.id=gp.erp_id
left join public."DelimoStand" ds on ds.bfs_id=g.bfs_id
left join public."DelimoImport" di on di.id=ds.import_id and di.status='success'
order by g.bfs_id,di.completed_at desc nulls last;

alter table public."ERP" enable row level security;
drop policy if exists authenticated_read_erp on public."ERP";
create policy authenticated_read_erp on public."ERP" for select to authenticated using (true);
grant select on public."ERP" to authenticated;
grant select on public."GemeindeAktuell" to anon,authenticated;

insert into supabase_migrations.schema_migrations(version,statements,name)
values (
  '20260901113000',
  array['Separate Prime client from integrator','Add ERP reference data and métier mappings','Add Clever.Tax to Marly','Expose Prime client, ERP and modules'],
  'prime_client_erp_modules'
)
on conflict(version) do nothing;
