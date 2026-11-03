import {icon,symbol} from './visuals.js';
import {STROOP_RULES} from './games/stroop.js';

const fa=value=>Number(value).toLocaleString('fa-IR');
export function memoryLessonState(step,state={}){
  const showHistory=state.memoryHelp===true||state.answered===true;
  const index=showHistory?step.stimuli.length-1:Math.max(0,Math.min(step.stimuli.length-1,Number.isInteger(state.memoryIndex)?state.memoryIndex:0));
  return {index,ready:index===step.stimuli.length-1,showHistory};
}
export function memoryLessonView(step,state={}){
  const {index,ready,showHistory}=memoryLessonState(step,state);
  const timeline=`<div class="memory-lesson-path" dir="ltr" aria-label="ترتیب شکل‌ها">${step.stimuli.map((_value,i)=>`<span class="${i===index?'current':i<index?'seen':''}">${i<index?icon('check'):fa(i+1)}</span>${i<step.stimuli.length-1?'<i aria-hidden="true">→</i>':''}`).join('')}</div>`;
  const samples=showHistory?`<div class="lesson-stimuli sequence">${step.stimuli.map((value,i)=>`<div class="lesson-token ${i===step.reference?'reference':''} ${i===step.stimuli.length-1?'current':''}">${symbol(value)}<small>${i===step.stimuli.length-1?'فعلی':i===step.reference?'مرجع':fa(i+1)}</small></div>`).join('')}</div>`:`<div class="lesson-stimuli memory-spotlight"><div class="lesson-token current">${symbol(step.stimuli[index])}<small>${ready?'شکل فعلی':'به خاطر بسپار'}</small></div></div>`;
  return `<div class="memory-walkthrough" data-memory-step="${index}" data-memory-ready="${ready}">${timeline}${samples}<div class="memory-lesson-tools">${!ready?`<button class="button primary" data-action="lesson-memory-next">شکل بعد ${icon('arrow')}</button>`:`<button class="text-button" data-action="lesson-memory-replay">${icon('repeat')} از اول ببین</button>`}${!showHistory?`<button class="text-button" data-action="lesson-memory-help">${icon('info')} با هم ببینیم</button>`:''}</div>${ready?`<p class="memory-question">با ${fa(step.n)} شکل قبل یکی است؟</p>`:''}</div>`;
}
export function stroopRulePicture(phase=0){
  const current=Math.max(0,Math.min(3,phase)),labels=['دایره','رنگ','کلمه','رنگ + کلمه'];
  const channel=current===0?icon('target'):current===1?icon('palette'):current===2?icon('read'):`${icon('palette')}<b>+</b>${icon('read')}`;
  const target=current===0?symbol({shape:'circle',color:'yellow'}):current===1?'<span class="rule-swatch" aria-hidden="true"></span>':current===2?'<b class="rule-word">زرد</b>':'<span class="rule-swatch" aria-hidden="true"></span><b>+</b><b class="rule-word yellow">زرد</b>';
  return `<div class="stroop-rule-picture" data-rule-phase="${current}" role="img" aria-label="${STROOP_RULES[current].title}"><span class="rule-channel">${channel}<small>${labels[current]}</small></span><span class="rule-picture-arrow" aria-hidden="true">←</span><span class="rule-picture-target">${target}</span><span class="rule-picture-tap">${icon('tap')}</span></div>`;
}
