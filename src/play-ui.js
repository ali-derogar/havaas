import {numberLocale} from './i18n.js';
import {t as uiText,lt} from './i18n.js';
import { gameArtwork } from './worlds.js';
import { icon, art, symbol, equipment, needArt } from './visuals.js';
import { escapeHTML as esc } from './core/clients.js';
import { describeStimulus } from './stimuli.js';
import { LEVELS, RULE_NOTICE_MS } from './config.js';
import { createLesson } from './lessons.js';
import { STROOP_RULES,stroopRules } from './games/stroop.js';
import { EQUIPMENT_NEEDS, EQUIPMENT_REASONS } from './games/adventure.js';
import { guidanceKey } from './guidance.js';
import { stroopRulePicture } from './learning-ui.js';
import { arkEquipment } from './ark-ui.js';
import { spaceEquipment } from './space-ui.js';
import { trafficRoadArt } from './traffic-art.js';
import { memoryExample } from './nback-ui.js';
import {stroopPhasePath,stroopTransition} from './stroop-ui.js';
import {huntIntermission,huntTargetCue} from './hunt-ui.js';

const fa = value => Number(value).toLocaleString(numberLocale());
const tokens = values => values.map(value=>`<span class="ready-token">${symbol(value)}</span>`).join('');
export const guideControl = (key,label=uiText('بشنو')) => lt`<button type="button" class="guide-audio-button" data-action="listen-guide" data-guide="${key}" aria-label="پخش راهنمای صوتی" aria-pressed="false">${icon('sound')}<span>${label}</span></button><span class="audio-guide-status sr-only" role="status"></span>`;
export function trafficRulePicture(signs=false) {
  return lt`<div class="traffic-rule-picture" aria-label="${signs?uiText('فلش آبی'):uiText('چراغ سبز')}: حرکت؛ ${signs?uiText('ورود ممنوع'):uiText('چراغ قرمز')}: صبر"><span class="traffic-go">${symbol({shape:signs?'oneway':'circle',color:'green'})}${icon('tap')}<b>حرکت</b></span><span class="traffic-wait">${symbol({shape:signs?'noentry':'circle',color:'red'})}${icon('wait')}<b>صبر</b></span><span class="sr-only">${signs?uiText('تابلوی یک‌طرفه یعنی حرکت؛ ورود ممنوع یعنی صبر.'):uiText('چراغ سبز یعنی حرکت؛ چراغ قرمز یعنی صبر.')}</span></div>`;
}

export function missionInventory(session) {
  return lt`<div class="inventory"><span>${icon(session.gameId==='space'?'rocket':'bag')} ${session.gameId==='space'?uiText('تجهیزات سفینه'):uiText('کولهٔ تو')} <b>${fa(session.metrics.hits)} از ${fa(session.required.length)}</b></span><div>${session.required.map(([name])=>{
    const item=session.items.find(item=>item.icon===name&&item.collected);
    return `<span class="inventory-slot ${item?'filled':''}" data-equipment="${name}" role="img" aria-label="${item?lt`${item.name}، آماده شد`:lt`${EQUIPMENT_NEEDS[name]}، هنوز آماده نشده`}">${item?(session.gameId==='ark'?arkEquipment(name):spaceEquipment(name)):needArt(name)}${item?icon('check'):''}</span>`;
  }).join('')}</div></div>`;
}

