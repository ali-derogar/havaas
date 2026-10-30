import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function login(page){
  await page.goto('/');
  await page.locator('#login-form [name=identifier]').fill(seed.users.admin.username);
  await page.locator('#login-form [name=password]').fill(seed.password);
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('.admin-stats')).toBeVisible();
}
async function selectBirthday(form,year,month,day){
  await form.locator('[data-birth-part=year]').selectOption(String(year));
  await form.locator('[data-birth-part=month]').selectOption(String(month));
  await form.locator('[data-birth-part=day]').selectOption(String(day));
}
async function createLink(page){
  await page.locator('[data-action=new-user]').first().click();
  await page.locator('[data-action=create-mode][data-mode=link]').click();
  await page.locator('#registration-link-form button[type=submit]').click();
  await expect(page.locator('#invitation-url')).toBeVisible();
  return page.locator('#invitation-url').inputValue();
}

test('admin creates and edits a Jalali birthday, including Esfand leap days and future-date validation',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+03:30'));
  await login(page);
  await page.locator('[data-action=new-user]').first().click();
  const form=page.locator('#create-user-form');
  await form.locator('[name=username]').fill('jalali-birthday-client');
  await form.locator('[name=password]').fill('Jalali-birthday-test-2026!');
  await form.locator('[name=firstName]').fill('تقویم');
  await form.locator('[name=lastName]').fill('شمسی');
  await form.locator('[name=school]').fill('امید');
  await form.locator('[name=grade]').selectOption({label:'پایهٔ ۳'});
  await selectBirthday(form,1400,12,29);
  await expect(form.locator('[data-birth-part=day] option[value="30"]')).toHaveCount(0);
  await form.locator('[data-birth-part=year]').selectOption('1399');
  await form.locator('[data-birth-part=day]').selectOption('30');
  const created=page.waitForResponse(response=>response.url().endsWith('/api/users')&&response.request().method()==='POST');
  await form.locator('button[type=submit]').click();
  const response=await created;expect(response.status()).toBe(201);
  const data=await response.json();expect(data.profile.birthDate).toBe('2021-03-20');
  await page.locator(`[data-action=inspect-user][data-user="${data.user.id}"]`).click();
  await page.locator('[data-action=user-tab][data-tab=details]').click();
  const edit=page.locator('#edit-user-form');
  await expect(edit.locator('[data-birth-part=year]')).toHaveValue('1399');
  await expect(edit.locator('[data-birth-part=month]')).toHaveValue('12');
  await expect(edit.locator('[data-birth-part=day]')).toHaveValue('30');
  const currentYear=await edit.locator('[data-birth-part=year] option').nth(1).getAttribute('value');
  await selectBirthday(edit,currentYear,12,29);
  await expect(edit.locator('[data-birth-error]')).toContainText('آینده');
  expect(await edit.locator('[data-birth-part=day]').evaluate(element=>element.checkValidity())).toBe(false);
  await selectBirthday(edit,1400,1,1);
  const saved=page.waitForResponse(response=>response.url().endsWith(`/api/users/${data.user.id}`)&&response.request().method()==='PATCH');
  await edit.locator('button[type=submit]').click();
  const updated=await saved;expect(updated.status()).toBe(200);
  const stored=await page.request.get(`/api/users/${data.user.id}`);expect((await stored.json()).profile.birthDate).toBe('2021-03-21');
  await expect(page.locator('#edit-user-form [data-birth-part=year]')).toHaveValue('1400');
});

test('public signup accepts a Jalali birthday and stores the matching Gregorian date',async({page,browser})=>{
  await login(page);const url=await createLink(page);
  const context=await browser.newContext(),guest=await context.newPage();
  try{
    await guest.goto(url);
    const form=guest.locator('#registration-form');await expect(form).toBeVisible();
    for(const [name,value] of Object.entries({username:'jalali-self-signup',password:'Jalali-signup-test-2026!',firstName:'تولد',lastName:'شمسی',school:'امید'}))await form.locator(`[name=${name}]`).fill(value);
    await form.locator('[name=grade]').selectOption({label:'پایهٔ ۳'});
    await selectBirthday(form,1394,10,11);
    const submitted=guest.waitForResponse(response=>response.url().endsWith('/api/public/registration/complete'));
    await form.locator('button[type=submit]').click();
    const response=await submitted;expect(response.status()).toBe(201);
    const bootstrap=await context.request.get(new URL('/api/bootstrap',url).href);
    expect((await bootstrap.json()).profiles[0].birthDate).toBe('2016-01-01');
    await expect(guest.locator('.profile-strip')).toContainText('تولد شمسی');
  }finally{await context.close();}
});

test('copy link uses the browser clipboard fallback when Clipboard API is unavailable inside the modal',async({page})=>{
  await login(page);
  const url=await createLink(page);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await page.locator('[data-action=copy-invitation]').click();
  await expect(page.locator('[data-copy-status]')).toContainText('با موفقیت کپی شد');
  const destination=page.locator('#registration-link-form [name=label]');
  await destination.fill('');await destination.press('Control+V');
  await expect(destination).toHaveValue(url);
});

test('copy link reports a denied copy and keeps the full link selected for manual copying',async({page})=>{
  await login(page);const url=await createLink(page);
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Permission denied');}}});
    document.execCommand=()=>false;
  });
  await page.locator('[data-action=copy-invitation]').click();
  await expect(page.locator('[data-copy-status]')).toContainText('کپی خودکار ممکن نشد');
  await expect(page.locator('[data-action=copy-invitation]')).toHaveText('کپی لینک');
  expect(await page.locator('#invitation-url').evaluate(field=>field.value.slice(field.selectionStart,field.selectionEnd))).toBe(url);
});
