import { icon, art, symbol, equipment } from './visuals.js';
import { escapeHTML as esc } from './core/clients.js';
import { describeStimulus } from './stimuli.js';
import { LEVELS } from './config.js';
import { createLesson } from './lessons.js';
import { STROOP_RULES } from './games/stroop.js';
import { EQUIPMENT_NEEDS, EQUIPMENT_REASONS } from './games/adventure.js';

const fa = value => Number(value).toLocaleString('fa-IR');
const tokens = values => values.map(value=>`<span class="ready-token">${symbol(value)}</span>`).join('');
export function missionChecklist(session) {
  return `<div class="mission-checklist" aria-label="نیازهای این سفر">${session.required.map(([name],i)=>{
    const packed=session.items.some(item=>item.icon===name&&item.collected);
    return `<span class="mission-need ${packed?'packed':''}"><b>${packed?icon('check'):fa(i+1)}</b><span>${EQUIPMENT_NEEDS[name]}</span></span>`;
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
    sample=tokens([{shape:'circle',color:'yellow'}]);tip='در بعضی مرحله‌ها رنگ نوشته مهم است و در بعضی، معنای کلمه. قانون بالای صفحه را دنبال کن.';
  } else if(id==='search') {
    title=session.targetCount===2?'دو نمونه را حفظ کن، هر دو را پیدا کن':'نمونه را حفظ کن، پیدایش کن';
    text=`در هر دور، ${session.targetCount===2?'هر دو نمونه':'نمونه'} فقط دو ثانیه دیده می‌شود. بعد از پنهان‌شدن، ${session.targetCount===2?'هر دو را':'آن را'} میان گزینه‌ها پیدا کن.`;
    // Illustrations here never reveal the actual first-round sample.
    sample=art(id);tip=`رنگ، شکل و ${session.material==='letters'?'خط کوچک کنار حرف':'علامت داخل شکل'} را به خاطر بسپار. ${fa(LEVELS[session.level].searchSeconds)} ثانیه برای جست‌وجوی هر دور فرصت داری.`;
  } else {
    title=session.mission.title;text=session.mission.story;sample=art(id);
    tip=session.practice?'پنج وسیله را یکی‌یکی بررسی کن؛ وسیلهٔ ضروری را بردار و برای بقیه «لازم نیست» را بزن.':`نیازهای این سفر را برطرف کن و قبل از پایان زمان ${id==='space'?'سفینه را پرتاب کن. مانع‌ها را اول کنار بزن.':'سوار کشتی شو.'}`;
  }
  return `<div class="game-preparation"><span class="section-kicker">اول آماده شو · زمان بازی هنوز شروع نشده</span><h2>${title}</h2><div class="preparation-samples">${sample}</div><p>${text}</p>${['ark','space'].includes(id)&&!session.practice?missionChecklist(session):''}<div class="preparation-tip">${icon('info')}<span>${tip}</span></div>${session.practice?'<small class="guided-note">بعد از هر تمرین، پاسخ را با هم مرور می‌کنیم. برای خواندن توضیح عجله نکن.</small>':''}</div>`;
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
  return `<div class="practice-review ${good?'good':'retry'}" role="region" aria-label="مرور تمرین"><span class="review-badge">${icon(good?'check':'info')} ${good?'تصمیم درستی گرفتی':'این بار با هم یاد بگیریم'}</span><h2>${label}</h2><div class="review-samples">${sample}</div><p>${esc(text)}</p><small>زمان متوقف است؛ وقتی آماده شدی، ادامه بده.</small></div>`;
}
export function transitionView(session) {
  const hunt=session.gameId==='hunt', phase=session.current.phase;
  const completed=session.outcomes.filter(o=>o.phase===phase-1),correct=completed.filter(o=>o.correct).length;
  const rule=hunt?{title:`${fa(session.blockLengths[phase])} ثانیه توجه پیوسته`,text:'هدف‌ها همان‌اند. این بار مدت بیشتری آن‌ها را دنبال کن؛ هر وقت آماده‌ای ادامه بده.'}:STROOP_RULES[phase];
  const examples=hunt?`<div class="rule-example">${tokens(session.targets)}</div>`:`<div class="rule-examples">${createLesson('stroop').slice(phase*2,phase*2+2).map(step=>`<div class="rule-sample">${symbol(step.stimuli[0])}<b>${step.expected?'پاسخ بده':'صبر کن'}</b><small>${step.explanation}</small></div>`).join('')}</div>`;
  return `<div class="rule-transition"><span class="section-kicker">${hunt?'یک نفس تازه، یک دور تازه':'حالا قانون عوض می‌شود'}</span>${hunt?`<span class="checkpoint-result">${fa(correct)} تصمیم درست از ${fa(completed.length)} نوبت قبلی</span>`:''}<h2>${rule.title}</h2><p>${rule.text}</p>${examples}<button class="button primary" data-action="acknowledge">فهمیدم، ادامه بدیم ${icon('arrow')}</button></div>`;
}
export function stroopStages(phase) {
  return `<div class="stroop-stages" aria-label="مرحله‌های استروپ">${['دایره','رنگ نوشته','معنای کلمه','رنگ و معنا'].map((label,i)=>`<span ${i===phase?'aria-current="step"':''} class="${i<phase?'passed':''}"><b>${fa(i+1)}</b>${label}</span>`).join('')}</div>`;
}
export function trafficRoad() {
  return `<svg class="traffic-road" viewBox="0 0 620 100" aria-hidden="true"><rect y="22" width="620" height="66" rx="16" fill="#dce2dc"/><path d="M20 55h580" stroke="#faf9f2" stroke-width="3" stroke-dasharray="24 18"/><g fill="#faf9f2">${[0,1,2,3,4].map(i=>`<rect x="${365+i*18}" y="25" width="10" height="60"/>`).join('')}</g><g class="road-car" stroke="#34443d" stroke-width="2"><path d="m90 43 16-18h40l20 18 13 5v25H78V51z" fill="#c8b9d5"/><path d="m110 30-10 13h53l-12-13z" fill="#eef2ef"/><circle cx="99" cy="72" r="10" fill="#506359"/><circle cx="158" cy="72" r="10" fill="#506359"/></g></svg>`;
}
