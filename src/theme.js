// A blocking, external bootstrap also used by the standalone offline page.
// Keep appearance independent of accounts, forms and the game lifecycle.
(() => {
  if (window.HavaasTheme) return;
  const key = 'havaas:color-scheme';
  const normalize = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let storage, media, preference = 'system';
  try { storage = window.localStorage; preference = normalize(storage.getItem(key)); } catch {}
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch {}

  function sync(root = document) {
    root.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
  }

  function apply() {
    const scheme = preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.colorScheme = scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#101820' : '#284e40');
    sync();
  }

  function setPreference(value) {
    preference = normalize(value);
    try { storage?.setItem(key, preference); } catch {}
    apply();
  }

  window.HavaasTheme = Object.freeze({getPreference: () => preference, setPreference, sync});
  document.addEventListener('change', event => {
    if (event.target.matches?.('[data-theme-select]')) setPreference(event.target.value);
  });
  document.addEventListener('DOMContentLoaded', () => sync(), {once: true});
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    if (storage && event.storageArea && event.storageArea !== storage) return;
    preference = normalize(event.newValue);
    apply();
  });
  const systemChanged = () => { if (preference === 'system') apply(); };
  if (media?.addEventListener) media.addEventListener('change', systemChanged);
  else media?.addListener?.(systemChanged);
  apply();
})();
