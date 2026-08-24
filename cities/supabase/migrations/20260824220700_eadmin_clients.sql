with eadmin_clients(canton, name) as (
  values
    ('GE', 'Lancy'), ('GE', 'Vernier'), ('GE', 'Thônex'), ('GE', 'Onex'),
    ('GE', 'Carouge (GE)'), ('GE', 'Plan-les-Ouates'), ('GE', 'Collonge-Bellerive'), ('GE', 'Cologny'),
    ('VD', 'Montreux'), ('VD', 'Vevey'), ('VD', 'Aubonne'), ('VD', 'Prangins'), ('VD', 'Rolle'),
    ('VD', 'Cossonay'), ('VD', 'Echandens'), ('VD', 'Ecublens (VD)'), ('VD', 'Gland'),
    ('VD', 'Le Mont-sur-Lausanne')
)
insert into public."GemeindeProduct" (bfs_id, product_id, confidence)
select g.bfs_id, p.id, 'confirmed'
from eadmin_clients ec
join public."Gemeinde" g on g.canton = ec.canton and g.name = ec.name
cross join public."Product" p
where p.code = 'eadmin'
on conflict (bfs_id, product_id) do update
set confidence = excluded.confidence, updated_at = now();
