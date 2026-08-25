-- Legacy VD market survey supplied 2026-08-25 (about 2.5 years old).
-- Safety rule: fill blanks only; never replace a current, conflicting value.

insert into public."Software" (code, name)
values ('bdi', 'BDI')
on conflict (code) do update set name = excluded.name;

insert into public."VP" (code, name)
values ('ruf', 'Ruf')
on conflict (code) do update set name = excluded.name;

create temporary table legacy_vd_market (
  name text primary key,
  vp_code text not null,
  software_code text
) on commit drop;

insert into legacy_vd_market (name, vp_code, software_code)
select trim(name), 'ofisa', 'bdi'
from regexp_split_to_table($names$
Echichens
Arzier-Le Muids
Mont-sur-Rolle
Saint-Cergue
Crans (VD)
Mies
Genolier
Begnins
Bière
Jorat-Menthue
Perroy
Trélex
Jouxtens-Mézery
Bassins
Chavannes-de-Bogis
Vufflens-la-Ville
Gingins
Crassier
Noville
La Rippe
Goumoëns
Borex
Ballaigues
Duillier
Vich
Assens
Yvorne
Saint-George
Baulmes
Essertines-sur-Yverdon
Givrins
Boussens
Lavigny
Villars-Sainte-Croix
Montricher
Chavannes-des-Bois
Gollion
Lavey-Morcles
Veytaux
Vufflens-le-Château
Faoug
Rennaz
Bretigny-sur-Morrens
Rougemont
Pompaples
Bogis-Bossey
Poliez-Pittet
Lully (VD)
Saint-Barthélemy (VD)
Fey
Denens
Essertines-sur-Rolle
Cheseaux-Noréaz
Champvent
Saint-Livres
Buchillon
Montpreveyres
Arnex-sur-Orbe
Oulens-sous-Echallens
Villars-sous-Yens
Mathod
Signy-Avenex
Vuiteboeuf
Bremblens
Rossinière
Ballens
Aclens
Maracon
Vullierens
Vaulion
Coinsins
Chevroux
Ropraz
Longirod
Senarclens
Bursinel
Allaman
Villarzel
Saint-Oyens
Corbeyrier
Chessel
Penthéréaz
Bournens
Orny
Croy
La Chaux (Cossonay)
Burtigny
Grens
Chigny
Saint-Saphorin (Lavaux)
Henniez
Hermenches
Missy
Agiez
Juriens
Ferreyres
Chevilly
Curtilles
Moiry
Mollens (VD)
Berolle
Trey
Bretonnières
Cuarny
Dizy
Tartegnin
Bussy-sur-Moudon
Fontaines-sur-Grandson
Suscévaz
Premier
Chavannes-sur-Moudon
Vaux-sur-Morges
Bofflens
Prévonloup
La Praz
Chavannes-le-Veyron
Vugelles-La Mothe
Champtauroz
Treytorrens (Payerne)
Rossenges
Mauraz
$names$, E'\n') as name
where trim(name) <> '';

-- Only observations absent from the newer dataset need to be added here.
insert into legacy_vd_market (name, vp_code, software_code) values
('Nyon','t2i','citizen'),('Ecublens (VD)','t2i','citizen'),('Aigle','t2i','citizen'),
('Crissier','t2i','citizen'),('Orbe','t2i','citizen'),('Préverenges','t2i','citizen'),
('Chavornay','t2i','citizen'),('Sainte-Croix','t2i','citizen'),('Le Chenit','t2i','citizen'),
('Hautemorges','ofisa','innosolvcity'),('Vallorbe','t2i','citizen'),('Leysin','t2i','citizen'),
('Château-d''Oex','ofisa','innosolvcity'),('Yvonand','t2i','citizen'),('Valbroye','ofisa','innosolvcity'),
('Vully-les-Lacs','ofisa','innosolvcity'),('Coppet','t2i','citizen'),('Jorat-Mézières','ofisa','innosolvcity'),
('Etoy','t2i','citizen'),('Puidoux','t2i','citizen'),('Cugy (VD)','ofisa','innosolvcity'),
('Montanaire','t2i','citizen'),('Froideville','t2i','citizen'),('Corseaux','ofisa','innosolvcity'),
('Gimel','ofisa','innosolvcity'),('Forel (Lavaux)','t2i','citizen'),('Servion','ofisa','innosolvcity'),
('Tolochenaz','t2i','citizen'),('Montilliez','ruf',null),('Cudrefin','ofisa','innosolvcity'),
('Yens','t2i','citizen'),('Ormont-Dessus','t2i','citizen'),('Bercher','ofisa','innosolvcity'),
('Villars-le-Terroir','ruf',null),('Concise','ofisa','innosolvcity'),
('Bougy-Villars','ofisa','innosolvcity'),('Saubraz','ofisa','innosolvcity');

insert into public."GemeindeProfil" (bfs_id, confidence, notes)
select g.bfs_id, 'suspected', ''
from legacy_vd_market src
join public."Gemeinde" g on g.name = src.name and g.canton = 'VD'
on conflict (bfs_id) do nothing;

-- A row is updated only when every existing value is blank or agrees with the old observation.
update public."GemeindeProfil" gp
set vp_id = coalesce(gp.vp_id, vp.id),
    software_id = coalesce(gp.software_id, sw.id),
    confidence = case when gp.confidence = 'unknown' then 'suspected' else gp.confidence end
from legacy_vd_market src
join public."Gemeinde" g on g.name = src.name and g.canton = 'VD'
join public."VP" vp on vp.code = src.vp_code
left join public."Software" sw on sw.code = src.software_code
where gp.bfs_id = g.bfs_id
  and (gp.vp_id is null or gp.vp_id = vp.id)
  and (src.software_code is null or gp.software_id is null or gp.software_id = sw.id);

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260825090000',
  array['Import the legacy VD market survey without overwriting newer profiles'],
  'vd_legacy_market_import'
)
on conflict (version) do nothing;
