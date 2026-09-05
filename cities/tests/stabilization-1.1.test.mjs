import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('1.1 bridge keeps the minimal software view as the real default state', async () => {
  const js = await read('app/prime-communes-1.1-base.js');
  assert.match(js, /let logicielsMode = false;/);
  assert.match(js, /logicielsMode = truthyParam\(params\.get\('logiciels'\)\);/);
  assert.match(js, /if \(logicielsMode\) params\.set\('logiciels', '1'\);/);
  assert.match(js, /byId\('reset'\).*?[\s\S]*?logicielsMode = false;/);
});

test('software columns are controlled by one semantic class, not inverted CSS hacks', async () => {
  const css = await read('app/prime-communes-1.1.5.css');
  assert.match(css, /\.table-wrap\.logiciels-hidden \.erp-cell/);
  assert.doesNotMatch(css, /:not\(\.logiciels-hidden\)/);
});

test('mobile peer filters remain a strict two-column grid', async () => {
  const css = await read('app/prime-communes-1.1.7-mobile.css');
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  for (const id of ['primeOnly', 'eadminOnly', 'districtsToggle', 'logicielsToggle']) {
    assert.match(css, new RegExp(`#${id}`));
  }
});

test('roadmap records stabilization and keeps audit in 1.5', async () => {
  const js = await read('app/prime-communes-1.1-base.js');
  assert.match(js, /Stabilisation 1\.1/);
  assert.match(js, /const audit = findItem\(items11, 'Audit trail'\)/);
  assert.match(js, /if \(audit\) items15\.prepend\(audit\)/);
});

test('production DB stabilization migration never writes business rows', async () => {
  const sql = await read('supabase/migrations/20260904190000_prime_communes_1_1_stabilization.sql');
  assert.match(sql, /DISABLE TRIGGER gemeinde_profil_audit/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE/);
  assert.doesNotMatch(sql, /\bUPDATE\s+public\."GemeindeProfil"/i);
  assert.doesNotMatch(sql, /\bINSERT\s+INTO\s+public\."GemeindeProfil"/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+public\."GemeindeProfil"/i);
});

test('current site still loads the stable 1.1 entry point', async () => {
  const html = await read('index.html');
  const loader = await read('app/prime-communes-1.1.js');
  assert.match(html, /<script src="app\/prime-communes-1\.1\.js\?v=1"><\/script>/);
  assert.match(loader, /prime-communes-1\.1-base\.js/);
  assert.match(loader, /prime-communes-map-1\.1\.js/);
  assert.match(loader, /prime-communes-maplibre-poc\.js/);
  assert.match(loader, /prime-communes-map-1\.1\.css/);
  assert.match(html, /id="communesView"/);
  assert.match(html, /id="mapView"/);
  assert.match(html, /id="statsView"/);
  assert.match(html, /id="roadmapView"/);
});

test('mobile map layer preserves swisstopo and adds bounded touch navigation', async () => {
  const js = await read('app/prime-communes-map-1.1.js');
  const css = await read('app/prime-communes-map-1.1.css');
  const html = await read('index.html');
  assert.match(html, /public\/swiss-base\.webp/);
  assert.match(html, /Surfaces officielles 2026 · swisstopo/);
  assert.match(js, /two-finger pinch/);
  assert.match(js, /clampViewBox/);
  assert.match(js, /focusCommune/);
  assert.match(js, /now - lastEmptyTap\.time < 320[\s\S]*?zoomMap\(\.62, event\.clientX, event\.clientY\)/);
  assert.match(css, /background:#09111b!important/);
  assert.match(css, /touch-action:none!important/);
});

test('MapLibre POC is parallel, pinned and keeps swisstopo', async () => {
  const js = await read('app/prime-communes-maplibre-poc.js');
  const css = await read('app/prime-communes-maplibre-poc.css');
  assert.match(js, /MAPLIBRE_VERSION = '6\.7\.0'/);
  assert.match(js, /mapEngineCurrent/);
  assert.match(js, /mapEngineMapLibre/);
  assert.match(js, /Carte actuelle · 1\.1/);
  assert.match(js, /public\/swiss-base\.webp/);
  assert.match(js, /lv95ToWgs84/);
  assert.match(js, /openDrawer\(commune\)/);
  assert.match(js, /engine = 'current'/);
  assert.match(css, /map-engine-compare/);
  assert.match(css, /maplibre-stage/);
});
