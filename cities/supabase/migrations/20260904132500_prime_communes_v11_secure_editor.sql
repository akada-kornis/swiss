-- Prime Communes 1.1 secure municipal editor
-- Applied to production Supabase on 2026-09-04.

create table if not exists public."PrimeCommunesEditConfig" (
  id boolean primary key default true check (id),
  key_hash text not null,
  updated_at timestamptz not null default now()
);

revoke all on public."PrimeCommunesEditConfig" from public, anon, authenticated;

insert into public."PrimeCommunesEditConfig" (id, key_hash)
values (
  true,
  '2e5c3b146315ca84a3566a04793ab15c0d57bdf3a4b2f1c11728940819c94aeb'
)
on conflict (id) do update
set key_hash = excluded.key_hash,
    updated_at = now();

create or replace function public.save_commune_profile_v11(
  p_key text,
  p_bfs_id integer,
  p_prime_client boolean,
  p_integrator text,
  p_software text,
  p_erp text,
  p_products text[],
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected_hash text;
  v_vp_id uuid;
  v_software_id uuid;
  v_erp_id uuid;
  v_unknown_products integer;
begin
  select key_hash into v_expected_hash
  from public."PrimeCommunesEditConfig"
  where id = true;

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_key,''), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Clé d''édition invalide' using errcode = '42501';
  end if;

  if not exists (select 1 from public."Gemeinde" where bfs_id = p_bfs_id) then
    raise exception 'Commune OFS inconnue';
  end if;

  if length(coalesce(p_notes,'')) > 4000 then
    raise exception 'Notes trop longues';
  end if;

  if nullif(btrim(coalesce(p_integrator,'')), '') is not null then
    select id into v_vp_id from public."VP"
    where lower(name)=lower(btrim(p_integrator)) limit 1;
    if v_vp_id is null then raise exception 'Intégrateur inconnu'; end if;
  end if;

  if nullif(btrim(coalesce(p_software,'')), '') is not null then
    select id into v_software_id from public."Software"
    where active=true and (lower(name)=lower(btrim(p_software)) or lower(code)=lower(btrim(p_software))) limit 1;
    if v_software_id is null then raise exception 'Métier inconnu'; end if;
  end if;

  if nullif(btrim(coalesce(p_erp,'')), '') is not null then
    select id into v_erp_id from public."ERP"
    where active=true and (lower(name)=lower(btrim(p_erp)) or lower(code)=lower(btrim(p_erp))) limit 1;
    if v_erp_id is null then raise exception 'ERP inconnu'; end if;
  end if;

  select count(*) into v_unknown_products
  from unnest(coalesce(p_products, '{}'::text[])) wanted(name)
  where not exists (
    select 1 from public."Product" p
    where p.active=true and lower(p.name)=lower(wanted.name)
  );
  if v_unknown_products > 0 then raise exception 'Module inconnu'; end if;

  update public."GemeindeProfil"
  set vp_id=v_vp_id,
      software_id=v_software_id,
      erp_id=v_erp_id,
      prime_client=coalesce(p_prime_client,false),
      notes=coalesce(p_notes,'')
  where bfs_id=p_bfs_id;

  if not found then raise exception 'Profil communal manquant'; end if;

  delete from public."GemeindeProduct" where bfs_id=p_bfs_id;

  insert into public."GemeindeProduct" (bfs_id,product_id,confidence,notes)
  select p_bfs_id,p.id,'confirmed','Édition Prime Communes 1.1'
  from public."Product" p
  join unnest(coalesce(p_products, '{}'::text[])) wanted(name)
    on lower(p.name)=lower(wanted.name)
  where p.active=true
  on conflict (bfs_id,product_id) do update
  set confidence=excluded.confidence,
      notes=excluded.notes,
      updated_at=now();

  return jsonb_build_object('ok',true,'bfs_id',p_bfs_id);
end;
$$;

revoke all on function public.save_commune_profile_v11(
  text, integer, boolean, text, text, text, text[], text
) from public;

grant execute on function public.save_commune_profile_v11(
  text, integer, boolean, text, text, text, text[], text
) to anon, authenticated;
