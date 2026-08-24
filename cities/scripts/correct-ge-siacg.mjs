import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const eAdminMunicipalities = new Map([
  ["GE", new Set(["Lancy", "Vernier", "Thônex", "Onex", "Carouge (GE)", "Plan-les-Ouates", "Collonge-Bellerive", "Cologny"])],
  ["VD", new Set(["Montreux", "Vevey", "Aubonne", "Prangins", "Rolle", "Cossonay", "Echandens", "Ecublens (VD)", "Gland", "Le Mont-sur-Lausanne", "Bourg-en-Lavaux", "Blonay - Saint-Légier"])],
]);

for (const municipality of data.municipalities) {
  municipality.products ||= [];
  if (eAdminMunicipalities.get(municipality.canton)?.has(municipality.name)) {
    municipality.products = [...new Set([...(municipality.products || []), "eAdmin"])]
  }

  if (municipality.canton !== "GE") continue;

  const formerIntegrator = municipality.integrator || "";
  const formerSoftware = municipality.software || "";
  if (formerIntegrator.startsWith("Calvin | eAdmin") || formerSoftware.includes("eAdmin")) {
    municipality.products = [...new Set([...(municipality.products || []), "eAdmin"])]
  }

  municipality.integrator = "SIACG";
  municipality.software = "Calvin";
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated ${data.municipalities.filter((item) => item.canton === "GE").length} Geneva municipalities.`);
