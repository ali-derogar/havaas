import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
const key = 'havaas:color-scheme';
const selector = page => page.getByRole('combobox', {name: 'حالت نمایش'});
const click = (page, action) => page.locator(`[data-action="${action}"]:visible`).first().click();
const scheme = (page, value) => expect(page.locator('html')).toHaveAttribute('data-color-scheme', value);
test.beforeAll(async () => {seed = JSON.parse(await readFile('.local/e2e-credentials.json', 'utf8'));});
async function login(page, user = 'otherUser') {
  await page.goto('/');
  await page.locator('#login-form [name=identifier]').fill(seed.users[user].username);
  await page.locator('#login-form [name=password]').fill(seed.password);
  await page.locator('#login-form [type=submit]').click();
  await expect(page.locator(user === 'admin' ? '.admin-stats' : '.client-welcome')).toBeVisible();
}
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => (await selector(page).boundingBox())?.width || 0).toBeGreaterThanOrEqual(44);
  await expect.poll(async () => (await selector(page).boundingBox())?.height || 0).toBeGreaterThanOrEqual(44);
  await expect(selector(page)).toBeInViewport();
}
async function darkSurface(page, target) {
  const color = await page.locator(target).first().evaluate(node => getComputedStyle(node).backgroundColor);
  expect(color).toMatch(/^rgb\((16, 24, 32|25, 37, 46|34, 51, 62)\)$/);
}
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: `.local/verification/theme-${name}.png`, fullPage: true, animations: 'disabled'});
}
async function readable(page, target) {
  const ratio = await page.locator(target).first().evaluate(node => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const light = values => values.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    let ancestor = node, background;
    do {background = rgb(getComputedStyle(ancestor).backgroundColor);ancestor = ancestor.parentElement;} while (background[3] === 0 && ancestor);
    const foreground = light(rgb(getComputedStyle(node).color)), back = light(background);
    return (Math.max(foreground, back) + .05) / (Math.min(foreground, back) + .05);
  });
  expect(ratio, `${target} contrast`).toBeGreaterThanOrEqual(4.5);
}

test('theme is resolved before styles load, follows system live and honors the saved preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  let release;
  const styles = new Promise(resolve => {release = resolve;});
  await page.route('**/src/theme.css', async route => {await styles;await route.continue();});
  try {
    await page.goto('/', {waitUntil: 'commit'});
    await scheme(page, 'dark');
    expect(await page.locator('meta[name=theme-color]').getAttribute('content')).toBe('#101820');
  } finally {release();}
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(selector(page)).toHaveValue('system');
  await page.emulateMedia({colorScheme: 'light'});await scheme(page, 'light');
  await selector(page).selectOption('dark');await page.emulateMedia({colorScheme: 'light'});await scheme(page, 'dark');
  await page.reload();await scheme(page, 'dark');await expect(selector(page)).toHaveValue('dark');
  await selector(page).selectOption('system');await scheme(page, 'light');
  await page.emulateMedia({colorScheme: 'dark'});await scheme(page, 'dark');
});

test('theme preserves forms, keyboard focus and preference across navigation, login and logout', async ({page}) => {
  await page.goto('/');
  const input = page.locator('#login-form [name=identifier]');await input.fill(seed.users.otherUser.username);
  const original = await input.elementHandle();
  await input.focus();await page.emulateMedia({colorScheme: 'dark'});await expect(input).toBeFocused();
  await selector(page).focus();await selector(page).selectOption('dark');await expect(selector(page)).toBeFocused();
  expect(await original.evaluate(node => node.isConnected)).toBe(true);await expect(input).toHaveValue(seed.users.otherUser.username);
  await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('.client-welcome')).toBeVisible();await scheme(page, 'dark');await expect(selector(page)).toHaveValue('dark');
  await click(page, 'account');await page.locator('#password-form [name=password]').fill('unfinished-new-password');
  const form = await page.locator('#password-form').elementHandle();
  await selector(page).selectOption('light');await expect(page.locator('.navigation-confirm')).toHaveCount(0);
  expect(await form.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('#password-form [name=password]')).toHaveValue('unfinished-new-password');
  await page.locator('#password-form [name=password]').fill('');
  await selector(page).selectOption('dark');await click(page, 'logout');await expect(page.locator('#login-form')).toBeVisible();
  await scheme(page, 'dark');await page.reload();await expect(selector(page)).toHaveValue('dark');
});

