import {numberLocale} from './i18n.js';
import {lt,t as uiText} from './i18n.js';
import {GAMES,GAME_MAP,LEVELS} from './config.js';
import {TIMING_FIELDS,timingFields} from './game-timing.js';
import {profileFamilies,profileSettingKey} from './training-profiles.js';
import {variantLabel} from './client-ui.js';
import {escapeHTML as esc} from './core/clients.js';

export function gameSettingsView(){
 return lt`<div class="dashboard-heading"><div><span class="section-kicker">مدیریت تمرین</span><h1>تنظیمات بازی‌ها</h1><p>سطح و زمان‌بندی هفت بازی را در پروفایل‌های تمرین تنظیم کنید.</p></div><button class="button subtle" data-action="admin-users">تنظیم تمرین کاربران</button></div>${trainingProfilesShell()}<div id="account-status" class="status-message" role="status" hidden></div>`;
}

export function trainingProfilesShell(){
 return uiText('<section class="surface training-profiles" id="training-profiles"><h2>پروفایل‌های تمرین</h2><p>تنظیمات دلخواه هفت بازی را با یک نام ذخیره کنید و برای کاربران انتخاب کنید. نام گروه سنی در عنوان پروفایل به انتخاب شما کمک می‌کند.</p><div id="training-profile-list"><p>در حال دریافت پروفایل‌ها…</p></div><p class="form-error" id="training-profile-list-error" role="alert"></p><button type="button" class="text-button" data-action="reload-training-profiles">به‌روزرسانی فهرست</button><div id="training-profile-editor"></div></section>');
}
export function trainingProfilesList(profiles){
 return lt`<div class="profile-template-row"><label>ساخت بر اساس<select id="training-profile-template">${profiles.filter(profile=>!profile.archived).map(profile=>`<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join('')}</select></label><button class="button primary" type="button" data-action="new-training-profile">ساخت پروفایل جدید</button></div><div class="training-profile-grid">${profiles.map(profile=>lt`<article class="training-profile-card ${profile.archived?'archived':''}" data-training-profile="${esc(profile.id)}"><h3>${esc(profile.name)}${profile.archived?uiText(' <small>بایگانی‌شده</small>'):''}</h3><p>${esc(profile.description||uiText('پروفایل سفارشی برای هفت بازی'))}</p><div class="report-actions"><button type="button" class="button subtle" data-action="edit-training-profile" data-id="${esc(profile.id)}">${profile.archived?uiText('مشاهده'):uiText('ویرایش')}</button><button type="button" class="text-button" data-action="copy-training-profile" data-id="${esc(profile.id)}">ساخت کپی</button>${profile.builtin?'':`<button type="button" class="text-button ${profile.archived?'':'danger'}" data-action="archive-training-profile" data-id="${esc(profile.id)}" data-revision="${profile.revision}" data-archived="${!profile.archived}">${profile.archived?uiText('بازگردانی'):uiText('بایگانی')}</button>`}</div></article>`).join('')}</div>`;
}
export function trainingProfileEditor(profile,{creating=false}={}){
 const readonly=profile.archived&&!creating,builtin=profile.builtin&&!creating;
 return lt`<form id="training-profile-form" class="profile-form training-profile-editor" data-profile="${creating?'':esc(profile.id)}" data-revision="${creating?0:profile.revision}" data-user="${creating?'new':esc(profile.id)}"><h3 class="wide">${creating?uiText('ساخت پروفایل تمرین'):lt`تنظیمات ${esc(profile.name)}`}</h3><label class="wide">نام پروفایل<input name="name" value="${creating?'':esc(profile.name)}" required minlength="2" maxlength="120" placeholder="مثلاً تمرین کودکان تا ۶ سال" ${builtin||readonly?'readonly':''}></label><label class="wide">توضیح اختیاری<textarea name="description" rows="2" maxlength="500" ${builtin||readonly?'readonly':''}>${esc(profile.description||'')}</textarea></label><p class="wide creation-help">برای هر بازی و حالت، سطح و زمان‌ها را جدا تنظیم کنید. سطح پایه تعداد گزینه‌ها و قواعد بازی را مشخص می‌کند. این تغییرات از جلسهٔ بعد برای همهٔ کاربرانی اعمال می‌شود که از این پروفایل استفاده می‌کنند.</p>${GAMES.map((game,index)=>`<details class="wide profile-game-settings" ${index===0?'open':''}><summary>${game.title}</summary>${profile.settings.filter(entry=>entry.gameId===game.id).map(entry=>{
  const key=profileSettingKey(entry);
  return lt`<fieldset class="profile-entry" data-profile-entry="${key}" data-game="${entry.gameId}" data-variant="${entry.variant}" data-protocol="${entry.protocolVersion}" ${readonly?'disabled':''}><legend>${variantLabel(entry.variant)}</legend><label>سطح پایه<select name="${key}:level" ${builtin?'disabled':''}>${Object.entries(LEVELS).map(([id,level])=>`<option value="${id}" ${entry.level===id?'selected':''}>${level.label}</option>`).join('')}</select></label>${profileFamilies(entry.gameId).map(family=>`<div class="profile-family"><h4>${family==='moving'?uiText('محرک متحرک'):family==='static'?uiText('محرک ثابت'):uiText('زمان‌بندی')}</h4><div class="profile-form">${timingFields(entry.gameId).map(field=>lt`<label>${TIMING_FIELDS[field].label} (ثانیه)<input type="number" inputmode="decimal" name="${key}:${family}:${field}" value="${entry.timings[family][field]/1000}" min="${TIMING_FIELDS[field].min/1000}" max="${TIMING_FIELDS[field].max/1000}" step="0.05" required dir="ltr"></label>`).join('')}</div></div>`).join('')}</fieldset>`;
 }).join('')}</details>`).join('')}<p class="form-error wide" id="training-profile-error" role="alert"></p><div class="wide report-actions">${readonly?'':`<button type="submit" class="button primary">${creating?uiText('ساخت پروفایل'):uiText('ذخیرهٔ پروفایل')}</button>`}<button type="button" class="button subtle" data-action="close-training-profile">بستن ویرایشگر</button></div></form>`;
}
export function profileAssignmentOptions(profiles,selected=null){
 const custom=profiles.filter(profile=>!profile.builtin&&(!profile.archived||profile.id===selected?.id));
 if(selected&&!custom.some(profile=>profile.id===selected.id))custom.push(selected);
 return Object.entries(LEVELS).map(([id,level])=>`<option value="${id}">${level.label}</option>`).join('')+custom.map(profile=>`<option value="profile:${esc(profile.id)}">${esc(profile.name)}${profile.archived?uiText(' (بایگانی‌شده)'):''}</option>`).join('');
}
export function profileAssignmentSummary(setting,timings){
 if(setting?.trainingProfile){const entry=timings?.levels?.find(row=>row.level===setting.level);return lt`پروفایل «${esc(setting.trainingProfile.name)}» · سطح پایهٔ ${LEVELS[setting.level].label} · ثابت${entry?`<br>${timingFields(setting.gameId).map(field=>lt`${TIMING_FIELDS[field].label}: ${(entry.timing[field]/1000).toLocaleString(numberLocale())} ثانیه`).join(' · ')}`:''}`;}
 const legacy=timings?.levels?.some(row=>row.source==='child');return legacy?uiText('این کاربر هنوز از زمان‌بندی اختصاصی قبلی استفاده می‌کند. اگر سطح یا پروفایل تازه‌ای انتخاب و ذخیره کنید، همان جایگزین می‌شود.'):uiText('یک سطح پیش‌فرض یا پروفایل تمرین انتخاب کنید.');
}
