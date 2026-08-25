-- Corrections confirmed by the user on 2026-08-25.
insert into public."VP" (code, name) values
  ('epsitec', 'Epsitec'),
  ('abraxas', 'Abraxas')
on conflict (code) do update set name = excluded.name;

update public."GemeindeProfil" gp
set vp_id = (select id from public."VP" where code = 'epsitec'), confidence = 'suspected'
from public."Software" sw
where gp.software_id = sw.id and sw.code = 'cresus';

update public."GemeindeProfil" gp
set vp_id = (select id from public."VP" where code = 'abraxas'), confidence = 'suspected'
from public."Software" sw
where gp.software_id = sw.id and sw.code = 'epsilon';

-- InfoManaging no longer exists: return its matched observations to unknown.
update public."GemeindeProfil" gp
set vp_id = null, software_id = null, confidence = 'unknown'
where gp.vp_id in (select id from public."VP" where code = 'infomanaging')
   or gp.software_id in (select id from public."Software" where code = 'infomanaging');

insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20260825094000', array['Normalize Crésus to Epsitec | Crésus','Normalize Epsilon to Abraxas | Epsilon','Clear obsolete InfoManaging observations'], 'vendor_name_corrections')
on conflict (version) do nothing;
