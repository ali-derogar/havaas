import { gameArtwork } from './worlds.js';
import { icon, art, symbol, equipment, needArt } from './visuals.js';
import { escapeHTML as esc } from './core/clients.js';
import { describeStimulus } from './stimuli.js';
import { LEVELS } from './config.js';
import { createLesson } from './lessons.js';
import { STROOP_RULES } from './games/stroop.js';
import { EQUIPMENT_NEEDS, EQUIPMENT_REASONS } from './games/adventure.js';
import { guidanceKey } from './guidance.js';
import { stroopRulePicture } from './learning-ui.js';

const fa = value => Number(value).toLocaleString('fa-IR');
const tokens = values => values.map(value=>`<span class="ready-token">${symbol(value)}</span>`).join('');
export const guideControl = key => `<button type="button" class="guide-audio-button" data-action="listen-guide" data-guide="${key}" aria-label="پخش راهنمای صوتی فارسی" aria-pressed="false">${icon('sound')}<span>بشنو</span></button><span class="audio-guide-status sr-only" role="status"></span>`;
export function trafficRulePicture(signs=false) {
  return `<div class="traffic-rule-picture" aria-label="${signs?'فلش آبی':'چراغ سبز'}: حرکت؛ ${signs?'ورود ممنوع':'چراغ قرمز'}: صبر"><span class="traffic-go">${symbol({shape:signs?'oneway':'circle',color:'green'})}${icon('tap')}<b>حرکت</b></span><span class="traffic-wait">${symbol({shape:signs?'noentry':'circle',color:'red'})}${icon('wait')}<b>صبر</b></span><span class="sr-only">${signs?'تابلوی یک‌طرفه یعنی حرکت؛ ورود ممنوع یعنی صبر.':'چراغ سبز یعنی حرکت؛ چراغ قرمز یعنی صبر.'}</span></div>`;
}

export function missionInventory(session) {
  return `<div class="inventory"><span>${icon('bag')} کولهٔ تو <b>${fa(session.metrics.hits)} از ${fa(session.required.length)}</b></span><div>${session.required.map(([name])=>{
    const item=session.items.find(item=>item.icon===name&&item.collected);
    return `<span class="inventory-slot ${item?'filled':''}" data-equipment="${name}" role="img" aria-label="${item?`${item.name}، آماده شد`:`${EQUIPMENT_NEEDS[name]}، هنوز آماده نشده`}">${item?equipment(name):needArt(name)}${item?icon('check'):''}</span>`;
  }).join('')}</div></div>`;
}

