import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const suppliers = new Map();
const add = (canton, supplier, names) => names.split("|").filter(Boolean).forEach((name) => suppliers.set(`${canton}|${name}`, supplier));

add("BE", "Prime", "Saint-Imier|Tramelan|La Neuveville|Tavannes|Reconvilier|Plateau de Diesse|Péry-La Heutte|Sonceboz-Sombeval|Corgémont|Courtelary|Sonvilier|Renan (BE)|Villeret|Nods|Cortébert|Saicourt|La Ferrière|Cormoret|Romont (BE)|Corcelles (BE)");
add("BE", "Data", "Valbirse|Court|Orvin|Sauge|Crémines|Petit-Val|Eschert|Grandval|Loveresse|Sorvilier|Roches (BE)|Saules (BE)");

add("JU", "Prime", "Delémont|Haute-Sorne|Moutier|Porrentruy|Courrendlin|Courroux|Val Terbi|Courtételle|Boncourt|Haute-Ajoie|Bure");
add("JU", "Data", "Saignelégier|Courgenay|Alle|Le Noirmont|Fontenais|Les Breuleux|Clos du Doubs|Les Bois|Cornol|Boécourt|Lajoux (JU)|Montfaucon|Muriaux|Les Genevez (JU)|Châtillon (JU)|Soyhières|Movelier|Pleigne|Le Bémont (JU)|Saint-Brais|Les Enfers|Soubey");

add("VD", "Prime", "Lausanne|Montreux|Vevey|Morges|Gland|La Tour-de-Peilz|Blonay - Saint-Légier|Lutry|Rolle|Saint-Prex|Villeneuve (VD)|Bourg-en-Lavaux|Avenches|Prangins|Cossonay|Grandson|Penthalaz|Commugny|Arzier-Le Muids|Echandens|Lonay|La Sarraz|Daillens|Bavois|Tévenon|Féchy|Montagny-près-Yverdon|Onnens (VD)|Bonvillars|Henniez");
add("VD", "Ofisa", "Yverdon-les-Bains|Renens (VD)|Pully|Prilly|Payerne|Epalinges|Le Mont-sur-Lausanne|Ollon|Echallens|Oron|Saint-Sulpice (VD)|Aubonne|Belmont-sur-Lausanne|Corsier-sur-Vevey|Savigny|Chardonne|Crans (VD)|Chexbres|Jongny");
add("VD", "T2i", "Nyon|Ecublens (VD)|Aigle|Crissier|Orbe|Préverenges|Chavornay|Sainte-Croix|Le Chenit|Vallorbe|Leysin|Founex|Yvonand|Coppet|Echichens|Etoy|Puidoux|Montanaire|Froideville|Mies|Forel (Lavaux)|Tolochenaz|Bière|Yens|Ormont-Dessus");
add("VD", "Data", "Bussigny|Chavannes-près-Renens|Cheseaux-sur-Lausanne|Romanel-sur-Lausanne");
add("VD", "Infolog", "Bex");
add("VD", "Urbanus", "Moudon");
add("VD", "Larix", "Château-d'Oex");

const aliases = new Map([
  ["BE|Romont", "BE|Romont (BE)"],
  ["BE|Roches", "BE|Roches (BE)"],
  ["VD|Blonay - Saint-Légier-La Chiésaz", "VD|Blonay - Saint-Légier"],
  ["VD|Le Chenit (FUSION)", "VD|Le Chenit"],
]);
for (const [source, target] of aliases) {
  if (suppliers.has(source) && !suppliers.has(target)) suppliers.set(target, suppliers.get(source));
}

const found = new Set();
for (const municipality of data.municipalities) {
  const key = `${municipality.canton}|${municipality.name}`;
  if (!suppliers.has(key)) continue;
  municipality.software = suppliers.get(key);
  municipality.isPrime = municipality.software === "Prime";
  found.add(key);
}

const missing = [...suppliers.keys()].filter((key) => !found.has(key));
if (missing.length) console.warn(`Unmatched municipality names: ${missing.join(", ")}`);
fs.writeFileSync(file, JSON.stringify(data));
console.log(`Updated ${found.size} municipalities; ${missing.length} names unmatched.`);