export function stroopScorecard(session) {
  if(session.gameId!=='stroop')return '';
  return lt`<div class="stroop-scorecard" aria-label="نتیجهٔ هر قانون"><h2>هر قانون چطور پیش رفت؟</h2><div>${stroopRules(session).map((rule,phase)=>{
    const outcomes=session.outcomes.filter(outcome=>outcome.phase===phase);
    const correct=outcomes.filter(outcome=>outcome.correct).length;
    return lt`<div class="rule-score" data-rule-phase="${phase}">${stroopRulePicture(phase,session)}<b>${fa(correct)} از ${fa(outcomes.length)}</b><span>تصمیم درست</span><meter min="0" max="${outcomes.length||1}" value="${correct}" aria-label="${rule.title}: ${fa(correct)} تصمیم درست از ${fa(outcomes.length)}"></meter></div>`;
  }).join('')}</div></div>`;
}
export function shortPrompt(session){
  if(session.gameId==='ark')return uiText('وسایل سفر را پیدا کن');
  if(session.gameId==='space')return uiText('سفینه را برای پرواز آماده کن');
  if(session.gameId==='hunt')return session.targets?.length===2?uiText('هر دو نمونه را پیدا کن و بزن'):uiText('مثل نمونه را پیدا کن و بزن');
  if(session.gameId==='traffic')return session.variant==='signs'?uiText('فلش آبی: بزن؛ قرمز: صبر'):uiText('سبز: بزن؛ قرمز: صبر');
  if(session.gameId==='search')return session.targetCount===2?uiText('هر دو را حفظ کن، هر دو را پیدا کن'):uiText('نگاه کن، حفظ کن، پیدا کن');
  if(session.gameId==='nback')return lt`مثل ${fa(session.n)} شکل قبل بود؟ بزن`;
  if(session.gameId==='stroop')return stroopRules(session)[session.current?.phase||0].title;
  return uiText('وسایل لازم را بردار، راهی شو');
}
export function missionChecklist(session,{interactive=false}={}) {
  return lt`<div class="mission-checklist" aria-label="نیازهای این سفر">${session.required.map(([name],i)=>{
    const packed=session.items.some(item=>item.icon===name&&item.collected);
    const content=`<span class="need-symbol">${needArt(name)}</span><span class="need-copy">${EQUIPMENT_NEEDS[name]}</span><b class="need-state">${packed?icon('check'):fa(i+1)}</b>`;
    return interactive?lt`<button type="button" class="mission-need need-audio ${packed?'packed':''}" data-action="listen-guide" data-guide="${name}" aria-pressed="false" aria-label="شنیدن نیاز: ${EQUIPMENT_NEEDS[name]}">${content}${icon('sound')}</button>`:`<span class="mission-need ${packed?'packed':''}" role="img" aria-label="${EQUIPMENT_NEEDS[name]}${packed?uiText('، آماده شد'):''}">${content}</span>`;
  }).join('')}</div>`;
}
export function preparationView(session) {
  if(!session.practice&&session.experienceVersion>=2)return compactPreparation(session);
  const {gameId:id}=session; let title, text, sample, tip;
  if(id==='hunt') {
    title=session.targets.length===2?uiText('هر دو هدف را بشناس'):uiText('هدف تو را بشناس');
    text=lt`فقط ${session.targets.map(describeStimulus).join(uiText(' یا '))} هدف است. شکل‌های هم‌رنگ با علامت اضافه، هدف نیستند.`;
    sample=tokens(session.targets);tip=uiText('وقتی هدف را دیدی، روی خودش یا دکمهٔ پاسخ بزن. اگر هدف نبود، صبر کن.');
  } else if(id==='traffic') {
    const signs=session.variant==='signs';title=signs?uiText('با نشانهٔ درست حرکت کن'):uiText('سبز یعنی حرکت، قرمز یعنی صبر');
    text=uiText('برای نشانهٔ حرکت، دکمهٔ «حرکت!» را بزن؛ برای نشانهٔ توقف، هیچ دکمه‌ای نزن.');if(session.trafficRouteVersion)text+=uiText(' روی دست‌انداز صبر کن؛ برای حرکت دوباره، به نشانهٔ حرکت تازه پاسخ بده.');
    sample=lt`<div class="ready-example">${symbol({shape:signs?'oneway':'circle',color:'green'})}<span>حرکت کن</span></div><div class="ready-example">${symbol({shape:signs?'noentry':'circle',color:'red'})}<span>صبر کن</span></div>`;
    tip=uiText('نشانه کوتاه دیده می‌شود، اما تا شروع نوبت بعد برای پاسخ فرصت داری.');
  } else if(id==='nback') {
    title=lt`مقایسه با ${fa(session.n)} محرک قبل`;
    text=lt`اول ${fa(session.n)} محرک را فقط به خاطر بسپار. بعد، هر محرک جدید را با دقیقاً ${fa(session.n)} محرک قبل مقایسه کن؛ اگر یکسان بودند پاسخ بده.`;
    const lesson=createLesson(id,{level:session.level,material:session.material})[0];
    sample=memoryExample(lesson.stimuli,session.n);
    tip=uiText('این فقط یک نمونه است. در بازی، محرک‌های قبلی پنهان می‌شوند؛ آن‌ها را در حافظه نگه دار.');
  } else if(id==='stroop') {
    title=uiText('چهار مرحله، چهار قانون');text=stroopRules(session)[0].text;
    sample=stroopRulePicture(0,session);tip=uiText('در بعضی مرحله‌ها رنگ نوشته مهم است و در بعضی، معنای کلمه. قانون بالای صفحه را دنبال کن.');
  } else if(id==='search') {
    title=session.targetCount===2?uiText('دو نمونه را حفظ کن، هر دو را پیدا کن'):uiText('نمونه را حفظ کن، پیدایش کن');
    text=lt`در هر دور، ${session.targetCount===2?uiText('هر دو نمونه'):uiText('نمونه')} فقط ${(session.timing.previewMs/1000).toLocaleString(numberLocale())} ثانیه دیده می‌شود. بعد از پنهان‌شدن، ${session.targetCount===2?uiText('هر دو را'):uiText('آن را')} میان گزینه‌ها پیدا کن.`;
    // Illustrations here never reveal the actual first-round sample.
    sample=gameArtwork(id);tip=lt`رنگ، شکل و ${session.material==='letters'?uiText('خط کوچک کنار حرف'):uiText('علامت داخل شکل')} را به خاطر بسپار. ${(session.timing.searchMs/1000).toLocaleString(numberLocale())} ثانیه برای جست‌وجوی هر دور فرصت داری.`;
  } else {
    title=session.mission.title;text=session.mission.story;sample=gameArtwork(id);
    tip=session.practice?uiText('پنج وسیله را یکی‌یکی بررسی کن؛ وسیلهٔ ضروری را بردار و برای بقیه «دست نگه دار» را بزن.'):lt`نیازهای این سفر را برطرف کن و قبل از پایان زمان ${id==='space'?uiText('سفینه را پرتاب کن. مانع‌ها را اول کنار بزن.'):uiText('سوار کشتی شو.')}`;
  }
  const key=guidanceKey({...session,targetCount:session.targets?.length||session.targetCount});
  if(id==='hunt')return lt`<div class="game-preparation hunt-preparation"><span class="section-kicker">یک نگاه تیزبین، یک کشف تازه</span><h2>${session.targets.length===2?uiText('هر دو نمونه را پیدا می‌کنی؟'):uiText('آماده‌ای دقیق نگاه کنی؟')}</h2><div class="preparation-samples">${gameArtwork('hunt',{theme:session.theme})}</div><div class="hunt-preparation-targets">${huntTargetCue(session)}</div><div class="hunt-preparation-steps"><span>${icon('eye')}<b>نمونه را ببین</b></span><i aria-hidden="true">←</i><span>${icon('tap')}<b>مثلش را بزن</b></span></div>${guideControl(key)}<span class="hunt-preparation-note">${session.moving?uiText('نمونه را در حرکت پیدا کن؛ قبل از رفتن، روی خودش بزن.'):uiText('به رنگ و علامت کوچک دقت کن؛ هر شکل شبیه نمونه، هدف نیست.')}</span><details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p><p>${session.moving?uiText('ماهی، پرنده و پروانه حرکت می‌کنند؛ شکل‌ها و ستاره‌ها ثابت‌اند. وقتی هدف از صحنه خارج شد، روی آن پاسخ نده.'):uiText('ستاره‌ها و شکل‌ها ثابت‌اند و خیلی کوتاه نمایش داده می‌شوند؛ تا شروع نوبت بعد برای دکمهٔ پاسخ فرصت داری.')}</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  if(id==='stroop')return lt`<div class="game-preparation studio-preparation"><span class="section-kicker">چهار قانون، چهار چالش رنگی</span><h2>به کارگاه رنگ خوش اومدی!</h2><div class="preparation-samples">${gameArtwork(id)}</div>${stroopPhasePath(0)}<span class="studio-preparation-caption">از این قانون شروع می‌کنیم</span>${stroopRulePicture(0,session)}${guideControl(key)}<div class="studio-preparation-rule"><span class="do-cue">${icon('tap')}<b>هدف بود؟ بزن</b></span><span class="wait-cue">${icon('wait')}<b>نبود؟ صبر کن</b></span></div><details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p><p>مرحله‌های کلمه به توانایی خواندن نیاز دارند. راهنمای صوتی فقط قانون را توضیح می‌دهد و کلمهٔ محرک را در بازی نمی‌خواند.</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  if(id==='nback')return lt`<div class="game-preparation memory-preparation"><span class="section-kicker">یک نگاه، چند گام در حافظه</span><h2>حافظه‌ات آمادهٔ ماجراجویی است؟</h2><div class="preparation-samples">${gameArtwork(id)}</div><div class="memory-preparation-example"><span>یک نمونه با ${fa(session.n)} گام فاصله</span>${sample}</div><div class="memory-preparation-rule"><span class="do-cue">${icon('tap')}<b>مثل هم؟ بزن</b></span><span class="wait-cue">${icon('wait')}<b>فرق داشت؟ صبر کن</b></span></div>${guideControl(key)}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p><p>شکل خیلی کوتاه دیده می‌شود؛ تا آمدن شکل بعدی فرصت پاسخ داری. به همهٔ شکل‌های تازه هم دقت کن و آن‌ها را به خاطر بسپار.</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با مرور تصویری</small>'):''}</div>`;
  if(id==='search')return lt`<div class="game-preparation search-preparation"><span class="section-kicker">کارآگاه کوچک، به جزئیات دقت کن</span><h2>${session.targetCount===2?uiText('دو سرنخ، یک حافظهٔ آماده'):uiText('آماده‌ای سرنخ را پیدا کنی؟')}</h2><div class="preparation-samples">${sample}</div><div class="search-preparation-steps" aria-label="نمونه را ببین، به خاطر بسپار، مثل آن را پیدا کن"><span>${icon('eye')}<b>ببین</b></span><i aria-hidden="true">←</i><span>${icon('memory')}<b>یادت بماند</b></span><i aria-hidden="true">←</i><span>${icon('magnify')}<b>پیدا کن</b></span></div><span class="search-preparation-rule">${session.targetCount===2?uiText('هر دو نمونه'):uiText('نمونه')} را ${(session.timing.previewMs/1000).toLocaleString(numberLocale())} ثانیه ببین؛ بعد ${session.targetCount===2?uiText('هر دو را'):uiText('آن را')} از حافظه پیدا کن.</span>${guideControl(key)}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  if(id==='traffic')return lt`<div class="game-preparation traffic-preparation"><span class="section-kicker">یک رانندهٔ دقیق، یک سفر شیرین</span><h2>${session.variant==='signs'?uiText('فلش آبی، راهِ پارک'):uiText('تا پارک بریم؟')}</h2><div class="preparation-samples">${gameArtwork('traffic')}</div>${trafficRulePicture(session.variant==='signs')}${guideControl(key)}<div class="traffic-preparation-trip">${icon('tap')}<span>هر حرکت درست، یک قدم به مقصد</span>${icon('flag')}</div><details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  if(id==='space')return lt`<div class="game-preparation space-preparation"><span class="section-kicker">فضانورد کوچک، نوبت توست!</span><h2>تا ستاره‌ها بریم؟</h2><div class="preparation-samples">${sample}</div><div class="space-preparation-steps" aria-label="سنگ را کنار بزن، وسایل لازم را بردار، سفینه را پرتاب کن"><span><i>${spaceEquipment('obstacle')}${icon('tap')}</i><b>کنار بزن</b></span><em aria-hidden="true">←</em><span><i>${icon('bag')}</i><b>بردار</b></span><em aria-hidden="true">←</em><span><i>${icon('rocket')}</i><b>پرتاب کن</b></span></div><div class="mission-needs-heading">برای پرواز چه لازم است؟<small>روی تصویر بزن و بشنو</small></div>${missionChecklist(session,{interactive:true})}${guideControl(key)}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p><p>اگر روی وسیله سنگ بود، اول روی سنگ بزن؛ بعد وسیلهٔ نمایان‌شده را بررسی کن.</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  if(id==='ark')return lt`<div class="game-preparation ark-preparation"><span class="section-kicker">یک کوله، یک کشتی، یک ماجراجویی</span><h2>آماده‌ای راهی سفر شویم؟</h2><div class="preparation-samples">${sample}</div><div class="ark-preparation-steps" aria-label="وسایل را پیدا کن، در کوله بگذار، سوار کشتی شو"><span>${icon('eye')}<b>پیدا کن</b></span><i aria-hidden="true">←</i><span>${icon('bag')}<b>بردار</b></span><i aria-hidden="true">←</i><span>${icon('arrow')}<b>راهی شو</b></span></div><div class="mission-needs-heading">برای این سفر چه لازم است؟<small>روی تصویر بزن و بشنو</small></div>${missionChecklist(session,{interactive:true})}${guideControl(key)}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p></details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
  return lt`<div class="game-preparation"><span class="section-kicker">اول آماده شو</span><h2>${shortPrompt(session)}</h2><div class="preparation-samples">${sample}</div><div class="visual-rule"><span class="do-cue">${icon('tap')}<b>بزن</b></span><span class="wait-cue">${icon('wait')}<b>صبر کن</b></span>${guideControl(key)}</div>${['ark','space'].includes(id)?lt`<div class="mission-needs-heading">برای سفر چه لازم است؟ <small>روی هر تصویر بزن و بشنو</small></div>${missionChecklist(session,{interactive:true})}`:''}<details class="companion-guide"><summary>راهنمای همراه</summary><h3>${title}</h3><p>${text}</p><p>${tip}</p>${id==='stroop'?uiText('<p>مرحله‌های کلمه به توانایی خواندن نیاز دارند. راهنمای صوتی قانون را توضیح می‌دهد و کلمهٔ محرک را در بازی نمی‌خواند.</p>'):''}</details>${session.practice?uiText('<small class="guided-note">پنج تمرین، با فرصت یادگیری</small>'):''}</div>`;
}
function compactPreparation(session) {
  const id=session.gameId,classes={hunt:'hunt',traffic:'traffic',nback:'memory',stroop:'studio',search:'search',ark:'ark',space:'space'};
  let cue;
  if(id==='hunt')cue=`<div class="hunt-preparation-targets">${huntTargetCue(session)}</div>`;
  else if(id==='traffic')cue=trafficRulePicture(session.variant==='signs');
  else if(id==='stroop')cue=stroopRulePicture(0,session);
  else if(id==='nback'){const instruction=lt`با ${fa(session.n)} محرک قبل مقایسه کن`;cue=`<div class="visual-rule"><span>${icon('repeat')} ${instruction}</span></div>`;}
  else if(id==='search'){const instruction=lt`${session.targetCount===2?uiText('هر دو نمونه را'):uiText('نمونه را')} ${(session.timing.previewMs/1000).toLocaleString(numberLocale())} ثانیه به خاطر بسپار؛ سپس پیدایش کن.`;cue=`<p>${instruction}</p>`;}
  else cue=missionChecklist(session,{interactive:true});
  return lt`<div class="game-preparation ${classes[id]}-preparation compact-preparation"><span class="section-kicker">بازی اصلی · ${LEVELS[session.level].label}</span><h2>آماده‌ای شروع کنیم؟</h2><p>${shortPrompt(session)}</p>${cue}${guideControl(guidanceKey({...session,targetCount:session.targets?.length||session.targetCount}))}</div>`;
}
export function countdownView() {
  return uiText('<div class="game-countdown"><span class="section-kicker">چشم‌ها به محل بازی</span><b id="countdown-number" aria-live="off">۳</b><p>آرام و آماده…</p></div>');
}
export function reviewView(session) {
  const review=session.review;let good, text, sample, label;
  if(review.kind==='reaction') {
    const {trial,outcome}=review;good=outcome.correct;sample=tokens([trial.stimulus]);
    label=trial.target?uiText('این محرک هدف بود'):uiText('این محرک هدف نبود');
    if(session.gameId==='hunt') {
      const targets=session.targetsByPhase?.[trial.phase]||session.targets;
      text=trial.target?uiText('شکل، رنگ و علامت با یکی از هدف‌ها یکسان بود؛ باید پاسخ می‌دادی.'):uiText('این شکل با نمونهٔ هدف یکسان نبود؛ باید بدون پاسخ صبر می‌کردی.');
      sample=lt`<div class="review-comparison"><div><small>${outcome.response?uiText('انتخاب تو'):trial.target?uiText('هدف این نوبت'):uiText('یکی از شکل‌های این نوبت')}</small>${tokens([outcome.selectedStimulus||trial.stimulus])}</div><div><small>نمونهٔ هدف</small>${tokens(targets)}</div></div>`;
    } else if(session.gameId==='traffic')text=trial.target?uiText('این نشانه اجازهٔ حرکت می‌داد؛ باید دکمهٔ حرکت را می‌زدی.'):uiText('این نشانه توقف بود؛ درست این بود که هیچ دکمه‌ای نزنی.');
    else if(session.gameId==='nback') {
      text=trial.target?lt`محرک فعلی با ${fa(session.n)} محرک قبل یکسان بود؛ باید پاسخ می‌دادی.`:lt`محرک فعلی با ${fa(session.n)} محرک قبل فرق داشت؛ باید صبر می‌کردی.`;
      sample=memoryExample([...trial.history,trial.stimulus],session.n);
    } else {sample=`<div class="studio-review-sample">${stroopRulePicture(trial.phase,session)}<div class="studio-review-paper">${sample}</div></div>`;text=lt`قانون این مرحله: ${stroopRules(session)[trial.phase].text} ${trial.target?uiText('این محرک شرط را داشت؛ باید پاسخ می‌دادی.'):uiText('این محرک شرط را نداشت؛ باید صبر می‌کردی.')}`;}
    if(outcome.response&&outcome.selectedTarget===false&&trial.target)text+=uiText(' هدف در صحنه بود، اما شکلی که انتخاب کردی مزاحم بود.');
  } else if(review.kind==='search') {
    const decisions=session.outcomes.filter(o=>o.round===session.index+1), errors=decisions.filter(o=>!o.correct).length;
    good=review.found===review.total&&!errors;label=lt`${fa(review.found)} از ${fa(review.total)} هدف پیدا شد`;
    text=lt`این ${review.total===2?uiText('دو نمونه، هدف‌های'):uiText('نمونه، هدف')} این دور بود${review.total===2?uiText('ند'):''}. ${errors?uiText('رنگ و علامت کوچک را دوباره بررسی کن؛ دور بعد فرصت تازه‌ای داری.'):uiText('جزئیات را درست به خاطر سپردی.')}`;
    sample=`<div class="review-targets">${tokens(review.targets)}</div>`;
  } else {
    const {item,outcome}=review;good=outcome.correct;label=item.required?uiText('این وسیله لازم بود'):uiText('این وسیله ضروری نبود');
    sample=`<span class="review-equipment">${session.gameId==='ark'?arkEquipment(item.icon):spaceEquipment(item.icon)}</span>`;
    text=item.required?EQUIPMENT_REASONS[item.icon]:lt`${item.name} برای سرگرمی یا خانه خوب است، اما نیاز ضروری این مأموریت را برطرف نمی‌کند.`;
  }
  const expected=review.kind==='reaction'?review.trial.target:review.kind==='adventure'?review.item.required:true;
  const audio=review.kind==='adventure'?(review.item.required?review.item.icon:'not-needed'):good?'correct':'retry';
  return lt`<div class="practice-review ${good?'good':'retry'}" role="region" aria-label="مرور تمرین"><span class="review-badge">${icon(good?'check':'repeat')} ${good?uiText('آفرین!'):uiText('با هم یاد بگیریم')}</span><h2>${label}</h2><div class="review-samples">${sample}</div><div class="review-decision ${expected?'do-cue':'wait-cue'}">${icon(expected?'tap':'wait')}<b>${expected?uiText('این را بزن'):uiText('دست نگه دار')}</b>${guideControl(audio)}</div><details class="companion-guide"><summary>چرا؟ راهنمای همراه</summary><p>${esc(text)}</p></details><small>زمان متوقف است</small></div>`;
}
export function transitionView(session) {
  if(session.transitionClock){
    const phase=session.current.phase;
    if(session.gameId==='hunt')return lt`<div class="rule-transition automatic-rule-notice" role="status"><h2>نمونهٔ تازه؛ رنگ هدف عوض شد</h2>${huntTargetCue(session)}<p>ادامهٔ خودکار تا <b id="transition-seconds">${fa(Math.ceil(RULE_NOTICE_MS/1000))}</b></p></div>`;
    return lt`<div class="rule-transition studio-transition automatic-rule-notice" role="status">${stroopPhasePath(phase)}<span class="section-kicker">قانون بعدی</span><h2>${stroopRules(session)[phase].title}</h2>${stroopRulePicture(phase,session)}<p>ادامهٔ خودکار تا <b id="transition-seconds">${fa(Math.ceil(RULE_NOTICE_MS/1000))}</b></p></div>`;
  }
  if(session.gameId==='hunt')return huntIntermission(session,guideControl(guidanceKey({...session,targetCount:session.targets.length})));
  if(session.gameId==='stroop')return stroopTransition(session,guideControl(guidanceKey({...session,phase:session.current.phase})));
  const hunt=session.gameId==='hunt', phase=session.current.phase;
  const completed=session.outcomes.filter(o=>o.phase===phase-1),correct=completed.filter(o=>o.correct).length;
  const rule=hunt?{title:lt`${fa(session.blockLengths[phase]*(session.intervalMs||1000)/1000)} ثانیه توجه پیوسته`,text:uiText('هدف‌ها همان‌اند. این بار مدت بیشتری آن‌ها را دنبال کن؛ هر وقت آماده‌ای ادامه بده.')}:STROOP_RULES[phase];
  const examples=hunt?`<div class="rule-example">${tokens(session.targets)}</div>`:`<div class="rule-examples">${createLesson('stroop',session).slice(phase*2,phase*2+2).map(step=>`<div class="rule-sample">${symbol(step.stimuli[0])}<b>${step.expected?uiText('پاسخ بده'):uiText('صبر کن')}</b><small>${step.explanation}</small></div>`).join('')}</div>`;
  return lt`<div class="rule-transition"><span class="section-kicker">${hunt?uiText('یک نفس تازه، یک دور تازه'):uiText('حالا قانون عوض می‌شود')}</span>${hunt?lt`<span class="checkpoint-result">${fa(correct)} تصمیم درست از ${fa(completed.length)} نوبت قبلی</span>`:''}<h2>${rule.title}</h2>${hunt?'':stroopRulePicture(phase,session)}<p>${rule.text}</p>${examples}${guideControl(guidanceKey({...session,phase,targetCount:session.targets?.length}))}<button class="button primary" data-action="acknowledge">آماده‌ام ${icon('play')}</button></div>`;
}
export function stroopStages(phase) { return stroopPhasePath(phase);
}
export function trafficProgress(session){
  if(session.trafficRouteVersion)return session.journey.progress;
  const pending=session.response?.selectedTarget===true&&!session.review?1:0;
  return Math.min(1,Math.max(0,(session.metrics.hits+pending)/session.maxScore));
}
export function trafficRoad(session) {
  return trafficRoadArt(session?trafficProgress(session):0,{routeVersion:session?.trafficRouteVersion,practice:session?.practice});
}

