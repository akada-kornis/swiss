(() => {
  'use strict';

  // Prime Communes 1.1 · stabilized bridge
  // The historical single-file prototype remains the rendering foundation.
  // This bridge owns the 1.1 data/editor/deep-link behaviour without changing
  // the visible product contract frozen in snapshot/prime-communes-1.1-final.

  const byId = id => document.getElementById(id);
  const truthyParam = value => value === '1' || value === 'true';
  const validViews = new Set(['communes', 'map', 'stats', 'roadmap']);
  const validSortKeys = new Set(['population', 'name']);
  const validDirections = new Set(['asc', 'desc']);
  const validMarkets = new Set(['Welsch', 'Uf Tüütsch', 'Ticino']);
  const EDIT_RPC = 'save_commune_profile_v11';
  let restoringUrlState = false;
  let logicielsMode = false;

  // Dedicated stabilization stylesheet. Historical CSS remains the base layer.
  if (!document.querySelector('link[href*="prime-communes-1.1.5.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'app/prime-communes-1.1.5.css?v=4';
    document.head.append(link);
  }

  // Refresh logo CSS after previous cached iterations.
  const productCss = document.querySelector('link[href*="product-assets.css"]');
  if (productCss) productCss.href = 'app/product-assets.css?v=7';

  function abacusMark(extraClass = '') {
    return `<img class="solution-mark abacus-mark${extraClass ? ` ${extraClass}` : ''}" src="public/assets/logos/abacus.png?v=2" alt="Abacus" title="Abacus">`;
  }

  // Prime-sold products get their marks. Competitor products remain text.
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
      known.push('<img class="module-mark abacus-module-mark" src="public/assets/logos/abacus.png?v=2" alt="Abacus" title="Abacus · SIRH Prime">');
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

  function injectLogicielsToggle() {
    if (byId('logicielsToggle')) return;
    const districts = byId('districtsToggle');
    if (!districts) return;
    const button = document.createElement('button');
    button.className = 'filter-toggle';
    button.id = 'logicielsToggle';
    button.type = 'button';
    button.textContent = 'Logiciels';
    button.title = 'Afficher / masquer les colonnes ERP et Modules';
    districts.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      logicielsMode = !logicielsMode;
      button.classList.toggle('on', logicielsMode);
      decorateSoftwareColumns();
      syncAfterEvent(true);
    });
  }

  function decorateSoftwareColumns() {
    const wrap = document.querySelector('.table-wrap');
    if (!wrap) return;
    wrap.classList.toggle('logiciels-hidden', !logicielsMode);
    const headings = [...wrap.querySelectorAll('thead th')];
    headings.forEach(th => {
      const label = th.textContent.trim().toLocaleLowerCase('fr-CH');
      if (label === 'erp') th.dataset.softwareColumn = 'erp';
      if (label === 'modules') th.dataset.softwareColumn = 'modules';
    });
    byId('logicielsToggle')?.classList.toggle('on', logicielsMode);
  }

  // The original render rebuilds the table. Re-decorate after every render.
  const baseRender = render;
  render = function renderWithSoftwareColumns() {
    baseRender();
    decorateSoftwareColumns();
  };

  const uniqueSorted = values => [...new Set(values.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'fr-CH', { sensitivity: 'base' }));

  const optionList = (values, selected, blankLabel = 'Non renseigné') => {
    const items = uniqueSorted([...values, selected]);
    return `<option value="">${esc(blankLabel)}</option>` + items.map(value =>
      `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`
    ).join('');
  };

  function moduleEditor(products) {
    const available = uniqueSorted([
      ...all.flatMap(row => row.products || []),
      ...products,
      'eAdmin',
      'Clever.Tax',
      'Abacus'
    ]);
    if (!available.length) return '<span class="empty">Aucun module au catalogue</span>';
    return `<div class="drawer-module-grid">${available.map(name => `
      <label class="drawer-module-option">
        <input type="checkbox" name="drawerModule" value="${esc(name)}" ${products.includes(name) ? 'checked' : ''}>
        <span>${esc(name)}</span>
      </label>`).join('')}</div>`;
  }

  function saveStatus(message = '', kind = '') {
    const node = byId('drawerSaveStatus');
    if (!node) return;
    node.textContent = message;
    node.className = `drawer-save-status${kind ? ` ${kind}` : ''}`;
  }

  async function saveDrawerProfile(x) {
    const button = byId('drawerSave');
    if (!button) return;
    let editKey = sessionStorage.getItem('primeCommunesEditKey') || '';
    if (!editKey) {
      editKey = window.prompt('Clé d’édition Prime Communes 1.1') || '';
      if (!editKey) return;
      sessionStorage.setItem('primeCommunesEditKey', editKey);
    }

    const selectedModules = [...document.querySelectorAll('input[name="drawerModule"]:checked')].map(input => input.value);
    const payload = {
      p_key: editKey,
      p_bfs_id: Number(x.id),
      p_prime_client: Boolean(byId('drawerPrimeClient')?.checked),
      p_integrator: byId('drawerIntegrator')?.value || null,
      p_software: byId('drawerSoftware')?.value || null,
      p_erp: byId('drawerErp')?.value || null,
      p_products: selectedModules,
      p_notes: byId('drawerNotes')?.value || ''
    };

    button.disabled = true;
    saveStatus('Enregistrement…');
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${EDIT_RPC}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 401 || response.status === 403 || /clé|key|denied|forbidden/i.test(detail)) {
          sessionStorage.removeItem('primeCommunesEditKey');
        }
        throw new Error(detail || `Erreur ${response.status}`);
      }
      saveStatus('Informations enregistrées ✓', 'success');
      await loadData();
      const refreshed = all.find(row => Number(row.id) === Number(x.id));
      if (refreshed) setTimeout(() => openDrawer(refreshed), 120);
    } catch (error) {
      console.error(error);
      saveStatus('Enregistrement impossible · vérifie la clé d’édition.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  // Full editable non-OFS ecosystem. OFS identity, canton, district and population remain read-only.
  openDrawer = function openEditableDrawer(x) {
    if (!x) return;
    const integrators = uniqueSorted(all.map(row => row.integrator));
    const softwares = uniqueSorted(all.map(row => row.software));
    const erps = uniqueSorted(all.map(row => row.erp));
    const products = [...(x.products || [])];
    const cantonCode = String(x.canton || '').toLowerCase();
    const delivery = ofsMode ? `<section><h3>Livraison Delimo</h3><dl><div><dt>Population reçue</dt><dd>${fmt.format(x.receivedPopulation ?? 0)}</dd></div><div><dt>Erreur EWID</dt><dd>${x.ewidErrorRate?.toFixed(1) ?? '—'}%</dd></div><div><dt>EWID manquants</dt><dd>${x.missingEwid?.toFixed(1) ?? '—'}%</dd></div><div><dt>Version eCH</dt><dd>${esc(x.echVersion)}</dd></div></dl><p class="delivery-comment">${esc(x.comment)}</p></section>` : '';

    byId('drawerRoot').innerHTML = `<div class="drawer-backdrop"><aside class="drawer">
      <button class="drawer-close" aria-label="Fermer">×</button>
      <div class="drawer-title">
        <div>
          <p>OFS ${x.id}</p>
          <h2>${esc(x.name)}</h2>
          <div class="drawer-location">
            <img src="public/cantons/${esc(cantonCode)}.svg" alt="${esc(x.canton)}">
            <strong>${esc(x.canton)}</strong>
            ${x.district ? `<span>·</span><span class="district-name">${esc(x.district)}</span>` : ''}
          </div>
        </div>
        ${x.isPrime ? '<img class="drawer-prime-mark" src="public/prime-one-negative.png?v=4" alt="Client Prime" title="Client Prime">' : ''}
      </div>
      <div class="drawer-pop"><strong>${fmt.format(x.expectedPopulation)}</strong><span>habitants attendus</span></div>
      ${delivery}
      <section>
        <h3>Écosystème communal</h3>
        <div class="drawer-edit-grid">
          <label class="drawer-client-toggle full-width"><span>Client Prime</span><input id="drawerPrimeClient" type="checkbox" ${x.isPrime ? 'checked' : ''}></label>
          <label>Intégrateur<select id="drawerIntegrator">${optionList(integrators, x.integrator)}</select></label>
          <label>Métier<select id="drawerSoftware">${optionList(softwares, x.software)}</select></label>
          <label>ERP<select id="drawerErp">${optionList(erps, x.erp)}</select></label>
          <label class="full-width">Modules${moduleEditor(products)}</label>
          <label class="full-width">Notes<textarea id="drawerNotes" placeholder="Informations utiles…">${esc(x.notes)}</textarea></label>
        </div>
        <button class="save-button" id="drawerSave">Enregistrer les informations</button>
        <p class="drawer-save-status" id="drawerSaveStatus">Données OFS verrouillées · écosystème modifiable</p>
      </section>
    </aside></div>`;

    document.querySelector('.drawer-close').onclick = closeDrawer;
    document.querySelector('.drawer-backdrop').onclick = event => {
      if (event.target === event.currentTarget) closeDrawer();
    };
    byId('drawerSave').onclick = () => saveDrawerProfile(x);
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
    byId('logicielsToggle')?.classList.toggle('on', logicielsMode);
    byId('issuesOnly')?.classList.toggle('on', issuesOnly);
    byId('issuesOnly')?.classList.toggle('warning', issuesOnly);
    if (byId('issuesOnly')) byId('issuesOnly').hidden = !ofsMode;
    byId('issuesCard')?.classList.toggle('ofs-active', ofsMode);
    if (byId('ofsLabel')) byId('ofsLabel').textContent = ofsMode ? byId('issues').textContent : 'Ouvrir';
    if (byId('ofsCopy')) byId('ofsCopy').textContent = ofsMode ? 'Revenir à la vue de marché' : 'Afficher les statuts Delimo';
    if (byId('ofsArrow')) byId('ofsArrow').textContent = ofsMode ? '←' : '→';
    document.querySelectorAll('.market-toggle').forEach(button => button.classList.toggle('on', button.dataset.market === marketOnly));
    decorateSoftwareColumns();
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
    logicielsMode = truthyParam(params.get('logiciels'));
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
    if (logicielsMode) params.set('logiciels', '1');
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

  const baseApplyData = applyData;
  applyData = function applyDataWithDeepLink(data, source) {
    baseApplyData(data, source);
    restoreFromUrl();
  };

  injectLogicielsToggle();

  byId('query')?.addEventListener('input', () => syncAfterEvent(false));
  byId('mapQuery')?.addEventListener('input', () => syncAfterEvent(false));

  ['canton', 'district', 'solution', 'statsScope', 'mapProduct'].forEach(id => {
    byId(id)?.addEventListener('change', () => syncAfterEvent(true));
  });

  ['primeOnly', 'eadminOnly', 'districtsToggle', 'issuesOnly', 'issuesCard', 'mapReset'].forEach(id => {
    byId(id)?.addEventListener('click', () => syncAfterEvent(true));
  });

  byId('reset')?.addEventListener('click', () => {
    logicielsMode = false;
    restoreFilterUi();
    syncAfterEvent(true);
  });

  document.querySelectorAll('.market-toggle, .view-tab, [data-map-perspective], [data-map-mode], [data-stats-metric], [data-stats-threshold]').forEach(button => {
    button.addEventListener('click', () => syncAfterEvent(true));
  });

  byId('tableHead')?.addEventListener('click', event => {
    if (event.target.closest('th.sortable')) syncAfterEvent(true);
  });

  byId('territoryComparison')?.addEventListener('click', event => {
    if (event.target.closest('button[data-stats-scope]')) syncAfterEvent(true);
  });

  window.addEventListener('popstate', restoreFromUrl);

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

    if (!findItem(items11, 'Stabilisation 1.1')) {
      const stabilization = document.createElement('div');
      stabilization.innerHTML = '<strong>Stabilisation 1.1</strong><span>Refactoring sans changement visuel : état des filtres fiabilisé, base Delivery documentée, permissions DB resserrées et point de restauration GitHub créé.</span><small>Socle préparé pour produits supplémentaires, données financières et migration vers l’infrastructure Prime</small>';
      items11.append(stabilization);
    }

    // 1.1 is delivered and stabilized.
    stage11.classList.remove('current');
    stage11.classList.add('completed-11');
    if (!stage11.querySelector('.roadmap-done')) {
      const done = document.createElement('span');
      done.className = 'roadmap-done';
      done.textContent = 'Terminé ✓';
      stage11.querySelector('header')?.append(done);
    }
    const journey11 = [...document.querySelectorAll('.roadmap-journey li')].find(item => item.querySelector('span')?.textContent.trim() === '1.1');
    if (journey11) {
      journey11.classList.remove('journey-know');
      journey11.classList.add('journey-done');
      const label = journey11.querySelector('strong');
      if (label && !label.textContent.includes('✓')) label.textContent = `${label.textContent} ✓`;
    }
  }

  refreshRoadmap();
  const footerVersion = document.querySelector('.footer-meta span:first-child');
  if (footerVersion) footerVersion.textContent = 'Prime Communes · version 1.1.8';

  if (all.length) restoreFromUrl();
  else render();
})();