(() => {
  'use strict';

  // Prime Communes 1.1 UI bridge:
  // - render Prime-sold Abacus with its official mark in ERP / module contexts
  // - make the active view + filters shareable in the URL
  // - keep browser Back / Forward aligned with the app state
  // - reflect the agreed 1.1 / 1.5 roadmap split without duplicating markup

  const byId = id => document.getElementById(id);
  const truthyParam = value => value === '1' || value === 'true';
  const validViews = new Set(['communes', 'map', 'stats', 'roadmap']);
  const validSortKeys = new Set(['population', 'name']);
  const validDirections = new Set(['asc', 'desc']);
  const validMarkets = new Set(['Welsch', 'Uf Tüütsch', 'Ticino']);
  let restoringUrlState = false;

  function abacusMark(extraClass = '') {
    return `<img class="solution-mark abacus-mark${extraClass ? ` ${extraClass}` : ''}" src="public/assets/logos/abacus.png?v=1" alt="Abacus" title="Abacus">`;
  }

  // Override only the presentation layer. The canonical facts remain in Supabase.
  renderModules = function renderModulesWithPrimeMarks(x) {
    const modules = x.products || [];
    const known = [];
    if (modules.includes('eAdmin')) {
      known.push('<img class="module-mark eadmin-mark" src="public/eadmin-mark-negative.png" alt="eAdmin" title="eAdmin · guichet virtuel">');
    }
    if (modules.includes('Clever.Tax')) {
      known.push('<img class="module-mark clevertax-mark" src="public/clevertax-mark-negative.png?v=1" alt="Clever.Tax" title="Clever.Tax · KMS">');
    }
    if (modules.includes('Abacus')) {
      known.push('<img class="module-mark abacus-module-mark" src="public/assets/logos/abacus.png?v=1" alt="Abacus" title="Abacus · SIRH Prime">');
    }
    const other = modules
      .filter(name => !['eAdmin', 'Clever.Tax', 'Abacus'].includes(name))
      .map(name => `<span class="module-chip">${esc(name)}</span>`);
    return [...known, ...other].join('');
  };

  const baseRenderErp = renderErp;
  renderErp = function renderErpWithPrimeMarks(x, drawer = false) {
    const erp = String(x.erp || '').trim();
    if (erp.toLocaleLowerCase('fr-CH') === 'abacus') {
      return abacusMark(drawer ? 'drawer-solution-mark' : '');
    }
    return baseRenderErp(x, drawer);
  };

  function currentView() {
    return document.querySelector('.view-tab.active')?.dataset.view || 'communes';
  }

  function setView(view, { scroll = false } = {}) {
    const next = validViews.has(view) ? view : 'communes';
    document.querySelectorAll('.view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === next));
    byId('communesView').hidden = next !== 'communes';
    byId('mapView').hidden = next !== 'map';
    byId('statsView').hidden = next !== 'stats';
    byId('roadmapView').hidden = next !== 'roadmap';
    byId('syncReload').hidden = next !== 'communes';
    if (next === 'map') loadMap().then(restoreMapUi);
    if (next === 'stats') renderStats();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function optionExists(select, value) {
    return Boolean(select && [...select.options].some(option => option.value === value));
  }

  function setSelectIfAvailable(id, value, fallback) {
    const select = byId(id);
    if (!select) return;
    const next = value && optionExists(select, value) ? value : fallback;
    if (next != null && optionExists(select, next)) select.value = next;
  }

  function restoreFilterUi() {
    byId('primeOnly')?.classList.toggle('on', primeOnly);
    byId('eadminOnly')?.classList.toggle('on', eadminOnly);
    byId('eadminOnly')?.classList.toggle('eadmin-on', eadminOnly);
    byId('districtsToggle')?.classList.toggle('on', districtsMode);
    byId('issuesOnly')?.classList.toggle('on', issuesOnly);
    byId('issuesOnly')?.classList.toggle('warning', issuesOnly);
    if (byId('issuesOnly')) byId('issuesOnly').hidden = !ofsMode;
    byId('issuesCard')?.classList.toggle('ofs-active', ofsMode);
    if (byId('ofsLabel')) byId('ofsLabel').textContent = ofsMode ? byId('issues').textContent : 'Ouvrir';
    if (byId('ofsCopy')) byId('ofsCopy').textContent = ofsMode ? 'Revenir à la vue de marché' : 'Afficher les statuts Delimo';
    if (byId('ofsArrow')) byId('ofsArrow').textContent = ofsMode ? '←' : '→';
    document.querySelectorAll('.market-toggle').forEach(button => button.classList.toggle('on', button.dataset.market === marketOnly));
  }

  function restoreStatsUi() {
    document.querySelectorAll('[data-stats-metric]').forEach(button => {
      button.classList.toggle('active', button.dataset.statsMetric === statsMetric);
    });
    document.querySelectorAll('[data-stats-threshold]').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.statsThreshold) === statsThreshold);
    });
  }

  function restoreMapUi() {
    document.querySelectorAll('[data-map-perspective]').forEach(button => {
      button.classList.toggle('active', button.dataset.mapPerspective === mapPerspective);
    });
    document.querySelectorAll('[data-map-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.mapMode === mapMode);
    });
    if (byId('mapModeControls')) byId('mapModeControls').hidden = mapPerspective !== 'factual';
    if (byId('mapImpact')) byId('mapImpact').hidden = mapPerspective !== 'impact';
    if (mapGeometry && mapFullViewBox) {
      mapInitialViewBox = mapPerspective === 'impact' ? impactInitialViewBox() : [...mapFullViewBox];
      mapViewBox = [...mapInitialViewBox];
      setMapView();
      renderMap();
      updateMapSearch();
    }
  }

  function restoreFromUrl() {
    restoringUrlState = true;
    const params = new URLSearchParams(window.location.search);

    if (byId('query')) byId('query').value = params.get('q') || '';
    setSelectIfAvailable('canton', params.get('canton'), 'Tous');
    updateDistrictOptions();
    setSelectIfAvailable('district', params.get('district'), '');
    setSelectIfAvailable('solution', params.get('solution'), 'Tous');

    marketOnly = validMarkets.has(params.get('market')) ? params.get('market') : '';
    primeOnly = truthyParam(params.get('prime'));
    eadminOnly = truthyParam(params.get('eadmin'));
    districtsMode = truthyParam(params.get('districts'));
    ofsMode = truthyParam(params.get('ofs'));
    issuesOnly = ofsMode && truthyParam(params.get('issues'));

    sortKey = validSortKeys.has(params.get('sort')) ? params.get('sort') : 'population';
    sortDirection = validDirections.has(params.get('dir')) ? params.get('dir') : 'desc';

    const requestedPerspective = params.get('mapPerspective');
    mapPerspective = requestedPerspective === 'factual' ? 'factual' : 'impact';
    const requestedMapMode = params.get('mapMode');
    mapMode = ['integrator', 'software', 'product'].includes(requestedMapMode) ? requestedMapMode : 'integrator';
    if (byId('mapQuery')) byId('mapQuery').value = params.get('mq') || '';
    setSelectIfAvailable('mapProduct', params.get('mapProduct'), mapProduct);
    if (byId('mapProduct')?.value) mapProduct = byId('mapProduct').value;

    setSelectIfAvailable('statsScope', params.get('statsScope'), 'romandie');
    statsMetric = params.get('statsMetric') === 'communes' ? 'communes' : 'population';
    const threshold = Number(params.get('statsThreshold'));
    statsThreshold = [0, 5000, 10000].includes(threshold) ? threshold : 0;

    restoreFilterUi();
    restoreStatsUi();
    restoreMapUi();

    const requestedView = validViews.has(params.get('view')) ? params.get('view') : 'communes';
    setView(requestedView);

    render();
    renderStats();
    if (mapGeometry) {
      renderMap();
      updateMapSearch();
    }
    restoringUrlState = false;
  }

  function syncUrl(push = false) {
    if (restoringUrlState) return;
    const params = new URLSearchParams();
    const view = currentView();
    if (view !== 'communes') params.set('view', view);

    const q = byId('query')?.value.trim();
    if (q) params.set('q', q);
    if (byId('canton')?.value && byId('canton').value !== 'Tous') params.set('canton', byId('canton').value);
    if (byId('district')?.value) params.set('district', byId('district').value);
    if (byId('solution')?.value && byId('solution').value !== 'Tous') params.set('solution', byId('solution').value);
    if (marketOnly) params.set('market', marketOnly);
    if (primeOnly) params.set('prime', '1');
    if (eadminOnly) params.set('eadmin', '1');
    if (districtsMode) params.set('districts', '1');
    if (ofsMode) params.set('ofs', '1');
    if (issuesOnly) params.set('issues', '1');
    if (sortKey !== 'population') params.set('sort', sortKey);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);

    if (view === 'map') {
      const mq = byId('mapQuery')?.value.trim();
      if (mq) params.set('mq', mq);
      if (mapPerspective !== 'impact') params.set('mapPerspective', mapPerspective);
      if (mapMode !== 'integrator') params.set('mapMode', mapMode);
      if (mapMode === 'product' && byId('mapProduct')?.value) params.set('mapProduct', byId('mapProduct').value);
    }

    if (view === 'stats') {
      if (byId('statsScope')?.value && byId('statsScope').value !== 'romandie') params.set('statsScope', byId('statsScope').value);
      if (statsMetric !== 'population') params.set('statsMetric', statsMetric);
      if (statsThreshold) params.set('statsThreshold', String(statsThreshold));
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history[push ? 'pushState' : 'replaceState']({ primeCommunes: true }, '', nextUrl);
  }

  function syncAfterEvent(push = true) {
    queueMicrotask(() => syncUrl(push));
  }

  // Re-apply URL state after each live/fallback data refresh, once all select options exist.
  const baseApplyData = applyData;
  applyData = function applyDataWithDeepLink(data, source) {
    baseApplyData(data, source);
    restoreFromUrl();
  };

  // Existing handlers still own the app behavior; these listeners only persist state.
  byId('query')?.addEventListener('input', () => syncAfterEvent(false));
  byId('mapQuery')?.addEventListener('input', () => syncAfterEvent(false));

  ['canton', 'district', 'solution', 'statsScope', 'mapProduct'].forEach(id => {
    byId(id)?.addEventListener('change', () => syncAfterEvent(true));
  });

  ['primeOnly', 'eadminOnly', 'districtsToggle', 'issuesOnly', 'issuesCard', 'reset', 'mapReset'].forEach(id => {
    byId(id)?.addEventListener('click', () => syncAfterEvent(true));
  });

  document.querySelectorAll('.market-toggle, .view-tab, [data-map-perspective], [data-map-mode], [data-stats-metric], [data-stats-threshold]').forEach(button => {
    button.addEventListener('click', () => syncAfterEvent(true));
  });

  byId('tableHead')?.addEventListener('click', event => {
    if (event.target.closest('th.sortable')) syncAfterEvent(true);
  });

  window.addEventListener('popstate', restoreFromUrl);

  // Roadmap 1.1 / 1.5 switch agreed in September 2026.
  function refreshRoadmap() {
    const stages = [...document.querySelectorAll('.roadmap-stage')];
    const stage11 = stages.find(stage => stage.querySelector('.roadmap-version')?.textContent.trim() === '1.1');
    const stage15 = stages.find(stage => stage.querySelector('.roadmap-version')?.textContent.trim() === '1.5');
    if (!stage11 || !stage15) return;

    const items11 = stage11.querySelector('.roadmap-items');
    const items15 = stage15.querySelector('.roadmap-items');
    if (!items11 || !items15) return;

    const findItem = (container, title) => [...container.children].find(item => item.querySelector('strong')?.textContent.trim() === title);
    const audit = findItem(items11, 'Audit trail');
    const map = findItem(items15, 'Carte suisse interactive');

    if (audit) items15.prepend(audit);
    if (map) items11.prepend(map);

    const temporalDependency = [...document.querySelectorAll('.roadmap-stage small')].find(node => node.textContent.includes('carte suisse 1.5'));
    if (temporalDependency) temporalDependency.textContent = temporalDependency.textContent.replace('carte suisse 1.5', 'carte suisse 1.1');

    if (!findItem(items11, 'Liens partageables')) {
      const deepLink = document.createElement('div');
      deepLink.innerHTML = '<strong>Liens partageables</strong><span>L’URL conserve l’onglet actif, les filtres, la recherche et le tri afin de rouvrir exactement la même vue.</span><small>Navigation Retour / Suivant du navigateur incluse</small>';
      items11.append(deepLink);
    }
  }

  refreshRoadmap();
  const footerVersion = document.querySelector('.footer-meta span:first-child');
  if (footerVersion) footerVersion.textContent = 'Prime Communes · version 1.1.4';

  // Force the already-published logo sizing rules to refresh even after an old browser cache.
  const productCss = document.querySelector('link[href*="product-assets.css"]');
  if (productCss) productCss.href = 'app/product-assets.css?v=6';

  // If data beat this script to the network, still apply the URL and refreshed render now.
  if (all.length) restoreFromUrl();
  else {
    render();
  }
})();
