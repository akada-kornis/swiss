insert into public."Product" (code, name)
values ('citizen', 'Citizen')
on conflict (code) do update
set name = excluded.name, active = true, updated_at = now();

insert into public."GemeindeProduct" (bfs_id, product_id, confidence, notes)
select gp.bfs_id, p.id, 'confirmed', 'Produit standard de l’intégrateur T2i'
from public."GemeindeProfil" gp
join public."VP" vp on vp.id = gp.vp_id and vp.name = 'T2i'
cross join public."Product" p
where p.code = 'citizen'
on conflict (bfs_id, product_id) do update
set confidence = excluded.confidence,
    notes = excluded.notes,
    updated_at = now();
