insert into public."VP" (code, name) values ('siacg', 'SIACG')
on conflict (code) do update set name = excluded.name, active = true;

insert into public."Software" (code, name) values
  ('calvin', 'Calvin'),
  ('calvin_eadmin', 'Calvin | eAdmin')
on conflict (code) do update set name = excluded.name, active = true;

with geneva as (
  select
    g.bfs_id,
    old_vp.code as former_vp,
    coalesce(gp.sales_status, 'none') as sales_status,
    coalesce(gp.confidence, 'confirmed') as confidence,
    coalesce(gp.notes, '') as notes
  from public."Gemeinde" g
  left join public."GemeindeProfil" gp on gp.bfs_id = g.bfs_id
  left join public."VP" old_vp on old_vp.id = gp.vp_id
  where g.canton = 'GE'
)
insert into public."GemeindeProfil" (bfs_id, vp_id, software_id, sales_status, confidence, notes)
select
  geneva.bfs_id,
  (select id from public."VP" where code = 'siacg'),
  case
    when geneva.former_vp = 'calvin' then (select id from public."Software" where code = 'calvin')
    when geneva.former_vp = 'calvin_eadmin' then (select id from public."Software" where code = 'calvin_eadmin')
    else null
  end,
  geneva.sales_status,
  geneva.confidence,
  geneva.notes
from geneva
on conflict (bfs_id) do update set
  vp_id = excluded.vp_id,
  software_id = excluded.software_id,
  confidence = excluded.confidence;

update public."VP"
set active = false
where code in ('calvin', 'calvin_eadmin');
