with eadmin_invoice_delta(canton, name) as (
  values
    ('VD', 'Bourg-en-Lavaux'),
    ('VD', 'Blonay - Saint-Légier')
)
insert into public."GemeindeProduct" (bfs_id, product_id, confidence, notes)
select g.bfs_id, p.id, 'confirmed', 'Confirmé par facturation eAdmin'
from eadmin_invoice_delta d
join public."Gemeinde" g on g.canton = d.canton and g.name = d.name
cross join public."Product" p
where p.code = 'eadmin'
on conflict (bfs_id, product_id) do update
set confidence = excluded.confidence,
    notes = excluded.notes,
    updated_at = now();