export function searchTargetStatus(session) {
  return lt`<div class="search-target-status" aria-label="هدف‌های پیدا‌شدهٔ این دور">${session.current.targets.map((_target,i)=>{
    const found=[...session.found].map(index=>session.current.choices[index]).find(choice=>choice.targetIndex===i);
    return `<span class="target-status ${found?'discovered':''}" data-target-index="${i}">${found?symbol(found):uiText('<b aria-hidden="true">؟</b>')}<small>${found?uiText('پیدا شد'):lt`هدف ${fa(i+1)}`}</small>${found?icon('check'):''}</span>`;
  }).join('')}</div>`;
}
export function searchRounds(session) {
  return lt`<div class="search-rounds" aria-label="مسیر دورهای جست‌وجو">${Array.from({length:session.total},(_,i)=>{
    const outcomes=session.outcomes.filter(o=>o.round===i+1),complete=i<session.index,success=complete&&outcomes.filter(o=>o.target&&o.response).length===session.targetCount;
    return lt`<span class="${complete?success?'round-done':'round-retry':i===session.index?'round-current':''}" ${i===session.index?'aria-current="step"':''} aria-label="دور ${fa(i+1)}${complete?success?uiText('، پیدا شد'):uiText('، فرصت بعدی'):''}">${complete&&success?icon('check'):fa(i+1)}</span>`;
  }).join('')}</div>`;
}
export function huntBlocks(session) {
  return lt`<div class="hunt-blocks" aria-label="مدت دوره‌های توجه پیوسته">${session.blockLengths.map((length,i)=>lt`<span class="${i<session.current.phase?'block-done':i===session.current.phase?'block-active':''}" ${i===session.current.phase?'aria-current="step"':''}><b>${fa(length*(session.intervalMs||1000)/1000)}</b> ثانیه</span>`).join('')}</div>`;
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
    return `<article class="recap-step"><span class="section-kicker">${outcome.round?lt`دور ${fa(outcome.round)}`:lt`تصمیم ${fa(i+1)}`}</span>${reviewView({...session,index,review})}</article>`;
  });

  return lt`<details class="result-learning"><summary>${icon('info')} با هم مرور کنیم <span>${fa(mistakes.length)} تصمیم برای تمرین</span>${icon('chevron')}</summary><div class="recap-intro">بازی پایان یافته است؛ این مرور امتیاز را تغییر نمی‌دهد. برای نوبت بعد، به این نکته‌ها توجه کن.</div><div class="recap-steps">${cards.join('')}</div>${mistakes.length>4?uiText('<p class="recap-more">چند نمونه برای مرور نشان داده شده است. می‌توانی از راهنمای بازی، نمونه‌های بدون زمان را دوباره تمرین کنی.</p>'):''}</details>`;
}

export function roundBreakView(session) {
  const {round,found,total}=session.roundBreak,complete=found===total;
  return lt`<div class="round-intermission"><span class="section-kicker">دور ${fa(round)} از ${fa(session.total)} تمام شد</span><span class="round-emblem ${complete?'complete':''}">${icon(complete?'check':'spark')}</span><h2>${complete?uiText('هدف‌ها را پیدا کردی!'):uiText('دور بعد، یک فرصت تازه است')}</h2><p>${fa(found)} از ${fa(total)} هدف این دور پیدا شد. یک نفس تازه کن؛ هر وقت آماده‌ای، نمونهٔ دور بعد را ببین.</p>${searchRounds({...session,index:session.index+1})}<small>زمان متوقف است؛ دور بعد با درخواست تو شروع می‌شود.</small></div>`;
}