export function stroopScorecard(session) {
  if(session.gameId!=='stroop')return '';
  return `<div class="stroop-scorecard" aria-label="نتیجهٔ هر قانون"><h2>هر قانون چطور پیش رفت؟</h2><div>${STROOP_RULES.map((rule,phase)=>{
    const outcomes=session.outcomes.filter(outcome=>outcome.phase===phase);
    const correct=outcomes.filter(outcome=>outcome.correct).length;
    return `<div class="rule-score" data-rule-phase="${phase}">${stroopRulePicture(phase)}<b>${fa(correct)} از ${fa(outcomes.length)}</b><span>تصمیم درست</span><meter min="0" max="${outcomes.length||1}" value="${correct}" aria-label="${rule.title}: ${fa(correct)} تصمیم درست از ${fa(outcomes.length)}"></meter></div>`;
  }).join('')}</div></div>`;
}
export function shortPrompt(session){
  if(session.gameId==='hunt')return session.targets?.length===2?'هر دو نمونه را پیدا کن و بزن':'مثل نمونه را پیدا کن و بزن';
  if(session.gameId==='traffic')return session.variant==='signs'?'فلش آبی: بزن؛ قرمز: صبر':'سبز: بزن؛ قرمز: صبر';
  if(session.gameId==='search')return session.targetCount===2?'هر دو را حفظ کن، هر دو را پیدا کن':'نگاه کن، حفظ کن، پیدا کن';
  if(session.gameId==='nback')return `مثل ${fa(session.n)} شکل قبل بود؟ بزن`;
  if(session.gameId==='stroop')return STROOP_RULES[session.current?.phase||0].title;
  return 'وسایل لازم را بردار، راهی شو';
}
export function missionChecklist(session,{interactive=false}={}) {
  return `<div class="mission-checklist" aria-label="نیازهای این سفر">${session.required.map(([name],i)=>{
    const packed=session.items.some(item=>item.icon===name&&item.collected);
    const content=`<span class="need-symbol">${needArt(name)}</span><span class="need-copy">${EQUIPMENT_NEEDS[name]}</span><b class="need-state">${packed?icon('check'):fa(i+1)}</b>`;
    return interactive?`<button type="button" class="mission-need need-audio ${packed?'packed':''}" data-action="listen-guide" data-guide="${name}" aria-pressed="false" aria-label="شنیدن نیاز: ${EQUIPMENT_NEEDS[name]}">${content}${icon('sound')}</button>`:`<span class="mission-need ${packed?'packed':''}" role="img" aria-label="${EQUIPMENT_NEEDS[name]}${packed?'، آماده شد':''}">${content}</span>`;
  }).join('')}</div>`;
}
export function preparationView(session) {
  const {gameId:id}=session; let title, text, sample, tip;
  if(id==='hunt') {
    title=session.targets.length===2?'هر دو هدف را بشناس':'هدف تو را بشناس';
    text=`فقط ${session.targets.map(describeStimulus).join(' یا ')} هدف است. شکل‌های هم‌رنگ با علامت اضافه، هدف نیستند.`;
    sample=tokens(session.targets);tip='وقتی هدف را دیدی، روی خودش یا دکمهٔ پاسخ بزن. اگر هدف نبود، صبر کن.';
  } else if(id==='traffic') {
    const signs=session.variant==='signs';title=signs?'با نشانهٔ درست حرکت کن':'سبز یعنی حرکت، قرمز یعنی صبر';
    text='برای نشانهٔ حرکت، دکمهٔ «حرکت!» را بزن؛ برای نشانهٔ توقف، هیچ دکمه‌ای نزن.';
    sample=`<div class="ready-example">${symbol({shape:signs?'oneway':'circle',color:'green'})}<span>حرکت کن</span></div><div class="ready-example">${symbol({shape:signs?'noentry':'circle',color:'red'})}<span>صبر کن</span></div>`;
    tip='نشانه کوتاه دیده می‌شود، اما تا شروع نوبت بعد برای پاسخ فرصت داری.';
  } else if(id==='nback') {
    title=`مقایسه با ${fa(session.n)} محرک قبل`;
    text=`اول ${fa(session.n)} محرک را فقط به خاطر بسپار. بعد، هر محرک جدید را با دقیقاً ${fa(session.n)} محرک قبل مقایسه کن؛ اگر یکسان بودند پاسخ بده.`;
    const lesson=createLesson(id,{level:session.level,material:session.material})[0];
    sample=`<div class="memory-sequence" dir="ltr">${lesson.stimuli.map((value,i)=>`<span class="memory-token ${i===0?'reference':''}">${symbol(value)}<small>${i===0?'مرجع':i===lesson.stimuli.length-1?'فعلی':fa(i+1)}</small></span>`).join('<span class="sequence-arrow" aria-hidden="true">→</span>')}</div>`;
    tip='این فقط یک نمونه است. در بازی، محرک‌های قبلی پنهان می‌شوند؛ آن‌ها را در حافظه نگه دار.';
  } else if(id==='stroop') {
    title='چهار مرحله، چهار قانون';text='در شروع فقط به دایرهٔ زرد پاسخ بده. بین مرحله‌ها، بازی می‌ایستد تا قانون بعدی را یاد بگیری.';
    sample=stroopRulePicture(0);tip='در بعضی مرحله‌ها رنگ نوشته مهم است و در بعضی، معنای کلمه. قانون بالای صفحه را دنبال کن.';
  } else if(id==='search') {
    title=session.targetCount===2?'دو نمونه را حفظ کن، هر دو را پیدا کن':'نمونه را حفظ کن، پیدایش کن';
    text=`در هر دور، ${session.targetCount===2?'هر دو نمونه':'نمونه'} فقط دو ثانیه دیده می‌شود. بعد از پنهان‌شدن، ${session.targetCount===2?'هر دو را':'آن را'} میان گزینه‌ها پیدا کن.`;
    // Illustrations here never reveal the actual first-round sample.
    sample=gameArtwork(id);tip=`رنگ، شکل و ${session.material==='letters'?'خط کوچک کنار حرف':'علامت داخل شکل'} را به خاطر بسپار. ${fa(LEVELS[session.level].searchSeconds)} ثانیه برای جست‌وجوی هر دور فرصت داری.`;
  } else {
    title=session.mission.title;text=session.mission.story;sample=gameArtwork(id);
    tip=session.practice?'پنج وسیله را یکی‌یکی بررسی کن؛ وسیلهٔ ضروری را بردار و برای بقیه «دست نگه دار» را بزن.':`نیازهای این سفر را برطرف کن و قبل از پایان زمان ${id==='space'?'سفینه را پرتاب کن. مانع‌ها را اول کنار بزن.':'سوار کشتی شو.'}`;
  }
  const key=guidanceKey({...session,targetCount:session.targets?.length||session.targetCount});
  return `<div class="game-preparation"><span class="section-kicker">اول آماده شو</span><h2>${shortPrompt(session)}</h2><div class="preparation-samples">${sample}</div><div class="visual-rule"><span class="do-cue">${icon('tap')}<b>بزن</b></span><span class="wait-cue">${icon('wait')}<b>صبر کن</b></span>${guideControl(key)}</div>${['ark','space'].includes(id)?`<div class="mission-needs-heading">برای سفر چه لازم است؟ <small>روی هر تصویر بزن و بشنو</small></div>${missionChecklist(session,{interactive:true})}`:''}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p>${id==='stroop'?'<p>مرحله‌های کلمه به توانایی خواندن نیاز دارند. راهنمای صوتی قانون را توضیح می‌دهد و کلمهٔ محرک را در بازی نمی‌خواند.</p>':''}</details>${session.practice?'<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>':''}</div>`;
}
export function countdownView() {
  return '<div class="game-countdown"><span class="section-kicker">چشم‌ها به محل بازی</span><b id="countdown-number" aria-live="off">۳</b><p>آرام و آماده…</p></div>';
}
export function reviewView(session) {
  const review=session.review;let good, text, sample, label;
  if(review.kind==='reaction') {
    const {trial,outcome}=review;good=outcome.correct;sample=tokens([trial.stimulus]);
    label=trial.target?'این محرک هدف بود':'این محرک هدف نبود';
    if(session.gameId==='hunt') {
      text=trial.target?'شکل، رنگ و علامت با یکی از هدف‌ها یکسان بود؛ باید پاسخ می‌دادی.':'این شکل با نمونهٔ هدف یکسان نبود؛ باید بدون پاسخ صبر می‌کردی.';
      sample=`<div class="review-comparison"><div><small>${outcome.response?'انتخاب تو':trial.target?'هدف این نوبت':'یکی از شکل‌های این نوبت'}</small>${tokens([outcome.selectedStimulus||trial.stimulus])}</div><div><small>نمونهٔ هدف</small>${tokens(session.targets)}</div></div>`;
    } else if(session.gameId==='traffic')text=trial.target?'این نشانه اجازهٔ حرکت می‌داد؛ باید دکمهٔ حرکت را می‌زدی.':'این نشانه توقف بود؛ درست این بود که هیچ دکمه‌ای نزنی.';
    else if(session.gameId==='nback') {
      text=trial.target?`محرک فعلی با ${fa(session.n)} محرک قبل یکسان بود؛ باید پاسخ می‌دادی.`:`محرک فعلی با ${fa(session.n)} محرک قبل فرق داشت؛ باید صبر می‌کردی.`;
      sample=`<div class="memory-sequence" dir="ltr">${[...trial.history,trial.stimulus].map((value,i)=>`<span class="memory-token ${i===0?'reference':''}">${symbol(value)}<small>${i===0?'مرجع':i===session.n?'فعلی':fa(i+1)}</small></span>`).join('<span class="sequence-arrow" aria-hidden="true">→</span>')}</div>`;
    } else text=`قانون این مرحله: ${STROOP_RULES[trial.phase].text} ${trial.target?'این محرک شرط را داشت؛ باید پاسخ می‌دادی.':'این محرک شرط را نداشت؛ باید صبر می‌کردی.'}`;
    if(outcome.response&&outcome.selectedTarget===false&&trial.target)text+=' هدف در صحنه بود، اما شکلی که انتخاب کردی مزاحم بود.';
  } else if(review.kind==='search') {
    const decisions=session.outcomes.filter(o=>o.round===session.index+1), errors=decisions.filter(o=>!o.correct).length;
    good=review.found===review.total&&!errors;label=`${fa(review.found)} از ${fa(review.total)} هدف پیدا شد`;
    text=`این ${review.total===2?'دو نمونه، هدف‌های':'نمونه، هدف'} این دور بود${review.total===2?'ند':''}. ${errors?'رنگ و علامت کوچک را دوباره بررسی کن؛ دور بعد فرصت تازه‌ای داری.':'جزئیات را درست به خاطر سپردی.'}`;
    sample=`<div class="review-targets">${tokens(review.targets)}</div>`;
  } else {
    const {item,outcome}=review;good=outcome.correct;label=item.required?'این وسیله لازم بود':'این وسیله ضروری نبود';
    sample=`<span class="review-equipment">${equipment(item.icon)}</span>`;
    text=item.required?EQUIPMENT_REASONS[item.icon]:`${item.name} برای سرگرمی یا خانه خوب است، اما نیاز ضروری این مأموریت را برطرف نمی‌کند.`;
  }
  const expected=review.kind==='reaction'?review.trial.target:review.kind==='adventure'?review.item.required:true;
  const audio=review.kind==='adventure'?(review.item.required?review.item.icon:'not-needed'):good?'correct':'retry';
  return `<div class="practice-review ${good?'good':'retry'}" role="region" aria-label="مرور تمرین"><span class="review-badge">${icon(good?'check':'repeat')} ${good?'آفرین!':'با هم یاد بگیریم'}</span><h2>${label}</h2><div class="review-samples">${sample}</div><div class="review-decision ${expected?'do-cue':'wait-cue'}">${icon(expected?'tap':'wait')}<b>${expected?'این را بزن':'دست نگه دار'}</b>${guideControl(audio)}</div><details class="companion-guide"><summary>چرا؟ راهنمای همراه</summary><p>${esc(text)}</p></details><small>زمان متوقف است</small></div>`;
}
export function transitionView(session) {
  const hunt=session.gameId==='hunt', phase=session.current.phase;
  const completed=session.outcomes.filter(o=>o.phase===phase-1),correct=completed.filter(o=>o.correct).length;
  const rule=hunt?{title:`${fa(session.blockLengths[phase]*(session.intervalMs||1000)/1000)} ثانیه توجه پیوسته`,text:'هدف‌ها همان‌اند. این بار مدت بیشتری آن‌ها را دنبال کن؛ هر وقت آماده‌ای ادامه بده.'}:STROOP_RULES[phase];
  const examples=hunt?`<div class="rule-example">${tokens(session.targets)}</div>`:`<div class="rule-examples">${createLesson('stroop').slice(phase*2,phase*2+2).map(step=>`<div class="rule-sample">${symbol(step.stimuli[0])}<b>${step.expected?'پاسخ بده':'صبر کن'}</b><small>${step.explanation}</small></div>`).join('')}</div>`;
  return `<div class="rule-transition"><span class="section-kicker">${hunt?'یک نفس تازه، یک دور تازه':'حالا قانون عوض می‌شود'}</span>${hunt?`<span class="checkpoint-result">${fa(correct)} تصمیم درست از ${fa(completed.length)} نوبت قبلی</span>`:''}<h2>${rule.title}</h2>${hunt?'':stroopRulePicture(phase)}<p>${rule.text}</p>${examples}${guideControl(guidanceKey({...session,phase,targetCount:session.targets?.length}))}<button class="button primary" data-action="acknowledge">آماده‌ام ${icon('play')}</button></div>`;
}
export function stroopStages(phase) {
  return `<div class="stroop-stages" aria-label="مرحله‌های استروپ">${['دایره','رنگ نوشته','معنای کلمه','رنگ و معنا'].map((label,i)=>`<span ${i===phase?'aria-current="step"':''} class="${i<phase?'passed':''}"><b>${fa(i+1)}</b>${label}</span>`).join('')}</div>`;
}
export function trafficProgress(session){
  const pending=session.response?.selectedTarget===true&&!session.review?1:0;
  return Math.min(1,Math.max(0,(session.metrics.hits+pending)/session.maxScore));
}
export function trafficRoad(session) {
  const progress=session?trafficProgress(session):0;
  return `<svg class="traffic-road" viewBox="0 0 620 110" data-progress="${progress}" aria-label="مسیر ماشین تا پرچم مقصد"><rect y="29" width="620" height="66" rx="12" fill="#516f87"/><path d="M20 62h580" stroke="#f8faf1" stroke-width="3" stroke-dasharray="24 18"/><g class="road-destination ${progress===1?'arrived':''}"><path d="M565 12v72" stroke="#273d56" stroke-width="4"/><path d="M567 12h32v25h-32z" fill="#ffe353"/><path d="M568 13h9v8h-9zm18 0h9v8h-9zm-9 8h9v8h-9zm-9 8h9v8h-9zm18 0h9v8h-9z" fill="#334d63"/></g><g class="road-car" transform="translate(${375*progress} 0)" stroke="#233c54" stroke-width="2"><g class="car-chassis"><path d="m55 50 16-18h40l20 18 13 5v25H43V58z" fill="#10b8ec"/><path d="m75 37-10 13h53l-12-13z" fill="#dcf9ff"/><path d="M135 58h7m-96 0h7" stroke="#fff5a0" stroke-width="4"/></g>${[64,123].map(x=>`<g class="car-wheel"><circle cx="${x}" cy="79" r="10" fill="#243e55"/><circle cx="${x}" cy="79" r="4" fill="#fff"/><path d="M${x-7} 79h14m-7-7v14" stroke="#a8d7ec" stroke-width="2"/></g>`).join('')}</g></svg>`;
}

