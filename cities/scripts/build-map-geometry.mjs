import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cacheDir = process.env.MAP_CACHE_DIR || '/tmp/prime-communes-map-cache';
const output = path.join(root, 'public/data/swiss-map-v1.json');
const api = 'https://api3.geo.admin.ch/rest/services/api/MapServer';
const municipalityLayer = 'ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill';
const cantonLayer = 'ch.swisstopo.swissboundaries3d-kanton-flaeche.fill';
const cantonCodes = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

await mkdir(cacheDir, { recursive: true });

const html = await readFile(path.join(root, 'index.html'), 'utf8');
const supabaseUrl = html.match(/SUPABASE_URL='([^']+)'/)?.[1];
const supabaseKey = html.match(/SUPABASE_KEY='([^']+)'/)?.[1];
if (!supabaseUrl || !supabaseKey) throw new Error('Configuration Supabase introuvable');

async function loadMunicipalities() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${supabaseUrl}/rest/v1/GemeindeAktuell?select=bfs_id,market&order=bfs_id`, {
      headers: { apikey: supabaseKey, Range: `${from}-${from + 999}` }
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function fetchGeometry(layer, id) {
  const cacheFile = path.join(cacheDir, `${layer.includes('gemeinde') ? 'g' : 'k'}-${id}.json`);
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  const url = `${api}/${layer}/${id}?sr=2056&geometryFormat=geojson`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      const geometry = payload.feature?.geometry;
      if (!geometry) throw new Error(`Géométrie absente pour ${id}`);
      await writeFile(cacheFile, JSON.stringify(geometry));
      return geometry;
    }
    if (attempt === 4) throw new Error(`swisstopo ${response.status} pour ${id}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function simplify(points, tolerance) {
  if (points.length <= 4) return points;
  const ring = points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points.slice();
  if (ring.length <= 3) return [...ring, ring[0]];
  const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let max = tolerance, index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(ring[i], ring[start], ring[end]);
      if (distance > max) { max = distance; index = i; }
    }
    if (index > -1) { keep[index] = 1; stack.push([start, index], [index, end]); }
  }
  const result = ring.filter((_, index) => keep[index]);
  if (result.length < 3) return [...ring.slice(0, 3), ring[0]];
  result.push(result[0]);
  return result;
}

function geometryToPath(geometry, tolerance) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap(polygon => polygon.map(ring => simplify(ring, tolerance)))
    .map(ring => ring.map(([x, y], index) => `${index ? 'L' : 'M'}${Math.round(x)},${-Math.round(y)}`).join('') + 'Z')
    .join('');
}

async function pool(items, concurrency, worker) {
  const result = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await worker(items[index], index);
      if ((index + 1) % 50 === 0) console.log(`${index + 1}/${items.length}`);
    }
  }));
  return result;
}

const municipalities = (await loadMunicipalities()).filter(row => row.market === 'Welsch');
console.log(`${municipalities.length} communes Welsch à préparer`);
const communePaths = await pool(municipalities, 12, async row => ({
  id: row.bfs_id,
  d: geometryToPath(await fetchGeometry(municipalityLayer, row.bfs_id), 90)
}));
const cantonPaths = await pool(cantonCodes.map((code, index) => ({ code, id: index + 1 })), 8, async canton => ({
  code: canton.code,
  d: geometryToPath(await fetchGeometry(cantonLayer, canton.id), 180)
}));

const payload = {
  meta: {
    source: 'swissBOUNDARIES3D · swisstopo',
    referenceDate: '2026-01-01',
    crs: 'EPSG:2056',
    viewBox: [2480000, -1305000, 360000, 260000],
    municipalityCount: communePaths.length
  },
  cantons: cantonPaths,
  municipalities: communePaths
};
await writeFile(output, JSON.stringify(payload));
console.log(`Carte écrite dans ${output}`);
