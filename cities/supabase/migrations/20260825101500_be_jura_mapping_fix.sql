-- Correct Jura bernois mapping: 39 current communes, keyed by stable OFS number.
with mapping(bfs_id, source_name) as (values
  (681, 'Belprahon'),
  (683, 'Champoz'),
  (687, 'Corcelles'),
  (431, 'Corgémont'),
  (432, 'Cormoret'),
  (433, 'Cortébert'),
  (690, 'Court'),
  (434, 'Courtelary'),
  (691, 'Crémines'),
  (709, 'Elay / Seehof'),
  (692, 'Eschert'),
  (694, 'Grandval'),
  (435, 'La Ferrière'),
  (723, 'La Neuveville'),
  (708, 'La Scheulte / Schelten'),
  (696, 'Loveresse'),
  (437, 'Mont-Tramelan'),
  (724, 'Nods'),
  (438, 'Orvin'),
  (701, 'Perrefitte'),
  (450, 'Péry-La Heutte'),
  (716, 'Petit-Val'),
  (726, 'Plateau de Diesse'),
  (715, 'Rebévelier'),
  (703, 'Reconvilier'),
  (441, 'Renan'),
  (704, 'Roches'),
  (442, 'Romont'),
  (706, 'Saicourt'),
  (443, 'Saint-Imier'),
  (449, 'Sauge'),
  (707, 'Saules'),
  (444, 'Sonceboz-Sombeval'),
  (445, 'Sonvilier'),
  (711, 'Sorvilier'),
  (713, 'Tavannes'),
  (446, 'Tramelan'),
  (717, 'Valbirse'),
  (448, 'Villeret')
)
update public."Gemeinde" g
set bezirk_code = 'BE-JURA-BERNOIS', market = 'Welsch'
from mapping m
where g.bfs_id = m.bfs_id and g.canton = 'BE';

insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20260825101500', array['Attach the 39 Jura bernois municipalities by OFS number','Classify the whole commercial district as Welsch'], 'be_jura_mapping_fix')
on conflict (version) do nothing;
