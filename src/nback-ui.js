import {icon,symbol} from './visuals.js';

const fa=value=>Number(value).toLocaleString('fa-IR');

export function memoryExample(values,n){
 return `<div class="memory-example"><span class="memory-example-distance">${icon('memory')}مقایسه با ${fa(n)} گام قبل</span><div class="memory-sequence" dir="ltr">${values.map((value,i)=>`<span class="memory-token ${i===0?'reference':i===n?'current':''}">${symbol(value)}<small>${i===0?fa(n)+' گام قبل':i===n?'الان':fa(n-i)+' گام قبل'}</small></span>${i<values.length-1?'<span class="sequence-arrow" aria-hidden="true">→</span>':''}`).join('')}</div></div>`;
}

export function memoryRule(session){
 return `<span class="memory-rule-distance">${icon('memory')}<b>${fa(session.n)}</b><small>گام قبل</small></span><span class="memory-rule-copy">${session.current.scored===false?'اول فقط <b>به خاطر بسپار</b>':'مثل <b>همان گام</b> بود؟ بزن'}</span>`;
}

export function memoryStage(session,backdrop=''){
 const warming=session.current.scored===false;
 // The sealed trail describes only N and warm-up progress, never trial.history.
 const trail=Array.from({length:session.n},(_,i)=>{
  const distance=session.n-i,remembered=session.index>=distance;
  return `<span class="memory-sealed-slot ${distance===session.n?'comparison-slot':''} ${remembered?'remembered':''}"><i>${icon('memory')}</i><b>${fa(distance)}</b><small>گام قبل</small></span>`;
 }).join('');
 return `<div class="reaction-stage memory-stage" data-memory-phase="${warming?'remember':'compare'}">${backdrop}<div class="memory-station-heading"><span>${icon('memory')}<b>ایستگاه حافظه</b></span><small>${warming?'فقط حفظ کن':'از حافظه مقایسه کن'}</small></div><div class="memory-console"><div class="memory-trail"><div class="memory-status" dir="ltr" aria-label="${fa(session.n)} گام قبل، فقط در حافظه">${trail}</div><span class="memory-trail-caption">${icon('memory')}قبلی‌ها پنهان‌اند</span></div><span class="memory-connection" aria-hidden="true"><i></i><b>←</b></span><div class="memory-present"><span class="memory-now-label">${warming?'به خاطر بسپار':'الان'}</span><div class="memory-focus-frame"><svg class="memory-interval-ring" viewBox="0 0 240 240" fill="none" aria-hidden="true"><rect x="7" y="7" width="226" height="226" rx="47" stroke="#e4d9f3" stroke-width="4"/><rect class="memory-interval-arc" x="7" y="7" width="226" height="226" rx="47" stroke="#af8cde" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/></svg><div class="focus-corners"><div class="stimulus-shell"><button class="stimulus-tap memory-stimulus" data-action="stimulus-response" data-trial="${session.index}" ${warming?'disabled':''} aria-label="پاسخ به محرک فعلی">${symbol(session.current.stimulus)}</button></div></div></div><span class="memory-stage-note">${warming?'این نوبت فقط ببین و حفظ کن':'مثل '+fa(session.n)+' گام قبل بود؟ بزن'}</span></div></div><div class="memory-station-footer"><span>${icon('eye')}ببین</span><i aria-hidden="true">←</i><span>${icon('memory')}یادت بماند</span><i aria-hidden="true">←</i><span>${icon('tap')}مقایسه کن</span></div></div>`;
}

export function memoryControls(session){
 const warming=session.current.scored===false;
 return `<div class="memory-response-rule"><button class="button response-button" data-action="respond" ${session.gate||session.response||warming?'disabled':''}>${icon('tap')}<span>مثل ${fa(session.n)} تا قبله!</span><span class="sr-only">فقط اگر با ${fa(session.n)} محرک قبل یکسان است پاسخ بده</span></button><span class="memory-wait-reminder">${icon('wait')}<b>فرق داشت؟ صبر کن</b></span></div><span class="keyboard-hint">${warming?'فعلاً فقط حفظ کن':'یا کلید <kbd>فاصله</kbd> روی کیبورد'}</span>`;
}

export function syncMemoryStage(panel,session){
 const stage=panel.querySelector('.memory-stage');if(!stage)return;
 const ratio=Math.max(0,Math.min(1,(session.clock.elapsed-session.onset)/session.intervalMs));
 stage.querySelector('.memory-interval-arc')?.setAttribute('stroke-dashoffset',String(100*ratio));
 stage.dataset.exposure=session.visible?'shown':'hidden';
 const button=stage.querySelector('.memory-stimulus');
 if(button)button.disabled=session.current.scored===false||session.paused||session.gate||!session.visible||!!session.response;
}
