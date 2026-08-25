-- Preserve the legacy Ruf footprint as integrator + software.
insert into public."Software" (code, name)
values ('ruf', 'Ruf')
on conflict (code) do update set name = excluded.name;

update public."GemeindeProfil" gp
set software_id = (select id from public."Software" where code = 'ruf'),
    confidence = 'suspected'
from public."Gemeinde" g
join public."VP" vp on vp.code = 'ruf'
where gp.bfs_id = g.bfs_id
  and g.canton = 'VD'
  and gp.vp_id = vp.id;

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260825092000',
  array['Expose Ruf as the legacy software for Ruf-integrated municipalities'],
  'ruf_legacy_software'
)
on conflict (version) do nothing;