export function searchTargetStatus(session) {
  return `<div class="search-target-status" aria-label="هدف‌های پیدا‌شدهٔ این دور">${session.current.targets.map((_target,i)=>{
    const found=[...session.found].map(index=>session.current.choices[index]).find(choice=>choice.targetIndex===i);
    return `<span class="target-status ${found?'discovered':''}">${found?symbol(found):'<b aria-hidden="true">؟</b>'}<small>${found?'پیدا شد':`هدف ${fa(i+1)}`}</small>${found?icon('check'):''}</span>`;
  }).join('')}</div>`;
}
export function searchRounds(session) {
  return `<div class="search-rounds" aria-label="مسیر دورهای جست‌وجو">${Array.from({length:session.total},(_,i)=>{
    const outcomes=session.outcomes.filter(o=>o.round===i+1),complete=i<session.index,success=complete&&outcomes.filter(o=>o.target&&o.response).length===session.targetCount;
    return `<span class="${complete?success?'round-done':'round-retry':i===session.index?'round-current':''}" ${i===session.index?'aria-current="step"':''} aria-label="دور ${fa(i+1)}${complete?success?'، پیدا شد':'، فرصت بعدی':''}">${complete&&success?icon('check'):fa(i+1)}</span>`;
  }).join('')}</div>`;
}
export function huntBlocks(session) {
  return `<div class="hunt-blocks" aria-label="مدت دوره‌های توجه پیوسته">${session.blockLengths.map((length,i)=>`<span class="${i<session.current.phase?'block-done':i===session.current.phase?'block-active':''}" ${i===session.current.phase?'aria-current="step"':''}><b>${fa(length*(session.intervalMs||1000)/1000)}</b> ثانیه</span>`).join('')}</div>`;
}
export function learningRecap(session) {
  const mistakes=session.outcomes.map((outcome,i)=>({outcome,i})).filter(({outcome})=>!outcome.correct);
  if(!mistakes.length)return '';
  const scored=session.trials?.filter(trial=>trial.scored!==false);
  const examples=mistakes.filter((entry,i)=>session.gameId!=='search'||!mistakes.slice(0,i).some(previous=>previous.outcome.round===entry.outcome.round)).slice(0,4);
  const cards=examples.map(({outcome,i})=>{
    let review,index=session.index;
    if(scored)review={kind:'reaction',trial:scored[i],outcome};
    else if(session.gameId==='search'){
      index=outcome.round-1;
      review={kind:'search',targets:session.roundTargets[index],found:session.outcomes.filter(o=>o.round===outcome.round&&o.target&&o.response).length,total:session.targetCount};
    }else review={kind:'adventure',item:session.items.find(item=>item.id===outcome.itemId),outcome};
    return `<article class="recap-step"><span class="section-kicker">${outcome.round?`دور ${fa(outcome.round)}`:`تصمیم ${fa(i+1)}`}</span>${reviewView({...session,index,review})}</article>`;
  });

  return `<details class="result-learning"><summary>${icon('info')} با هم مرور کنیم <span>${fa(mistakes.length)} تصمیم برای تمرین</span>${icon('chevron')}</summary><div class="recap-intro">بازی پایان یافته است؛ این مرور امتیاز را تغییر نمی‌دهد. برای نوبت بعد، به این نکته‌ها توجه کن.</div><div class="recap-steps">${cards.join('')}</div>${mistakes.length>4?'<p class="recap-more">چند نمونه برای مرور نشان داده شده است. می‌توانی از راهنمای بازی، نمونه‌های بدون زمان را دوباره تمرین کنی.</p>':''}</details>`;
}

export function roundBreakView(session) {
  const {round,found,total}=session.roundBreak,complete=found===total;
  return `<div class="round-intermission"><span class="section-kicker">دور ${fa(round)} از ${fa(session.total)} تمام شد</span><span class="round-emblem ${complete?'complete':''}">${icon(complete?'check':'spark')}</span><h2>${complete?'هدف‌ها را پیدا کردی!':'دور بعد، یک فرصت تازه است'}</h2><p>${fa(found)} از ${fa(total)} هدف این دور پیدا شد. یک نفس تازه کن؛ هر وقت آماده‌ای، نمونهٔ دور بعد را ببین.</p>${searchRounds({...session,index:session.index+1})}<small>زمان متوقف است؛ دور بعد با درخواست تو شروع می‌شود.</small></div>`;
}
