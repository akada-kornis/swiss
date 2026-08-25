insert into public."Software" (code, name)
values ('citizen', 'Citizen')
on conflict (code) do update
set name = excluded.name,
    active = true,
    updated_at = now();

update public."GemeindeProfil" gp
set software_id = sw.id,
    confidence = 'confirmed',
    updated_at = now()
from public."VP" vp
cross join public."Software" sw
where gp.vp_id = vp.id
  and vp.name = 'T2i'
  and sw.code = 'citizen';
