insert into public."GemeindeProfil" (bfs_id, vp_id, software_id, confidence)
select g.bfs_id, vp.id, sw.id, 'confirmed'
from public."Gemeinde" g
cross join public."VP" vp
cross join public."Software" sw
where g.canton = 'NE'
  and vp.code = 'sien'
  and sw.code = 'etic'
on conflict (bfs_id) do update
set vp_id = excluded.vp_id,
    software_id = excluded.software_id,
    confidence = excluded.confidence,
    updated_at = now();
