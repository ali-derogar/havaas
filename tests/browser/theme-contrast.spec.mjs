import {test, expect, request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';
import {contrastIssues} from '../helpers/contrast.mjs';

const games = ['hunt', 'ark', 'space', 'traffic', 'search', 'nback', 'stroop'];
let seed, player, child;
test.use({serviceWorkers: 'block', reducedMotion: 'reduce', viewport: {width: 1440, height: 1000}});
test.beforeAll(async () => {
  seed = JSON.parse(await readFile('.local/e2e-credentials.json', 'utf8'));
  const admin = await request.newContext({baseURL: 'http://127.0.0.1:4181'}), guest = await request.newContext({baseURL: 'http://127.0.0.1:4181'});
  try {
    let auth = await (await admin.get('/api/auth/session')).json();
    auth = await (await admin.post('/api/auth/login', {headers: {'X-CSRF-Token': auth.csrfToken}, data: {identifier: seed.users.admin.username, password: seed.password}})).json();
    const link = await (await admin.post('/api/registration-links', {headers: {'X-CSRF-Token': auth.csrfToken}, data: {label: 'آزمون مستقل خوانایی حالت تاریک'}})).json();
    const session = await (await guest.get('/api/auth/session')).json();
    const created = await guest.post('/api/public/registration/complete', {headers: {'X-CSRF-Token': session.csrfToken}, data: {token: link.url.split('/').at(-1), username: 'contrast-' + randomUUID().slice(0, 12), password: seed.password, profile: {firstName: 'آزمون', lastName: 'خوانایی', birthDate: '2016-01-01', grade: 'پایهٔ ۳', school: 'مدرسهٔ آزمون'}}});
    expect(created.ok()).toBe(true);player = (await created.json()).user;
    child = (await (await guest.get('/api/bootstrap')).json()).profiles[0];
    const own = await (await guest.get('/api/auth/session')).json(), headers = {'X-CSRF-Token': own.csrfToken};
    for (const gameId of games.filter(id => id !== 'hunt')) {
      const response = await guest.post(`/api/children/${child.id}/sessions`, {headers, data: {gameId, kind: 'baseline'}});
      expect(response.ok()).toBe(true);const run = await response.json();
      expect((await guest.post(`/api/children/${child.id}/sessions/${run.id}/complete`, {headers, data: {result: playSession(run)}})).ok()).toBe(true);
    }
  } finally {await admin.dispose();await guest.dispose();}
});
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('havaas:color-scheme', 'dark');
    let now = 0, id = 0;const callbacks = new Map();performance.now = () => now;
    requestAnimationFrame = fn => {callbacks.set(++id, fn);return id;};cancelAnimationFrame = id => callbacks.delete(id);
    window.advanceContrast = ms => {now += ms;const pending = [...callbacks.values()];callbacks.clear();for (const fn of pending) fn(now);};
  });
});
const click = (page, action, extra = '') => page.locator(`[data-action="${action}"]${extra}:visible`).first().click();
async function login(page, user = player) {
  await page.goto('/');await page.locator('#login-form [name=identifier]').fill(user.username);
  await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form [type=submit]').click();
  await expect(page.locator(user.role === 'admin' ? '.admin-stats' : '.client-welcome')).toBeVisible();
}
async function readable(page, state) {
  await page.evaluate(() => document.fonts.ready);
  const issues = await page.evaluate(contrastIssues);
  expect(issues.slice(0, 12), `${state}: ${issues.length} visible labels below AA contrast`).toEqual([]);
}
async function bothWidths(page, state) {
  for (const width of [1440, 360]) {
    await page.setViewportSize({width, height: 1000});await readable(page, `${state}, ${width}px`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
}

test('dark navigation, badges, account descriptions and admin tables use paired colors', async ({page}) => {
  await page.goto('/');await expect(page.locator('#login-form')).toBeVisible();await bothWidths(page, 'login');
  await login(page);await bothWidths(page, 'home');
  await page.locator('[data-action=open][data-game=hunt]').first().click();await expect(page.locator('.intro-layout')).toBeVisible();
  await bothWidths(page, 'game before initial assessment');
  const auth = await (await page.request.get('/api/auth/session')).json(), headers = {'X-CSRF-Token': auth.csrfToken};
  const response = await page.request.post(`/api/children/${child.id}/sessions`, {headers, data: {gameId: 'hunt', kind: 'baseline'}});
  expect(response.ok()).toBe(true);const run = await response.json();
  expect((await page.request.post(`/api/children/${child.id}/sessions/${run.id}/complete`, {headers, data: {result: playSession(run)}})).ok()).toBe(true);
  await click(page, 'home');await expect(page.locator('.client-welcome')).toBeVisible();
  for (const action of ['assessment', 'account', 'report-links', 'dashboard']) {
    await click(page, action);await expect(page.locator('body')).toHaveAttribute('data-screen', action === 'dashboard' ? 'reports' : action);
    await bothWidths(page, action);
  }
  await click(page, 'account');await expect(page.locator('#password-form')).toBeVisible();await click(page, 'logout');await login(page, seed.users.admin);
  await bothWidths(page, 'admin');
  for (const [action, screen] of [['admin-users', 'admin-users'], ['admin-invitations', 'invitations'], ['admin-audit', 'audit'], ['admin-game-settings', 'game-settings'], ['account', 'account']]) {
    if (await page.locator('.menu-toggle').isVisible()) await click(page, 'admin-menu');
    await click(page, action);await expect(page.locator('body')).toHaveAttribute('data-screen', screen);await bothWidths(page, screen);
  }
});

for (const game of games) test(`dark ${game}: teaching, rules, arena and expanded result stay readable`, async ({page}) => {
  await login(page);await page.locator(`[data-action=open][data-game=${game}]`).first().click();
  await expect(page.locator('.intro-layout')).toBeVisible();await page.locator('.intro-companion').evaluate(node => {node.open = true;});
  await bothWidths(page, `${game} introduction`);
  if (game === 'nback') await click(page, 'lesson-memory-help');
  if (game === 'search') {
    await click(page, 'lesson-choice', '[data-index="0"]');await readable(page, 'search learning feedback');
    await click(page, 'lesson-next');await click(page, 'lesson-hide');
  }
  else await click(page, 'lesson-answer');
  await readable(page, `${game} learning feedback`);
  if (game === 'nback') await page.screenshot({path: '.local/verification/theme-fixed-memory-mobile.png', fullPage: true});
  await click(page, 'main-game');await expect(page.locator('.game-preparation')).toBeVisible();await bothWidths(page, `${game} preparation`);
  await click(page, 'begin-game');await page.evaluate(() => window.advanceContrast(3000));
  await expect(page.locator('.play-panel')).toHaveAttribute('data-phase', 'playing');await bothWidths(page, `${game} arena`);
  if (game === 'search') {
    await page.screenshot({path: '.local/verification/theme-fixed-search-mobile.png', fullPage: true});
    await page.evaluate(() => window.advanceContrast(2000));await expect(page.locator('.search-grid')).toBeVisible();await readable(page, 'search choices');
  }
  if (['ark', 'space'].includes(game)) {
    for (let pass = 0; pass < 2; pass++) {
      const ids = await page.locator('.scene-object:not(:disabled)').evaluateAll(nodes => nodes.map(node => node.dataset.index));
      for (const id of ids) {
        const item = page.locator(`[data-action=item][data-index="${id}"]:not(:disabled)`);
        if (await item.count()) await item.evaluate(node => node.click());
      }
    }
    await page.locator('.depart-button').click();
  } else {
    let rule = '';
    for (let i = 0; i < 220 && !await page.locator('.result-card').count(); i++) {
      if (await page.locator('.automatic-rule-notice').count()) {
        const title = await page.locator('.automatic-rule-notice h2').textContent();
        if (title !== rule) {rule = title;await readable(page, `stroop rule: ${rule}`);}
      }
      await page.evaluate(() => window.advanceContrast(5000));
    }
  }
  await expect(page.locator('.result-card')).toBeVisible();
  await page.locator('details.result-learning').evaluate(node => {node.open = true;});
  await bothWidths(page, `${game} result and recap`);
  if (game === 'nback') await page.screenshot({path: '.local/verification/theme-fixed-memory-result.png', fullPage: true});
});
