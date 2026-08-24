import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));

for (const municipality of data.municipalities) {
  if (municipality.canton !== "GE") continue;

  const formerIntegrator = municipality.integrator || "";
  if (formerIntegrator.startsWith("Calvin | eAdmin")) {
    municipality.software = "Calvin | eAdmin";
  } else if (formerIntegrator === "Calvin") {
    municipality.software = "Calvin";
  }

  municipality.integrator = "SIACG";
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated ${data.municipalities.filter((item) => item.canton === "GE").length} Geneva municipalities.`);
