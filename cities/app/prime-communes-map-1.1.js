(() => {
  'use strict';

  // Prime Communes 1.1 · mobile map ergonomics.
  // The swisstopo background and our SVG geometry remain untouched.
  const svg = document.getElementById('swissMap');
  const stage = document.getElementById('mapStage');
  const query = document.getElementById('mapQuery');
  if (!svg || !stage || typeof impactInitialViewBox !== 'function' || typeof setMapView !== 'function' || typeof zoomMap !== 'function') return;

  const mobileMq = window.matchMedia('(max-width:680px)');
  const isMobile = () => mobileMq.matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const originalImpactInitialViewBox = impactInitialViewBox;
  const originalSetMapView = setMapView;
  const originalZoomMap = zoomMap;

  function mapBounds() {
    if (Array.isArray(mapFullViewBox) && mapFullViewBox.length === 4) return mapFullViewBox.map(Number);
    // Exact extent of the local swisstopo raster used by renderMap().
    return [2480000, -1305000, 360000, 260000];
  }

  function clampViewBox(box) {
    if (!Array.isArray(box) || box.length !== 4) return box;
    const [bx, by, bw, bh] = mapBounds();
    let [x, y, w, h] = box.map(Number);
    w = Math.min(Math.max(1, w), bw);
    h = Math.min(Math.max(1, h), bh);
    x = clamp(x, bx, bx + bw - w);
    y = clamp(y, by, by + bh - h);
    return [x, y, w, h];
  }

  // Mobile impact framing used to extend beyond the raster itself, exposing
  // the beige/white bands visible above and below the map. Keep the view
  // entirely inside the swisstopo extent instead.
  impactInitialViewBox = function impactInitialViewBoxMobileSafe() {
    if (!isMobile()) return originalImpactInitialViewBox();
    const [bx, by, bw, bh] = mapBounds();
    const w = Math.min(205000, bw);
    const h = Math.min(260000, bh);
    const preferredX = 2480000;
    return [clamp(preferredX, bx, bx + bw - w), by, w, h];
  };

  // On Natel the map can no longer be dragged into empty space.
  setMapView = function setMapViewBounded() {
    if (isMobile() && Array.isArray(mapViewBox)) mapViewBox = clampViewBox(mapViewBox);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    return originalSetMapView();
  };

  // Mobile zoom keeps the current framing ratio, centres under the fingers,
  // and never zooms farther out than the chosen initial view.
  zoomMap = function zoomMapMobile(factor, clientX, clientY) {
    if (!isMobile() || !Array.isArray(mapViewBox)) return originalZoomMap(factor, clientX, clientY);
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const [x, y, w, h] = mapViewBox;
    const initialW = Number(mapInitialViewBox?.[2] || w);
    const minW = Math.max(10500, initialW * .12);
    const maxW = initialW;
    const nextW = clamp(w * factor, minW, maxW);
    const scale = nextW / w;
    const nextH = h * scale;
    const px = clientX == null ? .5 : clamp((clientX - rect.left) / rect.width, 0, 1);
    const py = clientY == null ? .5 : clamp((clientY - rect.top) / rect.height, 0, 1);
    mapViewBox = [x + (w - nextW) * px, y + (h - nextH) * py, nextW, nextH];
    setMapView();
  };

  function panPixels(dx, dy) {
    if (!Array.isArray(mapViewBox)) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mapViewBox[0] -= dx * mapViewBox[2] / rect.width;
    mapViewBox[1] -= dy * mapViewBox[3] / rect.height;
    setMapView();
  }

  function dismissHint() {
    stage.querySelector('.map-gesture-hint')?.classList.add('dismissed');
  }

  function ensureHint() {
    if (stage.querySelector('.map-gesture-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'map-gesture-hint';
    hint.textContent = 'Glisser · pincer pour zoomer';
    stage.append(hint);
    window.setTimeout(() => hint.classList.add('dismissed'), 5200);
  }

  function communeForId(id) {
    return all.find(row => String(row.id) === String(id));
  }

  function focusCommune(commune, path) {
    if (!commune || !path || !isMobile()) return;
    const box = path.getBBox();
    const rect = svg.getBoundingClientRect();
    const viewportRatio = rect.width && rect.height ? rect.width / rect.height : .65;
    const initialW = Number(mapInitialViewBox?.[2] || 205000);
    let targetW = Math.max(22000, box.width * 6.5);
    let targetH = Math.max(22000 / viewportRatio, box.height * 6.5);
    if (targetW / targetH < viewportRatio) targetW = targetH * viewportRatio;
    else targetH = targetW / viewportRatio;
    const maxW = initialW * .58;
    if (targetW > maxW) {
      const factor = maxW / targetW;
      targetW *= factor;
      targetH *= factor;
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    mapViewBox = [cx - targetW / 2, cy - targetH / 2, targetW, targetH];
    setMapView();

    svg.querySelectorAll('.map-commune.mobile-focused').forEach(node => node.classList.remove('mobile-focused'));
    path.classList.add('mobile-focused');

    const tooltip = document.getElementById('mapTooltip');
    if (tooltip) {
      tooltip.innerHTML = `<strong>${esc(commune.name)}</strong><span>${esc(commune.canton)} · ${fmt.format(commune.expectedPopulation)} habitants${commune.isPrime ? ' · Client Prime' : ''}</span><small>Touchez la commune pour ouvrir sa fiche</small>`;
      tooltip.classList.add('mobile-search-tooltip');
      tooltip.hidden = false;
      window.clearTimeout(tooltip._mobileHideTimer);
      tooltip._mobileHideTimer = window.setTimeout(() => {
        tooltip.hidden = true;
        tooltip.classList.remove('mobile-search-tooltip');
      }, 3200);
    }
  }

  // Enter in the search field now behaves like a map search: zoom to the
  // municipality first. Opening the drawer remains a deliberate tap.
  if (query) {
    query.addEventListener('keydown', event => {
      if (!isMobile() || event.key !== 'Enter') return;
      const value = event.currentTarget.value.trim().toLocaleLowerCase('fr-CH');
      if (!value) return;
      const commune = all.find(row => row.market === 'Welsch' && row.name.toLocaleLowerCase('fr-CH') === value)
        || all.find(row => row.market === 'Welsch' && row.name.toLocaleLowerCase('fr-CH').includes(value));
      if (!commune) return;
      const path = svg.querySelector(`.map-commune[data-id="${CSS.escape(String(commune.id))}"]`);
      if (!path) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      query.blur();
      focusCommune(commune, path);
      dismissHint();
    }, true);
  }

  // Native-feeling one-finger pan + two-finger pinch for touch screens.
  // Capture phase intentionally takes touch pointers away from the historical
  // mouse-oriented drag handler while leaving desktop mouse behaviour intact.
  const pointers = new Map();
  let lastCenter = null;
  let lastDistance = 0;
  let gestureMoved = false;
  let downCommuneId = '';
  let lastEmptyTap = { time: 0, x: 0, y: 0 };

  const centerOfPointers = () => {
    const values = [...pointers.values()];
    if (!values.length) return null;
    const sum = values.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / values.length, y: sum.y / values.length };
  };

  const distanceOfPointers = () => {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  svg.addEventListener('pointerdown', event => {
    if (!isMobile() || event.pointerType !== 'touch') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { svg.setPointerCapture(event.pointerId); } catch (_) {}
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dismissHint();

    if (pointers.size === 1) {
      lastCenter = { x: event.clientX, y: event.clientY };
      lastDistance = 0;
      gestureMoved = false;
      downCommuneId = event.target.closest?.('.map-commune')?.dataset.id || '';
    } else {
      lastCenter = centerOfPointers();
      lastDistance = distanceOfPointers();
      gestureMoved = true;
      downCommuneId = '';
    }
  }, true);

  svg.addEventListener('pointermove', event => {
    if (!isMobile() || event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      const current = centerOfPointers();
      if (lastCenter && current) {
        const dx = current.x - lastCenter.x;
        const dy = current.y - lastCenter.y;
        if (Math.abs(dx) + Math.abs(dy) > 1.5) gestureMoved = true;
        panPixels(dx, dy);
      }
      lastCenter = current;
      return;
    }

    const currentCenter = centerOfPointers();
    const currentDistance = distanceOfPointers();
    if (lastCenter && currentCenter) panPixels(currentCenter.x - lastCenter.x, currentCenter.y - lastCenter.y);
    if (lastDistance > 0 && currentDistance > 0 && currentCenter) {
      const factor = clamp(lastDistance / currentDistance, .82, 1.22);
      if (Math.abs(1 - factor) > .004) zoomMap(factor, currentCenter.x, currentCenter.y);
    }
    lastCenter = currentCenter;
    lastDistance = currentDistance;
    gestureMoved = true;
  }, true);

  function finishTouch(event) {
    if (!isMobile() || event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const wasSingle = pointers.size === 1;
    const communeId = downCommuneId;
    const moved = gestureMoved;
    pointers.delete(event.pointerId);

    if (wasSingle && !moved) {
      if (communeId) {
        const commune = communeForId(communeId);
        if (commune) openDrawer(commune);
      } else {
        const now = Date.now();
        const closeEnough = Math.hypot(event.clientX - lastEmptyTap.x, event.clientY - lastEmptyTap.y) < 36;
        if (now - lastEmptyTap.time < 320 && closeEnough) {
          zoomMap(.62, event.clientX, event.clientY);
          lastEmptyTap.time = 0;
        } else {
          lastEmptyTap = { time: now, x: event.clientX, y: event.clientY };
        }
      }
    }

    if (pointers.size === 1) {
      lastCenter = centerOfPointers();
      lastDistance = 0;
      gestureMoved = true;
    } else if (!pointers.size) {
      lastCenter = null;
      lastDistance = 0;
      gestureMoved = false;
      downCommuneId = '';
    }
  }

  svg.addEventListener('pointerup', finishTouch, true);
  svg.addEventListener('pointercancel', finishTouch, true);

  function refreshMobileFrame() {
    if (!isMobile()) return;
    ensureHint();
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    if (mapGeometry && mapFullViewBox && mapPerspective === 'impact') {
      mapInitialViewBox = impactInitialViewBox();
      mapViewBox = [...mapInitialViewBox];
      setMapView();
    }
  }

  refreshMobileFrame();
  mobileMq.addEventListener?.('change', refreshMobileFrame);
})();
