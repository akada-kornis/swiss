import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const eAdminMunicipalities = new Set(["Vernier", "Lancy", "Carouge (GE)", "Onex", "Thônex", "Plan-les-Ouates"]);

for (const municipality of data.municipalities) {
  municipality.products ||= [];
  if (municipality.canton !== "GE") continue;

  const formerIntegrator = municipality.integrator || "";
  const formerSoftware = municipality.software || "";
  if (formerIntegrator.startsWith("Calvin | eAdmin") || formerSoftware.includes("eAdmin") || eAdminMunicipalities.has(municipality.name)) {
    municipality.products = [...new Set([...(municipality.products || []), "eAdmin"])]
  }

  municipality.integrator = "SIACG";
  municipality.software = "Calvin";
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated ${data.municipalities.filter((item) => item.canton === "GE").length} Geneva municipalities.`);
