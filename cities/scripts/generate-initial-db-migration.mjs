import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../public/data/municipalities.json", import.meta.url), "utf8"));
const out = new URL("../supabase/migrations/20260824220200_initial_data.sql", import.meta.url);
const q = (value) => value == null || value === "" ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const qRequired = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const n = (value) => value == null ? "null" : String(value);
const chunks = (rows, size = 250) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
const importId = "00000000-0000-4000-8000-000000000001";
const vpCode = { Prime:"prime", Data:"data", Ofisa:"ofisa", T2i:"t2i", Calvin:"calvin", "Calvin | eAdmin":"calvin_eadmin", "Calvin | eAdmin ?":"calvin_eadmin", OBT:"obt", Talus:"talus", "Etic@SIEN":"etic_sien", Ciges:"ciges" };
const swCode = { innosolvcity:"innosolvcity", Urbanus:"urbanus" };
let sql = "begin;\n\n";

for (const part of chunks(data.municipalities)) {
  sql += `insert into public."Gemeinde" (bfs_id,name,canton,market,active) values\n${part.map(x => `(${x.id},${q(x.name)},${q(x.canton)},${q(x.market)},true)`).join(",\n")}\non conflict (bfs_id) do update set name=excluded.name,canton=excluded.canton,market=excluded.market,active=true,last_seen_at=now();\n\n`;
}

sql += `insert into public."DelimoImport" (id,reference_date,source_generated_at,status,row_count,changed_count,checksum,completed_at) values (${q(importId)},${q(data.meta.referenceDate)},${q(data.meta.generatedAt)},'success',${data.municipalities.length},${data.municipalities.length},'initial-github-import',now()) on conflict (id) do nothing;\n\n`;

for (const part of chunks(data.municipalities)) {
  sql += `insert into public."DelimoStand" (import_id,bfs_id,expected_population,received_population,received_on,delivery_status,comment,ech_version,missing_ewid,ewid_error_rate) values\n${part.map(x => `(${q(importId)},${x.id},${n(x.expectedPopulation)},${n(x.receivedPopulation)},${q(x.receivedOn)},${q(x.deliveryStatus)},${q(x.comment)},${q(x.echVersion)},${n(x.missingEwid)},${n(x.ewidErrorRate)})`).join(",\n")}\non conflict (import_id,bfs_id) do update set expected_population=excluded.expected_population,received_population=excluded.received_population,received_on=excluded.received_on,delivery_status=excluded.delivery_status,comment=excluded.comment,ech_version=excluded.ech_version,missing_ewid=excluded.missing_ewid,ewid_error_rate=excluded.ewid_error_rate;\n\n`;
}

const profiles = data.municipalities.filter(x => vpCode[x.integrator] || swCode[x.software] || x.salesStatus !== "none" || x.notes);
for (const x of profiles) {
  const vp = vpCode[x.integrator] ? `(select id from public."VP" where code=${q(vpCode[x.integrator])})` : "null";
  const sw = swCode[x.software] ? `(select id from public."Software" where code=${q(swCode[x.software])})` : "null";
  const confidence = x.integrator?.endsWith("?") ? "suspected" : x.integrator ? "confirmed" : "unknown";
  sql += `insert into public."GemeindeProfil" (bfs_id,vp_id,software_id,sales_status,confidence,notes) values (${x.id},${vp},${sw},${q(x.salesStatus || "none")},${q(confidence)},${qRequired(x.notes || "")}) on conflict (bfs_id) do update set vp_id=excluded.vp_id,software_id=excluded.software_id,sales_status=excluded.sales_status,confidence=excluded.confidence,notes=excluded.notes;\n`;
}

sql += "\ncommit;\n";
fs.writeFileSync(out, sql);
console.log(`Generated ${data.municipalities.length} Gemeinden and ${profiles.length} profiles in ${out.pathname}`);
