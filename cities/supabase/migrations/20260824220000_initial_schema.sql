create extension if not exists pgcrypto;

create table public."VP" (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."Software" (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."Gemeinde" (
  bfs_id integer primary key,
  name text not null,
  canton char(2) not null,
  market text not null check (market in ('CH-D', 'Welsch', 'Ticino')),
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."GemeindeProfil" (
  bfs_id integer primary key references public."Gemeinde"(bfs_id) on delete cascade,
  vp_id uuid references public."VP"(id) on delete set null,
  software_id uuid references public."Software"(id) on delete set null,
  sales_status text not null default 'none' check (sales_status in ('none', 'target', 'contacted', 'discussion', 'client', 'lost')),
  confidence text not null default 'unknown' check (confidence in ('unknown', 'suspected', 'confirmed')),
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."DelimoImport" (
  id uuid primary key default gen_random_uuid(),
  source_url text not null default 'https://delimo.bfs.admin.ch/delimo/P99/',
  reference_date date,
  source_generated_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  row_count integer not null default 0,
  changed_count integer not null default 0,
  checksum text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public."DelimoStand" (
  import_id uuid not null references public."DelimoImport"(id) on delete cascade,
  bfs_id integer not null references public."Gemeinde"(bfs_id) on delete cascade,
  expected_population integer not null check (expected_population >= 0),
  received_population integer check (received_population >= 0),
  received_on timestamptz,
  delivery_status text not null check (delivery_status in ('accepted', 'warning', 'invalid', 'missing', 'unknown')),
  comment text not null default '',
  ech_version text not null default '',
  missing_ewid numeric(7,3),
  ewid_error_rate numeric(7,3),
  created_at timestamptz not null default now(),
  primary key (import_id, bfs_id)
);

create table public."GemeindeProfilAudit" (
  id bigint generated always as identity primary key,
  bfs_id integer not null,
  operation text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index delimo_stand_bfs_idx on public."DelimoStand"(bfs_id);
create index delimo_stand_import_idx on public."DelimoStand"(import_id);
create index gemeinde_canton_idx on public."Gemeinde"(canton);
create index gemeinde_market_idx on public."Gemeinde"(market);
create index gemeinde_profil_vp_idx on public."GemeindeProfil"(vp_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger vp_updated_at before update on public."VP" for each row execute function public.set_updated_at();
create trigger software_updated_at before update on public."Software" for each row execute function public.set_updated_at();
create trigger gemeinde_updated_at before update on public."Gemeinde" for each row execute function public.set_updated_at();
create trigger gemeinde_profil_updated_at before update on public."GemeindeProfil" for each row execute function public.set_updated_at();

create or replace function public.audit_gemeinde_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public."GemeindeProfilAudit" (bfs_id, operation, old_value, new_value, changed_by)
  values (coalesce(new.bfs_id, old.bfs_id), tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
  return coalesce(new, old);
end;
$$;
create trigger gemeinde_profil_audit after insert or update or delete on public."GemeindeProfil"
for each row execute function public.audit_gemeinde_profil();

create or replace view public."GemeindeAktuell" as
select distinct on (g.bfs_id)
  g.bfs_id, g.name, g.canton, g.market, g.active,
  ds.expected_population, ds.received_population, ds.received_on,
  ds.delivery_status, ds.comment, ds.ech_version, ds.missing_ewid, ds.ewid_error_rate,
  vp.name as integrator, sw.name as software,
  gp.sales_status, gp.confidence, gp.notes, gp.updated_at as profile_updated_at,
  di.reference_date, di.completed_at as delimo_updated_at
from public."Gemeinde" g
left join public."GemeindeProfil" gp on gp.bfs_id = g.bfs_id
left join public."VP" vp on vp.id = gp.vp_id
left join public."Software" sw on sw.id = gp.software_id
left join public."DelimoStand" ds on ds.bfs_id = g.bfs_id
left join public."DelimoImport" di on di.id = ds.import_id and di.status = 'success'
order by g.bfs_id, di.completed_at desc nulls last;

alter table public."VP" enable row level security;
alter table public."Software" enable row level security;
alter table public."Gemeinde" enable row level security;
alter table public."GemeindeProfil" enable row level security;
alter table public."DelimoImport" enable row level security;
alter table public."DelimoStand" enable row level security;
alter table public."GemeindeProfilAudit" enable row level security;

create policy authenticated_read_vp on public."VP" for select to authenticated using (true);
create policy authenticated_read_software on public."Software" for select to authenticated using (true);
create policy authenticated_read_gemeinde on public."Gemeinde" for select to authenticated using (true);
create policy authenticated_read_profile on public."GemeindeProfil" for select to authenticated using (true);
create policy authenticated_write_profile on public."GemeindeProfil" for all to authenticated using (true) with check (true);
create policy authenticated_read_import on public."DelimoImport" for select to authenticated using (true);
create policy authenticated_read_stand on public."DelimoStand" for select to authenticated using (true);
create policy authenticated_read_audit on public."GemeindeProfilAudit" for select to authenticated using (true);

grant select on public."VP", public."Software", public."Gemeinde", public."DelimoImport", public."DelimoStand", public."GemeindeAktuell", public."GemeindeProfilAudit" to authenticated;
grant select, insert, update, delete on public."GemeindeProfil" to authenticated;
grant usage, select on all sequences in schema public to authenticated;
