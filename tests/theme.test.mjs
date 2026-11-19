import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {themeSelector} from '../src/theme-ui.js';

const source = await readFile(new URL('../src/theme.js', import.meta.url), 'utf8');
const key = 'havaas:color-scheme';
function fixture({saved, dark = false, blocked = false, unavailableMedia = false, legacyMedia = false} = {}) {
  const {window, document} = parseHTML(`<html><head><meta name="theme-color" content="#284e40"></head><body>${themeSelector()}<form><input value="unfinished"></form><div class="play-panel"></div></body></html>`);
  // Linkedom shares the window's expando properties and has no select.value setter.
  delete window.HavaasTheme;
  const patchSelect = select => Object.defineProperty(select, 'value', {configurable: true,
    get() {return this.querySelector('option[selected]')?.value || this.querySelector('option')?.value;},
    set(value) {for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected', option.value === value);}});
  patchSelect(document.querySelector('select'));
  const values = new Map([['havaas:v1', '{"version":1,"sound":true}']]);
  if (saved !== undefined) values.set(key, saved);
  const storage = {getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value)};
  Object.defineProperty(window, 'localStorage', {configurable: true, get() {if (blocked) throw Error('denied'); return storage;}});
  let mediaListener;
  const media = {matches: dark};
  if (legacyMedia) media.addListener = listener => {mediaListener = listener;};
  else media.addEventListener = (_type, listener) => {mediaListener = listener;};
  window.matchMedia = () => {if (unavailableMedia) throw Error('unsupported'); return media;};
  const run = () => vm.runInNewContext(source, {window, document});
  run();
  return {window, document, values, storage, run, patchSelect, controller: window.HavaasTheme,
    system(value) {media.matches = value; mediaListener?.();},
    storageEvent(value, eventKey = key, storageArea = storage) {
      const event = new window.Event('storage');Object.assign(event, {key: eventKey, newValue: value, storageArea});window.dispatchEvent(event);
    }};
}

test('appearance follows the system initially and only explicit changes write the preference', () => {
  const ui = fixture({dark: true});
  assert.equal(ui.document.documentElement.dataset.colorScheme, 'dark');
  assert.equal(ui.controller.getPreference(), 'system');
  assert.equal(ui.values.has(key), false);
  ui.system(false);
  assert.equal(ui.document.documentElement.dataset.colorScheme, 'light');
  assert.equal(ui.document.querySelector('meta').content, '#284e40');
  for (const saved of ['light', 'dark', 'system']) {
    const restored = fixture({saved, dark: true});
    assert.equal(restored.controller.getPreference(), saved);
    assert.equal(restored.document.documentElement.dataset.colorScheme, saved === 'light' ? 'light' : 'dark');
  }
});

test('manual appearance takes precedence and selecting system resumes live changes', () => {
  const ui = fixture({saved: 'light', dark: true});
  const select = ui.document.querySelector('[data-theme-select]');
  select.value = 'dark';select.dispatchEvent(new ui.window.Event('change', {bubbles: true}));
  assert.equal(ui.values.get(key), 'dark');
  ui.system(false);
  assert.equal(ui.document.documentElement.dataset.colorScheme, 'dark');
  assert.equal(ui.document.querySelector('meta').content, '#101820');
  ui.controller.setPreference('system');
  assert.equal(ui.document.documentElement.dataset.colorScheme, 'light');
  assert.equal(select.value, 'system');
  ui.system(true);
  assert.equal(ui.document.documentElement.dataset.colorScheme, 'dark');
  assert.equal(ui.values.get('havaas:v1'), '{"version":1,"sound":true}');
});

test('storage events synchronize tabs, deletion and clearing without echoing writes', () => {
  const ui = fixture({saved: 'light'});
  ui.storageEvent('dark');
  assert.equal(ui.controller.getPreference(), 'dark');
  assert.equal(ui.document.querySelector('select').value, 'dark');
  assert.equal(ui.values.get(key), 'light');
  ui.storageEvent('light', 'unrelated');
  ui.storageEvent('light', key, {});
  assert.equal(ui.controller.getPreference(), 'dark');
  ui.storageEvent(null);
  assert.equal(ui.controller.getPreference(), 'system');
  ui.storageEvent('dark');ui.storageEvent(null, null);
  assert.equal(ui.controller.getPreference(), 'system');
});

test('invalid or unavailable storage and unavailable media never prevent appearance changes', () => {
  for (const saved of ['', 'invalid', '{}', 'null']) {
    assert.equal(fixture({saved, dark: true}).document.documentElement.dataset.colorScheme, 'dark');
  }
  const blocked = fixture({blocked: true});
  blocked.controller.setPreference('dark');blocked.system(false);
  assert.equal(blocked.controller.getPreference(), 'dark');
  assert.equal(blocked.document.documentElement.dataset.colorScheme, 'dark');
  const unsupported = fixture({unavailableMedia: true});
  assert.equal(unsupported.document.documentElement.dataset.colorScheme, 'light');
  unsupported.controller.setPreference('dark');
  assert.equal(unsupported.document.documentElement.dataset.colorScheme, 'dark');
  const legacy = fixture({legacyMedia: true});legacy.system(true);
  assert.equal(legacy.document.documentElement.dataset.colorScheme, 'dark');
});

test('appearance changes retain DOM identity, form values and newly rendered control state', () => {
  const ui = fixture(), input = ui.document.querySelector('input'), panel = ui.document.querySelector('.play-panel');
  ui.controller.setPreference('dark');
  assert.equal(ui.document.querySelector('input'), input);
  assert.equal(input.value, 'unfinished');
  assert.equal(ui.document.querySelector('.play-panel'), panel);
  ui.document.body.insertAdjacentHTML('beforeend', themeSelector());ui.patchSelect([...ui.document.querySelectorAll('select')].at(-1));ui.controller.sync();
  assert.ok([...ui.document.querySelectorAll('select')].every(select => select.value === 'dark'));
  const controller = ui.controller;ui.run();assert.equal(ui.window.HavaasTheme, controller);
});

test('both HTML entrypoints bootstrap appearance before CSS and include the cached shared assets', async () => {
  for (const name of ['index.html', 'offline.html']) {
    const html = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.ok(html.indexOf('src="/src/theme.js"') < html.indexOf('rel="stylesheet"'));
    assert.match(html, /href="\/src\/theme.css"/);
    assert.doesNotMatch(html, /<script[^>]*>[^<]*localStorage/);
  }
  const {document} = parseHTML(themeSelector('dark'));
  assert.equal(document.querySelector('select').getAttribute('aria-label'), 'حالت نمایش');
  assert.equal(document.querySelector('option[selected]').value, 'dark');
  assert.equal(document.querySelectorAll('option').length, 3);
});
