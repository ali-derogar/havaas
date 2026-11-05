import {icon,symbol,huntBackground} from './visuals.js';
import {describeStimulus} from './stimuli.js';
import {escapeHTML as esc} from './core/clients.js';
import {HUNT_TITLES,huntBinoculars} from './hunt-art.js';

const fa=value=>Number(value).toLocaleString('fa-IR');
export function huntTargetCue(session){
 return `<span class="target-examples">${session.targets.map(target=>`<span class="target-mini">${symbol(target)}</span>`).join('')}</span><span class="hunt-target-copy"><b>${session.targets.length===2?'هر دو نمونه هدف‌اند':'فقط مثل این نمونه'}</b><small>رنگ و علامت را دقیق ببین</small><span class="sr-only">${session.targets.map(describeStimulus).join(' یا ')}</span></span>`;
}
export function huntTrail(session){
 return `<div class="hunt-blocks hunt-trail" aria-label="دوره‌های توجه پیوسته">${session.blockLengths.map((length,i)=>`<span class="${i<session.current.phase?'block-done':i===session.current.phase?'block-active':''}" ${i===session.current.phase?'aria-current="step"':''}><i>${icon(i<session.current.phase?'check':'eye')}</i><b>${fa(length*session.intervalMs/1000)}</b><small>ثانیه</small></span>`).join('')}</div>`;
}
export function huntScene(session,backdrop='',atmosphere=''){
 return `<div class="reaction-stage hunt-stage hunt-world ${session.moving?'moving-hunt':''} ${session.level}" data-habitat="${session.theme}"><div class="hunt-field-heading"><span>${icon('eye')}<b>${HUNT_TITLES[session.theme]||HUNT_TITLES.star}</b></span><small>${session.moving?'تا از صحنه نرفته، پیدایش کن':'فقط نمونهٔ دقیق را پیدا کن'}</small></div>${huntTrail(session)}<div class="hunt-surface" data-habitat="${session.theme}">${backdrop||huntBackground(session.background,session.theme)}${session.level==='hard'?'':atmosphere}<div class="stimulus-shell hunt-array" style="--stimulus-size:${session.current.size}px">${session.current.choices.map((choice,i)=>`<button class="stimulus-tap hunt-choice ${session.moving?'moving-choice':''}" data-action="stimulus-response" data-trial="${session.index}" data-choice="${i}" style="left:${choice.position.x}%;top:${choice.position.y}%" aria-label="${esc(describeStimulus(choice.stimulus))}">${symbol(choice.stimulus)}</button>`).join('')}</div><span class="hunt-field-edge" aria-hidden="true"></span></div><div class="hunt-interval-track" aria-hidden="true"><span></span></div></div>`;
}
export function huntControls(session){
 return `<div class="hunt-response-rule"><button class="button response-button" data-action="respond" ${session.gate||session.response?'disabled':''}>${icon('tap')}<span>دیدمش!</span></button><span class="hunt-wait-reminder">${icon('wait')}<b>نمونه نبود؟ صبر کن</b></span></div><span class="keyboard-hint">کلیدهای جهت برای جابه‌جایی؛ <kbd>فاصله</kbd> برای انتخاب</span>`;
}
export function huntIntermission(session,guide){
 const phase=session.current.phase,outcomes=session.outcomes.filter(outcome=>outcome.phase===phase-1),correct=outcomes.filter(outcome=>outcome.correct).length;
 return `<div class="rule-transition hunt-intermission">${huntTrail(session)}<span class="section-kicker">یک نفس تازه، یک نگاه تازه</span><div class="hunt-break-art">${huntBinoculars()}</div><h2>مسیر نگاه دقیق ادامه دارد</h2><span class="checkpoint-result">${fa(correct)} تصمیم درست از ${fa(outcomes.length)} نوبت قبلی</span><div class="hunt-break-targets">${huntTargetCue(session)}</div><span class="hunt-next-duration">${icon('clock')}این بار ${fa(session.blockLengths[phase]*session.intervalMs/1000)} ثانیه</span>${guide}<small>${icon('pause')}زمان متوقف است؛ نمونه‌ها همان‌اند</small><button class="button primary" data-action="acknowledge">آماده‌ام؛ بریم ادامه ${icon('play')}</button></div>`;
}
export function syncHuntStage(panel,session){
 const fill=panel.querySelector('.hunt-interval-track>span');if(fill)fill.style.width=`${100*(1-Math.max(0,Math.min(1,(session.clock.elapsed-session.onset)/session.intervalMs)))}%`;
 if(!session.moving)panel.querySelectorAll('.hunt-choice').forEach(node=>node.disabled=!session.visible||!!session.response);
}