test('theme synchronizes open tabs and survives blocked storage', async ({page, context}) => {
  await page.goto('/');const other = await context.newPage();
  try {
    await other.goto('/');await selector(page).selectOption('dark');await scheme(other, 'dark');await expect(selector(other)).toHaveValue('dark');
    await other.evaluate(key => localStorage.removeItem(key), key);await expect(selector(page)).toHaveValue('system');
    await selector(other).selectOption('dark');await scheme(page, 'dark');
    await other.evaluate(() => localStorage.clear());await expect(selector(page)).toHaveValue('system');
  } finally {await other.close();}
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() {throw Error('denied');}}));
  await page.reload();await expect(page.locator('#login-form')).toBeVisible();
  await selector(page).selectOption('dark');await scheme(page, 'dark');
  await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);
  await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('.client-welcome')).toBeVisible();await expect(selector(page)).toHaveValue('dark');
});

test('both themes fit mobile and desktop, with dark client, admin, dialog and report surfaces', async ({page}) => {
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const mode of ['light', 'dark']) {
    await selector(page).selectOption(mode);
    for (const width of [320, 360, 1440]) {await page.setViewportSize({width, height: 960});await fits(page);}
    await shot(page, `login-${mode}`);
  }
  await darkSurface(page, 'body');await darkSurface(page, '.auth-card');await readable(page, '.auth-card>p');
  await login(page);
  for (const mode of ['light', 'dark']) {
    await selector(page).selectOption(mode);
    for (const width of [320, 360, 1440]) {await page.setViewportSize({width, height: 960});await fits(page);}
    await shot(page, `home-${mode}`);
  }
  await readable(page, '.client-welcome h1');await readable(page, '.client-welcome p');
  for (const action of ['assessment', 'dashboard', 'account', 'report-links']) {
    await click(page, action);await expect(page.locator('body')).toHaveAttribute('data-screen', action === 'dashboard' ? 'reports' : action);await fits(page);await darkSurface(page, 'body');
  }
  await click(page, 'account');await expect(page.locator('#password-form')).toBeVisible();
  await click(page, 'logout');await login(page, 'admin');await darkSurface(page, '.admin-header');await darkSurface(page, '.metric-card');
  await readable(page, '.admin-topbar>div:first-of-type>b');
  for (const width of [320, 360, 1440]) {await page.setViewportSize({width, height: 960});await fits(page);}
  await shot(page, 'admin-dark');
  await click(page, 'new-user');await darkSurface(page, '#modal');await expect(page.locator('#create-user-form')).toBeVisible();
  await shot(page, 'dialog-dark');await click(page, 'close-modal');expect(errors).toEqual([]);
});

