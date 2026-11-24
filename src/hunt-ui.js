import {numberLocale} from './i18n.js';
import {lt,t as uiText} from './i18n.js';
import {icon,symbol,huntBackground} from './visuals.js';
import {describeStimulus} from './stimuli.js';
import {escapeHTML as esc} from './core/clients.js';
import {HUNT_TITLES,huntBinoculars} from './hunt-art.js';
import {HUNT_SETTINGS,LEGACY_HUNT_SETTINGS} from './config.js';

const fa=value=>Number(value).toLocaleString(numberLocale());
const rows=settings=>Object.fromEntries(Object.entries(settings).map(([level,setting])=>[level,[...new Set(setting.positions.map(position=>position.y))].sort((a,b)=>a-b)]));
const modernRows=rows(HUNT_SETTINGS),legacyRows=rows(LEGACY_HUNT_SETTINGS);
// Keep neighboring hit areas separate when a short field compresses the rows.
// Horizontal travel, visibility and the canonical scored path remain unchanged.
export function huntDisplayPosition(session,choice,position,height,size){
 if(!(height>0&&size>0))return position;
 const bands=((session.stimulusVersion??9)>=6?modernRows:legacyRows)[session.level||'easy'];
 const row=bands.reduce((best,y,i)=>Math.abs(y-choice.position.y)<Math.abs(bands[best]-choice.position.y)?i:best,0);
 const start=row?(bands[row-1]+bands[row])/2:0,end=row+1<bands.length?(bands[row]+bands[row+1])/2:100;
 const minimum=height*start/100+size/2+1,maximum=height*end/100-size/2-1;
 const center=minimum<=maximum?Math.max(minimum,Math.min(maximum,position.y*height/100)):height*(start+end)/200;
 return {...position,y:center/height*100};
}
export function huntTargetCue(session){
 return lt`<span class="target-examples">${session.targets.map(target=>`<span class="target-mini">${symbol(target)}</span>`).join('')}</span><span class="hunt-target-copy"><b>${session.targets.length===2?uiText('هر دو نمونه هدف‌اند'):uiText('فقط مثل این نمونه')}</b><small>رنگ و علامت را دقیق ببین</small><span class="sr-only">${session.targets.map(describeStimulus).join(uiText(' یا '))}</span></span>`;
}
export function huntTrail(session){
 return lt`<div class="hunt-blocks hunt-trail" aria-label="دوره‌های توجه پیوسته">${session.blockLengths.map((length,i)=>lt`<span class="${i<session.current.phase?'block-done':i===session.current.phase?'block-active':''}" ${i===session.current.phase?'aria-current="step"':''}><i>${icon(i<session.current.phase?'check':'eye')}</i><b>${fa(length*session.intervalMs/1000)}</b><small>ثانیه</small></span>`).join('')}</div>`;
}
export function huntScene(session,backdrop='',atmosphere=''){
 return `<div class="reaction-stage hunt-stage hunt-world ${session.moving?'moving-hunt':''} ${session.level}" data-habitat="${session.theme}"><div class="hunt-field-heading"><span>${icon('eye')}<b>${HUNT_TITLES[session.theme]||HUNT_TITLES.star}</b></span><small>${session.moving?uiText('تا از صحنه نرفته، پیدایش کن'):uiText('فقط نمونهٔ دقیق را پیدا کن')}</small></div>${huntTrail(session)}<div class="hunt-surface" data-habitat="${session.theme}">${backdrop||huntBackground(session.background,session.theme)}${session.level==='hard'?'':atmosphere}<div class="stimulus-shell hunt-array" style="--stimulus-size:${session.current.size}px">${session.current.choices.map((choice,i)=>`<button class="stimulus-tap hunt-choice ${session.moving?'moving-choice':''}" data-action="stimulus-response" data-trial="${session.index}" data-choice="${i}" style="left:${choice.position.x}%;top:${choice.position.y}%" aria-label="${esc(describeStimulus(choice.stimulus))}">${symbol(choice.stimulus)}</button>`).join('')}</div><span class="hunt-field-edge" aria-hidden="true"></span></div><div class="hunt-interval-track" aria-hidden="true"><span></span></div></div>`;
}
export function huntControls(session){
 return lt`<div class="hunt-response-rule"><button class="button response-button" data-action="respond" ${session.gate||session.response?'disabled':''}>${icon('tap')}<span>دیدمش!</span></button><span class="hunt-wait-reminder">${icon('wait')}<b>نمونه نبود؟ صبر کن</b></span></div><span class="keyboard-hint">کلیدهای جهت برای جابه‌جایی؛ <kbd>فاصله</kbd> برای انتخاب</span>`;
}
export function huntIntermission(session,guide){
 const phase=session.current.phase,outcomes=session.outcomes.filter(outcome=>outcome.phase===phase-1),correct=outcomes.filter(outcome=>outcome.correct).length;
 return lt`<div class="rule-transition hunt-intermission">${huntTrail(session)}<span class="section-kicker">یک نفس تازه، یک نگاه تازه</span><div class="hunt-break-art">${huntBinoculars()}</div><h2>مسیر نگاه دقیق ادامه دارد</h2><span class="checkpoint-result">${fa(correct)} تصمیم درست از ${fa(outcomes.length)} نوبت قبلی</span><div class="hunt-break-targets">${huntTargetCue(session)}</div><span class="hunt-next-duration">${icon('clock')}این بار ${fa(session.blockLengths[phase]*session.intervalMs/1000)} ثانیه</span>${guide}<small>${icon('pause')}زمان متوقف است؛ نمونه‌ها همان‌اند</small><button class="button primary" data-action="acknowledge">آماده‌ام؛ بریم ادامه ${icon('play')}</button></div>`;
}
export function syncHuntStage(panel,session){
 const fill=panel.querySelector('.hunt-interval-track>span');if(fill)fill.style.width=`${100*(1-Math.max(0,Math.min(1,(session.clock.elapsed-session.onset)/session.intervalMs)))}%`;
 if(!session.moving)panel.querySelectorAll('.hunt-choice').forEach(node=>node.disabled=!session.visible||!!session.response);
}
