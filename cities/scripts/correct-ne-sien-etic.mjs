import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));

for (const municipality of data.municipalities) {
  if (municipality.canton !== "NE") continue;
  municipality.integrator = "SIEN";
  municipality.software = "ETIC";
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated ${data.municipalities.filter((item) => item.canton === "NE").length} Neuchâtel municipalities.`);
