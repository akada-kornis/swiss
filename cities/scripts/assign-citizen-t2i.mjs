import fs from "node:fs";

const file = new URL("../public/data/municipalities.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));

for (const municipality of data.municipalities) {
  municipality.products ||= [];
  if (municipality.integrator === "T2i" && !municipality.products.includes("Citizen")) {
    municipality.products.push("Citizen");
  }
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Citizen assigned to ${data.municipalities.filter((item) => item.integrator === "T2i").length} T2i municipalities.`);
