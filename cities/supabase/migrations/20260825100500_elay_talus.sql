-- Historical commercial information confirmed by the user.
insert into public."GemeindeProfil" (bfs_id, vp_id, software_id, sales_status, confidence, notes)
select g.bfs_id,
       (select id from public."VP" where code = 'talus'),
       (select id from public."Software" where code = 'innosolvcity'),
       'none', 'confirmed', ''
from public."Gemeinde" g
where g.canton = 'BE' and lower(g.name) in ('elay (seehof)', 'elay', 'seehof')
on conflict (bfs_id) do update set
  vp_id = excluded.vp_id,
  software_id = excluded.software_id,
  confidence = excluded.confidence,
  notes = excluded.notes,
  updated_at = now();

insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20260825100500', array['Set Elay (Seehof) to Talus | innosolvcity while preserving Welsch market'], 'elay_talus')
on conflict (version) do nothing;
