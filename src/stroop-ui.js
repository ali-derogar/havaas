import {icon,symbol} from './visuals.js';
import {stroopRulePicture} from './learning-ui.js';
import {STROOP_RULES} from './games/stroop.js';
import {createLesson} from './lessons.js';

const fa=value=>Number(value).toLocaleString('fa-IR');
const labels=['دایره','رنگ','کلمه','هر دو'];
const channels=phase=>phase===0?icon('target'):phase===1?icon('palette'):phase===2?icon('read'):`${icon('palette')}<i>+</i>${icon('read')}`;

export function stroopPhasePath(phase){
 return `<div class="stroop-stages studio-phase-path" aria-label="مرحله‌های استروپ">${labels.map((label,i)=>`<span class="${i<phase?'passed':''}" ${i===phase?'aria-current="step"':''}><i>${i<phase?icon('check'):channels(i)}</i><b>${fa(i+1)}</b><small>${label}</small></span>`).join('')}</div>`;
}

export function stroopScene(session,backdrop=''){
 const phase=session.current.phase;
 return `<div class="stroop-world">${stroopPhasePath(phase)}<div class="reaction-stage studio-stage" data-rule-phase="${phase}">${backdrop}<div class="studio-stage-heading"><span>${channels(phase)}<b>${['فقط دایرهٔ زرد','فقط رنگ نوشته','فقط خود کلمه','رنگ و کلمه با هم'][phase]}</b></span><small>قانون ${fa(phase+1)} از ۴</small></div><div class="studio-easel"><span class="studio-paper-clip" aria-hidden="true"></span><div class="focus-corners"><div class="stimulus-shell"><button class="stimulus-tap studio-stimulus" data-action="stimulus-response" data-trial="${session.index}" aria-label="پاسخ به محرک فعلی">${symbol(session.current.stimulus)}</button></div></div><div class="studio-interval-track" aria-hidden="true"><span></span></div></div><span class="studio-stage-note">${icon('eye')}به همین قانون دقت کن</span></div></div>`;
}

export function stroopControls(session){
 return `<div class="studio-response-rule"><button class="button response-button" data-action="respond" ${session.gate||session.response?'disabled':''}>${icon('tap')}<span>این هدفه!</span></button><span class="studio-wait-reminder">${icon('wait')}<b>هدف نبود؟ صبر کن</b></span></div><span class="keyboard-hint">یا کلید <kbd>فاصله</kbd> روی کیبورد</span>`;
}

export function stroopTransition(session,guide){
 const phase=session.current.phase,rule=STROOP_RULES[phase];
 return `<div class="rule-transition studio-transition">${stroopPhasePath(phase)}<span class="section-kicker">قانون تازه، یک فرصت تازه</span><h2>${rule.title}</h2>${stroopRulePicture(phase)}<div class="rule-examples">${createLesson('stroop').slice(phase*2,phase*2+2).map(step=>`<div class="rule-sample ${step.expected?'studio-do':'studio-wait'}"><div class="studio-example-symbol">${symbol(step.stimuli[0])}</div><b>${icon(step.expected?'tap':'wait')}${step.expected?'بزن':'صبر کن'}</b></div>`).join('')}</div>${guide}<details class="companion-guide"><summary>راهنمای همراه</summary><p>${rule.text}</p></details><small class="studio-time-rest">${icon('pause')}زمان متوقف است</small><button class="button primary" data-action="acknowledge">قانون رو فهمیدم؛ بزن بریم ${icon('play')}</button></div>`;
}

export function syncStroopStage(panel,session){
 const stage=panel.querySelector('.studio-stage');if(!stage)return;
 const ratio=Math.max(0,Math.min(1,(session.clock.elapsed-session.onset)/session.intervalMs));
 const fill=stage.querySelector('.studio-interval-track>span');if(fill)fill.style.width=`${100*(1-ratio)}%`;
 const button=stage.querySelector('.studio-stimulus');if(button)button.disabled=session.paused||session.gate||!session.visible||!!session.response;
}