test('all seven games retain their scored fields and state when the chrome changes theme', async ({page}) => {
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let now = 0, id = 0;const callbacks = new Map();performance.now = () => now;
    requestAnimationFrame = fn => {callbacks.set(++id, fn);return id;};cancelAnimationFrame = id => callbacks.delete(id);
    window.advanceThemeGame = ms => {now += ms;const pending = [...callbacks.values()];callbacks.clear();for (const fn of pending) fn(now);};
  });
  await page.emulateMedia({reducedMotion: 'reduce'});await login(page);
  const auth = await (await page.request.get('/api/auth/session')).json(), headers = {'X-CSRF-Token': auth.csrfToken};
  const games = ['hunt', 'ark', 'space', 'traffic', 'search', 'nback', 'stroop'];
  for (const gameId of games) {
    const response = await page.request.post(`/api/children/${seed.children[1].id}/sessions`, {headers, data: {gameId, kind: 'baseline'}});
    expect(response.ok()).toBe(true);const run = await response.json();
    expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`, {headers, data: {result: playSession(run)}})).ok()).toBe(true);
  }
  await page.reload();
  for (const game of games) {
    await page.locator(`[data-action=open][data-game=${game}]`).first().click();
    await selector(page).selectOption('dark');await click(page, 'main-game');
    await expect(page.locator('.game-preparation')).toBeVisible();await darkSurface(page, '.game-preparation');
    await click(page, 'begin-game');await page.evaluate(() => window.advanceThemeGame(3000));
    await expect(page.locator('.play-panel')).toHaveAttribute('data-phase', 'playing');
    await selector(page).selectOption('light');
    const panel = await page.locator('.play-panel').elementHandle();
    const fields = {hunt: '.hunt-surface', ark: '.object-grid', space: '.object-grid', traffic: '.traffic-signal-case', search: '.preview-symbol', nback: '.memory-focus-frame', stroop: '.studio-stage .focus-corners'};
    const field = page.locator(fields[game]).first();
    await expect(field).toBeVisible();
    await field.scrollIntoViewIfNeeded();
    const clip = await field.boundingBox();
    // The preview's rounded transparent corners belong to the workspace. Keep
    // the comparison on the opaque paper and the complete canonical stimulus.
    if (game === 'search') {clip.x += 12;clip.y += 12;clip.width -= 24;clip.height -= 24;}
    // Adventure controls overlay the bottom of the object field and change color.
    if (['ark', 'space'].includes(game)) {
      const controls = await page.locator('.play-controls').boundingBox();
      if (controls.y > clip.y) clip.height = Math.min(clip.height, controls.y - clip.y);
    }
    const before = await page.screenshot({clip, path: `.local/verification/theme-${game}-field-light.png`, animations: 'disabled'});
    const state = await page.locator('.play-panel').evaluate(node => ({time: document.querySelector('#time')?.textContent, hits: document.querySelector('#hits')?.textContent, phase: node.dataset.phase}));
    await selector(page).selectOption('dark');await darkSurface(page, 'body');await darkSurface(page, '.play-hud');
    expect(await panel.evaluate(node => node.isConnected)).toBe(true);
    expect(await page.locator('.play-panel').evaluate(node => ({time: document.querySelector('#time')?.textContent, hits: document.querySelector('#hits')?.textContent, phase: node.dataset.phase}))).toEqual(state);
    const after = await page.screenshot({clip, path: `.local/verification/theme-${game}-field-dark.png`, animations: 'disabled'});
    expect(after.equals(before), `${game}: scored field must be identical`).toBe(true);
    await selector(page).focus();await page.keyboard.press('Escape');await page.keyboard.press('Space');await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).not.toBeVisible();
    for (const width of [320, 360, 1440]) {await page.setViewportSize({width, height: 960});await fits(page);}
    await shot(page, `${game}-dark`);
    await click(page, 'pause');await click(page, 'home');await expect(page.locator('.client-welcome')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('offline appearance is shared and printing remains light', async ({page, context}) => {
  await login(page);await selector(page).selectOption('dark');await click(page, 'dashboard');
  await page.emulateMedia({media: 'print'});await expect(selector(page)).toBeHidden();
  expect(await page.locator('html').evaluate(node => getComputedStyle(node).colorScheme)).toBe('light');
  expect(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({media: 'screen'});await scheme(page, 'dark');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: 'برای ادامه، دوباره وصل شو'})).toBeVisible();
    await expect(selector(page)).toHaveValue('dark');await darkSurface(page, 'main');
    await page.setViewportSize({width: 320, height: 780});await fits(page);await shot(page, 'offline-dark');
    await selector(page).selectOption('light');await scheme(page, 'light');
  } finally {await context.setOffline(false);}
});

test('saved reports and anonymous family reports use dark surfaces and readable text', async ({page, browser}) => {
  await login(page);
  const auth = await (await page.request.get('/api/auth/session')).json(), headers = {'X-CSRF-Token': auth.csrfToken};
  const child = seed.children[1].id;
  for (const kind of ['baseline', 'training']) {
    const response = await page.request.post(`/api/children/${child}/sessions`, {headers, data: {gameId: 'traffic', kind}});
    expect(response.ok()).toBe(true);const run = await response.json();
    expect((await page.request.post(`/api/children/${child}/sessions/${run.id}/complete`, {headers, data: {result: playSession(run)}})).ok()).toBe(true);
  }
  await selector(page).selectOption('dark');await click(page, 'dashboard');await expect(page.locator('.report-metrics')).toBeVisible();
  for (const target of ['.report-sheet', '.report-metrics', '.report-profile']) await darkSurface(page, target);
  for (const target of ['.report-profile h2', '.report-metrics b', '.parent-narrative h3', '.parent-narrative p', '.observation-grid h3']) await readable(page, target);
  await shot(page, 'report-dark');
  const response = await page.request.post(`/api/children/${child}/report-links`, {headers, data: {label: 'آزمون ظاهر گزارش خانواده'}});
  expect(response.ok()).toBe(true);const link = await response.json();
  const family = await browser.newContext();
  try {
    await family.addInitScript(key => localStorage.setItem(key, 'dark'), key);
    const parent = await family.newPage();await parent.goto(link.url);await expect(parent.locator('.public-report')).toBeVisible();
    await expect(parent.locator('#login-form')).toHaveCount(0);await darkSurface(parent, '.report-metrics');
    for (const width of [320, 1440]) {await parent.setViewportSize({width, height: 960});await fits(parent);}
    await readable(parent, '.parent-narrative p');await shot(parent, 'family-report-dark');
  } finally {await family.close();}
});
