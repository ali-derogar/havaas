import {numberLocale} from './i18n.js';
import {lt,t as uiText} from './i18n.js';
import {symbol,icon} from './visuals.js';
import {describeStimulus} from './stimuli.js';
import {searchMemorySeal} from './search-art.js';

const fa=value=>Number(value).toLocaleString(numberLocale());

export function searchWorkspaceHeading(session){
 return lt`<div class="search-workspace-heading"><span class="search-workspace-mark">${icon('magnify')}</span><div><small>کارگاه سرنخ</small><strong>${session.preview?uiText('ببین و به خاطر بسپار'):uiText('حالا پیدایش کن')}</strong></div><span class="search-phase-label">${icon(session.preview?'eye':'tap')}${session.preview?uiText('نگاه کن'):uiText('جست‌وجو کن')}</span></div>`;
}

export function searchPreview(session){
 const dual=session.targetCount===2;
 return lt`<div class="search-preview clue-preview"><span class="section-kicker">${dual?uiText('هر دو نمونه رو یادت بمونه'):uiText('این نمونه رو یادت بمونه')}</span><div class="preview-targets">${session.current.targets.map((target,i)=>lt`<div class="preview-target"><span class="search-sample-number">هدف ${fa(i+1)}</span><div class="preview-symbol">${symbol(target)}</div><span class="preview-description sr-only">${describeStimulus(target)}</span></div>`).join('')}</div><div class="search-memory-clock"><svg viewBox="0 0 52 52" fill="none" aria-hidden="true"><circle cx="26" cy="26" r="22" stroke="#ded6ed" stroke-width="4"/><circle class="search-clock-arc" cx="26" cy="26" r="22" pathLength="100" stroke="#4abfae" stroke-width="4" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0" transform="rotate(-90 26 26)"/></svg><span class="preview-countdown" id="preview-seconds">${fa(session.timing.previewMs/1000)} ثانیه</span></div><div class="preview-timer" aria-hidden="true"><span></span></div><span class="search-preview-reminder">${icon('eye')} ${session.material==='letters'?uiText('حرف، رنگ و خط‌های کوچک'):uiText('شکل، رنگ و علامت کوچک')}</span></div>`;
}

export function searchChoices(session){
 const scattered=session.layout==='scattered';
 return lt`<div class="search-grid ${session.level} ${scattered?'scattered':''}" ${scattered?`style="--scatter-columns:${session.current.columns};--scatter-rows:${session.current.rows};--scatter-height:${session.current.rows*78}px"`:''} aria-label="گزینه‌های جست‌وجو؛ با کلیدهای جهت حرکت کن">${session.current.choices.map((choice,i)=>lt`<button type="button" class="search-choice ${session.rejected.has(i)?'rejected':''} ${session.found.has(i)?'found':''}" ${scattered?`style="left:${choice.position.x}%;top:${choice.position.y}%;--scatter-angle:${choice.angle}deg"`:''} data-action="search-choice" data-index="${i}" aria-label="گزینهٔ ${fa(i+1)}: ${describeStimulus(choice)}${session.found.has(i)?uiText('، پیدا شد'):session.rejected.has(i)?uiText('، متفاوت با نمونه'):''}" ${session.rejected.has(i)||session.found.has(i)?'disabled':''}>${symbol(choice)}${session.found.has(i)?icon('check'):session.rejected.has(i)?icon('repeat'):''}</button>`).join('')}</div>`;
}

export function searchMemoryNote(){
 return lt`<div class="search-memory-note">${searchMemorySeal()}<span>نمونه پنهان شد<small>از حافظه‌ات کمک بگیر</small></span></div>`;
}
