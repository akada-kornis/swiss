-- Five-year-old survey: FR/VD/VS only, blanks only.
insert into public."VP" (code,name) values
 ('axians','Axians'),('cresus','Crésus'),('epsilon','Epsilon'),('infomanaging','InfoManaging')
on conflict(code) do update set name=excluded.name;
insert into public."Software" (code,name) values
 ('ruf','Ruf'),('cresus','Crésus'),('epsilon','Epsilon'),('infomanaging','InfoManaging')
on conflict(code) do update set name=excluded.name;

-- Ruf/W&W/Axians Infoma/Axioma are one footprint: Axians | Ruf, everywhere.
update public."GemeindeProfil" gp set
 vp_id=(select id from public."VP" where code='axians'),
 software_id=(select id from public."Software" where code='ruf')
from public."VP" old
where gp.vp_id=old.id and regexp_replace(lower(coalesce(old.code,'')||coalesce(old.name,'')),'[^a-z0-9]+','','g')
 in ('rufruf','wwww','axiansinfomaaxiansinfoma','axiomaaxioma','ruf','ww','axiansinfoma','axioma');

create temporary table legacy_2021(canton text,name text,vp text,sw text,primary key(canton,name)) on commit drop;

insert into legacy_2021
select canton,trim(name),'axians','ruf' from (values
('VD',$n$Vulliens
Vuarrens
Vinzel
Villars-le-Terroir
Valeyres-sous-Rances
Assens
Treycovagnes
Tévenon
Tartegnin
Sullens
Sergey
Belmont-sur-Yverdon
Rueyres
Romanel-sur-Morges
Rances
Pomy
Pailly
Bottens
Boulens
Orges
Morrens (VD)
Mont-la-Ville
Montilliez
Montcherand
Montagny-près-Yverdon
Bursins
Lussy-sur-Morges
Luins
L'Isle
Lignerolle
Champagne
Les Clées
Corcelles-le-Jorat
Corcelles-près-Concise
Cronay
L'Abergement
La Sarraz
Denges
La Praz
Dully
Eclépens
Gilly
Giez
Fiez
Etagnières
Essertines-sur-Yverdon$n$),
('FR',$n$Farvagny
Hauterive (FR)
Grolley
Avry
Bas-Intyamon
Courgevaux
La Verrerie
Lully (FR)
La Sonnaz
Sorens
Gletterens
Ependes (FR)
Arconciel
Corbières
Grandvillard
Autigny
Jaun
Morlon
Botterens
Pont-la-Ville
Meyriez
Auboranges
Ferpicloz$n$)) s(canton,names)
cross join lateral regexp_split_to_table(s.names,E'\n') name;

insert into legacy_2021
select canton,trim(name),'t2i','citizen' from (values
('FR',$n$Fribourg
Bulle
Villars-sur-Glâne
Marly
Courtepin
Bas-Vully
Granges-Paccot
Attalens
Belfaux
Givisiez
Le Mouret
Riaz
Corminboeuf
Neyruz
Broc
Val-de-Charmey
Vuadens
Cheyres-Châbles
Gruyères
La Brillaz
Marsens
Pont-en-Ogoz
Haut-Intyamon
Matran
Cottens (FR)
Treyvaux
Le Pâquier (FR)
Saint-Martin (FR)
Chénens
Echarlens
Ponthaux
Crésuz$n$),
('VD',$n$Yvonand
Yens
Vucherens
Villars-le-Comte
Tolochenaz
Aigle
Vallorbe
Sainte-Croix
Puidoux
Préverenges
Ormont-Dessous
Orbe
Nyon
Montanaire
Bullet
Mauborget
Leysin
Chavornay
Coppet
Crissier
Le Chenit
L'Abbaye
Ecublens (VD)
Froideville
Forel (Lavaux)
Etoy$n$),
('VS',$n$Vouvry
Veyras
Vex
Vétroz
Vernayaz
Venthône
Val-d'Illiez
Ardon
Troistorrents
Trient
Sierre
Sembrancher
Saxon
Salvan
Saint-Maurice
Saint-Gingolph
Riddes
Port-Valais
Orsières
Bourg-Saint-Pierre
Bovernier
Nendaz
Mont-Noble
Monthey
Miège
Martigny-Combe
Leytron
Champéry
Collombey-Muraz
Isérables
Hérémence
Grône
Evolène
Evionnaz$n$)) s(canton,names)
cross join lateral regexp_split_to_table(s.names,E'\n') name on conflict do nothing;

insert into legacy_2021
select canton,trim(name),'data','urbanus' from (values
('FR',$n$Estavayer
Domdidier
Ursy
Montagny (FR)
Vuisternens-devant-Romont
Villaz
Siviriez
Misery-Courtion
Saint-Aubin (FR)
Cugy (FR)
Rue
Les Montets
Bossonnens
Villorsonnens
Sâles
Semsales
Le Flon
Remaufens
Fétigny
Mézières (FR)
Torny
Granges (Veveyse)
Billens-Hennens
Hauteville
Massonnens
Châtillon (FR)
Ménières
Ecublens (FR)
Sévaz$n$),
('VD',$n$Arnex-sur-Nyon
Moudon
Bussigny
Chavannes-près-Renens
Cheseaux-sur-Lausanne
Commugny
Eysins$n$),
('VS',$n$Ayent
Saint-Léonard
Conthey$n$)) s(canton,names)
cross join lateral regexp_split_to_table(s.names,E'\n') name on conflict do nothing;

insert into legacy_2021
select 'VD',trim(name),'cresus','cresus' from regexp_split_to_table($n$Villars-Epeney
Valeyres-sous-Ursins
Valeyres-sous-Montagny
Ursins
Suchy
Provence
Orzens
Oppens
Ogens
Chavannes-le-Chêne
Chêne-Pâquier
Donneloye
Ependes (VD)$n$,E'\n') name;

insert into legacy_2021 values
('VS','Lens','epsilon','epsilon'),('VS','Icogne','epsilon','epsilon'),
('VD','Bavois','infomanaging','infomanaging'),('VD','Mutrux','infomanaging','infomanaging'),
('VD','Chamblon','infomanaging','infomanaging'),('VD','Chavannes-sur-Moudon','infomanaging','infomanaging'),
('VD','Chigny','infomanaging','infomanaging'),('VD','Cottens (VD)','infomanaging','infomanaging'),
('VD','Démoret','infomanaging','infomanaging'),('VD','Grandevent','infomanaging','infomanaging'),
('VD','Féchy','infomanaging','infomanaging') on conflict do nothing;

insert into public."GemeindeProfil"(bfs_id,confidence,notes)
select g.bfs_id,'suspected','' from legacy_2021 s join public."Gemeinde" g on g.canton=s.canton and g.name=s.name
on conflict(bfs_id) do nothing;

update public."GemeindeProfil" gp set vp_id=v.id,software_id=w.id,confidence='suspected'
from legacy_2021 s join public."Gemeinde" g on g.canton=s.canton and g.name=s.name
join public."VP" v on v.code=s.vp join public."Software" w on w.code=s.sw
where gp.bfs_id=g.bfs_id and gp.vp_id is null and gp.software_id is null;

insert into supabase_migrations.schema_migrations(version,statements,name) values
('20260825093000',array['Normalize Ruf/W&W/Axians Infoma/Axioma to Axians | Ruf everywhere','Fill only blank FR/VD/VS profiles from the five-year-old survey'],'legacy_fr_vd_vs_blank_only')
on conflict(version) do nothing;
