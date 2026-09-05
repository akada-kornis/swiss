(() => {
  'use strict';

  // Prime Communes · POC MapLibre 1.5.
  // The historical 1.1 SVG map remains the default and stays fully available.
  const MAPLIBRE_VERSION = '6.7.0';
  const MAPLIBRE_MODULE = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`;
  const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

  const panel = document.getElementById('mapPanel');
  const currentStage = document.getElementById('mapStage');
  const query = document.getElementById('mapQuery');
  if (!panel || !currentStage || !query) return;

  let engine = 'current';
  let pocStage = null;
  let map = null;
  let maplibregl = null;
  let popup = null;
  let municipalityGeoJSON = null;
  let pointGeoJSON = null;
  let loadingPromise = null;

  function injectStyles() {
    if (!document.querySelector('link[href*="prime-communes-maplibre-poc.css"]')) {
      const local = document.createElement('link');
      local.rel = 'stylesheet';
      local.href = 'app/prime-communes-maplibre-poc.css?v=1';
      document.head.append(local);
    }
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const external = document.createElement('link');
      external.rel = 'stylesheet';
      external.href = MAPLIBRE_CSS;
      document.head.append(external);
    }
  }

  function injectEngineSwitch() {
    if (document.getElementById('mapEngineCompare')) return;
    const compare = document.createElement('div');
    compare.className = 'map-engine-compare';
    compare.id = 'mapEngineCompare';
    compare.innerHTML = `
      <div class="map-engine-copy"><strong>Comparer le moteur</strong><span>Même fond swisstopo, navigation différente.</span></div>
      <div class="map-engine-switch" role="group" aria-label="Moteur cartographique">
        <button type="button" class="active" id="mapEngineCurrent">Carte actuelle · 1.1</button>
        <button type="button" id="mapEngineMapLibre">MapLibre · POC 1.5</button>
      </div>`;
    panel.insertAdjacentElement('beforebegin', compare);
    document.getElementById('mapEngineCurrent').onclick = () => activateEngine('current');
    document.getElementById('mapEngineMapLibre').onclick = () => activateEngine('maplibre');
  }

  function ensurePocStage() {
    if (pocStage) return pocStage;
    pocStage = document.createElement('div');
    pocStage.className = 'maplibre-stage';
    pocStage.id = 'mapLibreStage';
    pocStage.hidden = true;
    pocStage.innerHTML = `
      <div id="primeMapLibre" aria-label="Carte MapLibre de la Suisse romande"></div>
      <div class="maplibre-badge">POC 1.5 · MapLibre + swisstopo</div>
      <aside class="maplibre-impact" id="mapLibreImpact">
        <p>L’empreinte Prime</p>
        <strong id="mapLibreImpactRatio">—</strong>
        <span>vit dans une commune gérée par Prime</span>
        <div><b id="mapLibreImpactPopulation">—</b><small> habitants · <span id="mapLibreImpactShare">—</span> de la Romandie</small></div>
      </aside>
      <div class="maplibre-loading" id="mapLibreLoading"><span></span>Chargement du moteur MapLibre…</div>`;
    currentStage.insertAdjacentElement('afterend', pocStage);
    return pocStage;
  }

  function syncImpactCard() {
    const ratio = document.getElementById('mapImpactRatio')?.textContent || '—';
    const population = document.getElementById('mapImpactPopulation')?.textContent || '—';
    const share = document.getElementById('mapImpactShare')?.textContent || '—';
    if (document.getElementById('mapLibreImpactRatio')) document.getElementById('mapLibreImpactRatio').textContent = ratio;
    if (document.getElementById('mapLibreImpactPopulation')) document.getElementById('mapLibreImpactPopulation').textContent = population;
    if (document.getElementById('mapLibreImpactShare')) document.getElementById('mapLibreImpactShare').textContent = share;
    if (document.getElementById('mapLibreImpact')) document.getElementById('mapLibreImpact').hidden = mapPerspective !== 'impact';
  }

  // Approximate official swisstopo LV95 -> WGS84 conversion, sufficient for
  // positioning the same local raster and municipality shapes in MapLibre.
  function lv95ToWgs84(easting, northing) {
    const y = (Number(easting) - 2600000) / 1000000;
    const x = (Number(northing) - 1200000) / 1000000;
    const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    const lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return [lon * 100 / 36, lat * 100 / 36];
  }

  function parsePathRings(d) {
    const tokens = String(d || '').match(/[MLZ]|-?\d+(?:\.\d+)?/gi) || [];
    const rings = [];
    let ring = [];
    let command = '';
    const closeRing = () => {
      if (ring.length < 3) {
        ring = [];
        return;
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
      if (ring.length >= 4) rings.push(ring);
      ring = [];
    };

    for (let i = 0; i < tokens.length;) {
      const token = tokens[i++];
      if (/^[MLZ]$/i.test(token)) {
        command = token.toUpperCase();
        if (command === 'M' && ring.length) closeRing();
        if (command === 'Z') closeRing();
        continue;
      }
      const x = Number(token);
      const y = Number(tokens[i++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (command === 'M' && ring.length) closeRing();
      ring.push(lv95ToWgs84(x, -y));
      command = 'L';
    }
    if (ring.length) closeRing();
    return rings;
  }

  function featureForMunicipality(shape, lookup) {
    const commune = lookup.get(String(shape.id));
    const rings = parsePathRings(shape.d);
    if (!rings.length) return null;
    return {
      type: 'Feature',
      id: String(shape.id),
      properties: {
        id: String(shape.id),
        name: commune?.name || '',
        canton: commune?.canton || '',
        population: Number(commune?.expectedPopulation || 0),
        isPrime: Boolean(commune?.isPrime),
        integrator: commune?.integrator || '',
        software: commune?.software || '',
        isInnosolv: commune?.software === 'innosolvcity',
        hasEadmin: Boolean(commune?.products?.includes('eAdmin')),
        productMatch: Boolean(commune?.products?.includes(mapProduct))
      },
      geometry: rings.length === 1
        ? { type: 'Polygon', coordinates: [rings[0]] }
        : { type: 'MultiPolygon', coordinates: rings.map(ring => [ring]) }
    };
  }

  function centroidPoint(shape, lookup) {
    const commune = lookup.get(String(shape.id));
    const oldPath = document.querySelector(`#swissMap .map-commune[data-id="${CSS.escape(String(shape.id))}"]`);
    if (!commune || !oldPath) return null;
    const box = oldPath.getBBox();
    const [lon, lat] = lv95ToWgs84(box.x + box.width / 2, -(box.y + box.height / 2));
    return {
      type: 'Feature',
      id: String(shape.id),
      properties: {
        id: String(shape.id),
        name: commune.name,
        canton: commune.canton,
        population: Number(commune.expectedPopulation || 0),
        isPrime: Boolean(commune.isPrime),
        isInnosolv: commune.software === 'innosolvcity',
        hasEadmin: Boolean(commune.products?.includes('eAdmin'))
      },
      geometry: { type: 'Point', coordinates: [lon, lat] }
    };
  }

  function buildGeoJSON() {
    const lookup = new Map(all.map(row => [String(row.id), row]));
    const municipalityFeatures = [];
    const pointFeatures = [];
    for (const shape of mapGeometry?.municipalities || []) {
      const feature = featureForMunicipality(shape, lookup);
      if (feature) municipalityFeatures.push(feature);
      const point = centroidPoint(shape, lookup);
      if (point) pointFeatures.push(point);
    }
    municipalityGeoJSON = { type: 'FeatureCollection', features: municipalityFeatures };
    pointGeoJSON = { type: 'FeatureCollection', features: pointFeatures };
  }

  function paletteExpression(key, palette) {
    const values = Object.entries(palette || {}).flatMap(([name, color]) => [name, color]);
    return ['match', ['get', key], ...values, mapFallback];
  }

  function fillColorExpression() {
    if (mapPerspective === 'impact') {
      return ['case', ['==', ['get', 'isPrime'], true], '#188bdc', 'rgba(225,232,232,0.28)'];
    }
    if (mapMode === 'product') {
      return ['case', ['==', ['get', 'productMatch'], true], '#36d494', '#253142'];
    }
    return paletteExpression(mapMode === 'software' ? 'software' : 'integrator', mapPalettes[mapMode]);
  }

  function refreshProductMatch() {
    if (!municipalityGeoJSON) return;
    const lookup = new Map(all.map(row => [String(row.id), row]));
    municipalityGeoJSON.features.forEach(feature => {
      const commune = lookup.get(String(feature.properties.id));
      feature.properties.productMatch = Boolean(commune?.products?.includes(mapProduct));
    });
    map?.getSource('municipalities')?.setData(municipalityGeoJSON);
  }

  function syncPocStyle({ fit = false } = {}) {
    if (!map || !map.isStyleLoaded()) return;
    refreshProductMatch();
    if (map.getLayer('municipalities-fill')) {
      map.setPaintProperty('municipalities-fill', 'fill-color', fillColorExpression());
      map.setPaintProperty('municipalities-fill', 'fill-opacity', mapPerspective === 'impact' ? 0.78 : 0.82);
    }
    if (map.getLayer('prime-halo')) map.setLayoutProperty('prime-halo', 'visibility', mapPerspective === 'impact' ? 'visible' : 'none');
    if (map.getLayer('prime-core')) map.setLayoutProperty('prime-core', 'visibility', mapPerspective === 'impact' ? 'visible' : 'none');
    if (map.getLayer('innosolv-dots')) map.setLayoutProperty('innosolv-dots', 'visibility', mapPerspective === 'impact' ? 'visible' : 'none');
    if (map.getLayer('eadmin-dots')) map.setLayoutProperty('eadmin-dots', 'visibility', mapPerspective === 'impact' ? 'visible' : 'none');
    syncImpactCard();
    if (fit) fitCurrentPerspective();
  }

  function boundsFromLv95Box(box) {
    const [x, y, w, h] = box.map(Number);
    const corners = [
      lv95ToWgs84(x, -y),
      lv95ToWgs84(x + w, -y),
      lv95ToWgs84(x + w, -(y + h)),
      lv95ToWgs84(x, -(y + h))
    ];
    const lngs = corners.map(point => point[0]);
    const lats = corners.map(point => point[1]);
    return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
  }

  function fitCurrentPerspective() {
    if (!map || !mapGeometry) return;
    const box = mapPerspective === 'impact' ? impactInitialViewBox() : mapGeometry.meta.viewBox;
    map.fitBounds(boundsFromLv95Box(box), {
      padding: window.matchMedia('(max-width:680px)').matches ? 8 : 18,
      duration: 380
    });
  }

  function addMapLayers() {
    const full = mapGeometry.meta.viewBox;
    const [x, y, w, h] = full;
    const imageCoordinates = [
      lv95ToWgs84(x, -y),
      lv95ToWgs84(x + w, -y),
      lv95ToWgs84(x + w, -(y + h)),
      lv95ToWgs84(x, -(y + h))
    ];

    map.addSource('swisstopo-base', {
      type: 'image',
      url: 'public/swiss-base.webp',
      coordinates: imageCoordinates
    });
    map.addLayer({
      id: 'swisstopo-base',
      type: 'raster',
      source: 'swisstopo-base',
      paint: { 'raster-opacity': 1 }
    });

    map.addSource('municipalities', { type: 'geojson', data: municipalityGeoJSON, promoteId: 'id' });
    map.addLayer({
      id: 'municipalities-fill',
      type: 'fill',
      source: 'municipalities',
      paint: {
        'fill-color': fillColorExpression(),
        'fill-opacity': mapPerspective === 'impact' ? 0.78 : 0.82
      }
    });
    map.addLayer({
      id: 'municipalities-line',
      type: 'line',
      source: 'municipalities',
      paint: {
        'line-color': mapPerspective === 'impact' ? 'rgba(45,79,102,.46)' : 'rgba(10,31,47,.72)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 10, 0.8, 13, 1.6]
      }
    });

    map.addSource('municipality-points', { type: 'geojson', data: pointGeoJSON, promoteId: 'id' });
    map.addLayer({
      id: 'prime-halo',
      type: 'circle',
      source: 'municipality-points',
      filter: ['==', ['get', 'isPrime'], true],
      paint: {
        'circle-color': '#159cff',
        'circle-opacity': 0.13,
        'circle-blur': 0.65,
        'circle-radius': ['interpolate', ['linear'], ['get', 'population'], 0, 11, 10000, 18, 100000, 29, 500000, 43]
      }
    });
    map.addLayer({
      id: 'prime-core',
      type: 'circle',
      source: 'municipality-points',
      filter: ['==', ['get', 'isPrime'], true],
      paint: {
        'circle-color': '#087bc4',
        'circle-opacity': 0.9,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.4, 10, 4.2, 13, 6.5]
      }
    });
    map.addLayer({
      id: 'innosolv-dots',
      type: 'circle',
      source: 'municipality-points',
      filter: ['==', ['get', 'isInnosolv'], true],
      paint: {
        'circle-color': ['case', ['==', ['get', 'isPrime'], true], '#44dc98', 'rgba(7,22,31,.92)'],
        'circle-stroke-color': '#44dc98',
        'circle-stroke-width': ['case', ['==', ['get', 'isPrime'], true], 1.1, 2.2],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.8, 10, 4.2, 13, 6]
      }
    });
    map.addLayer({
      id: 'eadmin-dots',
      type: 'circle',
      source: 'municipality-points',
      filter: ['all', ['==', ['get', 'hasEadmin'], true], ['==', ['get', 'isPrime'], true]],
      paint: {
        'circle-color': '#e52332',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.4, 10, 4, 13, 5.8]
      }
    });

    syncPocStyle({ fit: true });
  }

  function communePopupHTML(commune) {
    return `<div class="maplibre-popup"><strong>${esc(commune.name)}</strong><span>${esc(commune.canton)} · ${fmt.format(commune.expectedPopulation)} habitants${commune.isPrime ? ' · Client Prime' : ''}</span><small>${esc(commune.integrator || 'Intégrateur à compléter')} · ${esc(commune.software || 'métier à compléter')}${commune.erp ? ' · ERP ' + esc(commune.erp) : ''}${commune.products?.length ? ' · ' + esc(commune.products.join(' · ')) : ''}</small></div>`;
  }

  function bindInteractions() {
    map.on('mouseenter', 'municipalities-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'municipalities-fill', () => { map.getCanvas().style.cursor = ''; });
    map.on('mousemove', 'municipalities-fill', event => {
      if (window.matchMedia('(max-width:680px)').matches) return;
      const id = event.features?.[0]?.properties?.id;
      const commune = all.find(row => String(row.id) === String(id));
      if (!commune) return;
      if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      popup.setLngLat(event.lngLat).setHTML(communePopupHTML(commune)).addTo(map);
    });
    map.on('mouseleave', 'municipalities-fill', () => popup?.remove());
    map.on('click', 'municipalities-fill', event => {
      const id = event.features?.[0]?.properties?.id;
      const commune = all.find(row => String(row.id) === String(id));
      if (commune) openDrawer(commune);
    });
  }

  async function waitForData() {
    if (all.length) return;
    await new Promise(resolve => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (all.length || Date.now() - started > 5000) {
          window.clearInterval(timer);
          resolve();
        }
      }, 80);
    });
  }

  async function ensureMapLibre() {
    if (map) {
      window.setTimeout(() => map.resize(), 0);
      return map;
    }
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      ensurePocStage();
      await waitForData();
      if (!mapGeometry) await loadMap();
      if (!mapGeometry || !all.length) throw new Error('Données cartographiques indisponibles.');
      buildGeoJSON();
      maplibregl = await import(MAPLIBRE_MODULE);
      const container = document.getElementById('primeMapLibre');
      map = new maplibregl.Map({
        container,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#09111b' } }] },
        center: [7.55, 46.75],
        zoom: 7,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        maxBounds: [[5.70, 45.35], [10.85, 48.05]]
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
      map.touchZoomRotate.disableRotation();
      map.on('load', () => {
        addMapLayers();
        bindInteractions();
        const loading = document.getElementById('mapLibreLoading');
        if (loading) loading.hidden = true;
      });
      map.on('error', event => {
        if (!event?.error) return;
        console.error('Prime Communes · MapLibre', event.error);
      });
      return map;
    })().catch(error => {
      console.error(error);
      const loading = document.getElementById('mapLibreLoading');
      if (loading) loading.innerHTML = `<div class="maplibre-error">MapLibre n’a pas pu démarrer sur cet appareil.<br>${esc(error?.message || error)}</div>`;
      loadingPromise = null;
      throw error;
    });
    return loadingPromise;
  }

  async function activateEngine(next) {
    engine = next === 'maplibre' ? 'maplibre' : 'current';
    document.getElementById('mapEngineCurrent')?.classList.toggle('active', engine === 'current');
    document.getElementById('mapEngineMapLibre')?.classList.toggle('active', engine === 'maplibre');
    ensurePocStage();
    currentStage.hidden = engine !== 'current';
    pocStage.hidden = engine !== 'maplibre';
    if (engine === 'maplibre') {
      try {
        await ensureMapLibre();
        syncPocStyle();
        window.setTimeout(() => map?.resize(), 0);
      } catch (_) {}
    }
  }

  function findMapCommune(value) {
    const q = String(value || '').trim().toLocaleLowerCase('fr-CH');
    if (!q) return null;
    return all.find(row => row.market === 'Welsch' && row.name.toLocaleLowerCase('fr-CH') === q)
      || all.find(row => row.market === 'Welsch' && row.name.toLocaleLowerCase('fr-CH').includes(q));
  }

  function focusMapLibreCommune(commune) {
    if (!map || !commune || !pointGeoJSON) return;
    const point = pointGeoJSON.features.find(feature => String(feature.properties.id) === String(commune.id));
    if (!point) return;
    map.easeTo({ center: point.geometry.coordinates, zoom: Math.max(map.getZoom(), 11), duration: 550 });
    if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 12 });
    popup.setLngLat(point.geometry.coordinates).setHTML(communePopupHTML(commune)).addTo(map);
  }

  query.addEventListener('keydown', event => {
    if (engine !== 'maplibre' || event.key !== 'Enter') return;
    const commune = findMapCommune(event.currentTarget.value);
    if (!commune) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    query.blur();
    focusMapLibreCommune(commune);
  }, true);

  document.querySelectorAll('[data-map-perspective],[data-map-mode]').forEach(button => {
    button.addEventListener('click', () => window.setTimeout(() => {
      if (engine === 'maplibre') syncPocStyle({ fit: button.hasAttribute('data-map-perspective') });
    }, 0));
  });
  document.getElementById('mapProduct')?.addEventListener('change', () => window.setTimeout(() => {
    if (engine === 'maplibre') syncPocStyle();
  }, 0));
  document.querySelector('[data-view="map"]')?.addEventListener('click', () => {
    if (engine === 'maplibre') window.setTimeout(() => map?.resize(), 120);
  });

  function recordRoadmapPoc() {
    const stage15 = [...document.querySelectorAll('.roadmap-stage')]
      .find(stage => stage.querySelector('.roadmap-version')?.textContent.trim() === '1.5');
    const items = stage15?.querySelector('.roadmap-items');
    if (!items || [...items.querySelectorAll('strong')].some(node => /MapLibre/i.test(node.textContent))) return;
    const item = document.createElement('div');
    item.innerHTML = '<strong>Moteur cartographique MapLibre · POC</strong><span>Comparer le moteur SVG 1.1 et MapLibre en conservant le fond swisstopo et les données Prime.</span><small>POC actif · ancienne carte conservée en parallèle</small>';
    items.prepend(item);
  }

  injectStyles();
  injectEngineSwitch();
  recordRoadmapPoc();
})();
