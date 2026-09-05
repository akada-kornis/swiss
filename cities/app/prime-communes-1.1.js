(() => {
  'use strict';

  // Prime Communes 1.1 · stable loader.
  // Keep the frozen 1.1 bridge intact, then layer both map engines on top.
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'app/prime-communes-map-1.1.css?v=1';
  document.head.append(style);

  const loadScript = (src, onload) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = onload || null;
    script.onerror = () => console.error(`Prime Communes · chargement impossible: ${src}`);
    document.body.append(script);
  };

  loadScript('app/prime-communes-1.1-base.js?v=1', () => {
    loadScript('app/prime-communes-map-1.1.js?v=1', () => {
      loadScript('app/prime-communes-maplibre-poc.js?v=1');
    });
  });
})();
