insert into public."VP" (code, name)
values ('sien', 'SIEN')
on conflict (code) do update set name = excluded.name, active = true, updated_at = now();

insert into public."Software" (code, name)
values ('etic', 'ETIC')
on conflict (code) do update set name = excluded.name, active = true, updated_at = now();

update public."GemeindeProfil" gp
set vp_id = (select id from public."VP" where code = 'sien'),
    software_id = (select id from public."Software" where code = 'etic'),
    confidence = 'confirmed',
    updated_at = now()
from public."Gemeinde" g
where g.bfs_id = gp.bfs_id and g.canton = 'NE';
