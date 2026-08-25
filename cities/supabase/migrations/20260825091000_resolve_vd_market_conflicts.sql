-- Resolution confirmed by the user after the legacy VD comparison.
-- These values intentionally supersede the conflicting legacy observations.

with resolved(name, vp_code, software_code) as (values
  ('Lausanne', 'prime', 'innosolvcity'),
  ('Avenches', 'prime', 'innosolvcity'),
  ('Cossonay', 'prime', 'innosolvcity'),
  ('Arzier-Le Muids', 'prime', 'innosolvcity'),
  ('Henniez', 'prime', 'innosolvcity'),
  ('Founex', 'ofisa', 'innosolvcity'),
  ('Romanel-sur-Lausanne', 'ofisa', 'innosolvcity'),
  ('Echichens', 'ofisa', 'bdi'),
  ('Crans (VD)', 'ofisa', 'bdi'),
  ('Mies', 'ofisa', 'bdi'),
  ('Bière', 'ofisa', 'bdi')
)
update public."GemeindeProfil" gp
set vp_id = vp.id,
    software_id = sw.id,
    confidence = 'confirmed'
from resolved r
join public."Gemeinde" g on g.name = r.name and g.canton = 'VD'
join public."VP" vp on vp.code = r.vp_code
join public."Software" sw on sw.code = r.software_code
where gp.bfs_id = g.bfs_id;

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260825091000',
  array['Resolve the 11 VD market conflicts confirmed by the user'],
  'resolve_vd_market_conflicts'
)
on conflict (version) do nothing;
