import { ApiClient } from './api.js';
import { accountView, loginView, importPreviewView, roleName } from './account-ui.js';
import { seededRandom } from './core/random.js';
import { GAMES, GAME_MAP, GAME_PROTOCOLS, LEVELS, THEMES } from './config.js';
import { FACTORIES } from './games/index.js';
import { searchVariant } from './games/search.js';
import { assessmentSteps, nextAssessmentGame } from './core/assessment.js';
import { createLesson } from './lessons.js';
import { STROOP_RULES } from './games/stroop.js';
import { readProgress, writeProgress, resultKey } from './core/storage.js';
import { activeProfile, readClients, profileRecords, latestBaseline, validateProfile, escapeHTML as esc, variantOf } from './core/clients.js';
import { describeStimulus } from './stimuli.js';
import { recommendLevel } from './core/reports.js';
import { profileStrip, profilesView, reportsView, assessmentView, variantLabel } from './client-ui.js';
import { icon, logo, art, heroArt, symbol, equipment, trophyArt, sceneBackground, huntBackground } from './visuals.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const announcer = document.querySelector('#announcer');
const progress = readProgress();
const clients = {version:1,activeId:null,profiles:[],records:[],difficulties:[]};
const api=new ApiClient();
let currentUser=null,members=[],inviteToken=null,inviteInfo=null,remoteRun=null,pendingSave=null,starting=false,previewImport=null;
let pendingStart = null, sessionIsBaseline = false, editingProfile = null, guideState = null, sessionAssessment = false, lessonState = null, sessionRecordId = null;
const reportState = { tab: 'therapist', game: '', level: '', variant: '', kind: 'training', recordId: null };
const fa = value => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value);
const time = ms => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${fa(Math.floor(seconds / 60)).padStart(2, '۰')}:${fa(seconds % 60).padStart(2, '۰')}`; };
const describe = describeStimulus;
let route = 'home', selectedGame = 'hunt', selectedLevel = 'easy', selectedTheme = 'star', selectedHuntMode = 'standard', selectedLayout = 'grid', selectedSearchMode = 'single', selectedTrafficMode = 'circles', selectedMaterial = 'shapes', filter = 'all';
let engine = null, frame = 0, arenaKey = '', modalKind = '', audioContext;

function header() {
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="#" data-action="home" aria-label="حواس، صفحهٔ اصلی">${logo()}<span>حواس<small>ماجراجویی‌های ذهنی</small></span></a><nav aria-label="منوی اصلی"><button class="nav-link ${route === 'home' ? 'active' : ''}" data-action="games">بازی‌ها <span class="nav-count">۷</span></button><button class="nav-link" data-action="about">چطور بازی کنیم؟</button><button class="nav-link report-nav" data-action="dashboard">گزارش‌ها</button></nav><div class="header-end">${currentUser?`<button class="profile-button" data-action="account">${esc(currentUser.name)} · ${roleName(currentUser.role)}</button>`:''}<button class="profile-button" data-action="profiles">${activeProfile(clients) ? esc(activeProfile(clients).firstName) : 'ثبت مراجع'}</button><button class="icon-button sound-button" data-action="sound" aria-label="${progress.sound ? 'خاموش‌کردن صدا' : 'روشن‌کردن صدا'}" aria-pressed="${progress.sound}">${icon(progress.sound ? 'sound' : 'mute')}</button></div></div></header>`;
}
const footer = () => `<footer class="site-footer"><span>${logo()} حواس؛ جایی برای بازی و کشف</span><span>با سرعت خودت، به سبک خودت ${icon('spark')}</span></footer>`;
function page(content, className = '') {
  cancelAnimationFrame(frame);
  app.innerHTML = `${header()}<main id="main" class="${className}" tabindex="-1">${content}</main>${footer()}`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('#main').focus({ preventScroll: true });
}
function setHash(hash) { if (location.hash !== hash) history.pushState({}, '', hash || location.pathname); }
function home(updateHash = true) {
  if(!currentUser)return showLogin();
  pendingStart = null; guideState = null; engine = null; route = 'home'; if (modal.open) modal.close(); if (updateHash) setHash('');
  document.title = 'حواس — ماجراجویی‌های ذهنی';
  page(`<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="tiny-spark">✳</span> به دنیای حواس خوش اومدی</div><h1>یک بازی کوچک،<br>یک ذهن <span class="highlight">آماده‌تر.<svg viewBox="0 0 250 15" aria-hidden="true"><path d="M3 10Q120-3 246 8"/></svg></span></h1><p class="hero-description">کشف کن، به خاطر بسپار و با دقت انتخاب کن.<br>اینجا هر بازی، یک ماجراجویی تازه برای ذهن توئه.</p><div class="hero-actions"><button class="button primary" data-action="games">بزن بریم بازی ${icon('arrow')}</button><button class="text-button" data-action="about">${icon('play')} چطور بازی کنیم؟</button></div><div class="hero-facts"><span><b>۷</b> بازی متفاوت</span><i></i><span><b>۳</b> سطح چالش</span><i></i><span>${icon('check')} پروندهٔ شخصی تمرین</span></div></div><div class="hero-picture">${heroArt()}<div class="hero-caption"><span class="status-dot"></span> هر بار بازی، یک قدم رو به جلو</div></div></section>
    ${profileStrip(clients,currentUser)}<section class="library" id="games" aria-labelledby="library-heading"><div class="section-heading"><div><div class="section-kicker">یک چالش تازه انتخاب کن</div><h2 id="library-heading">امروز کدوم ماجراجویی؟ ${icon('spark')}</h2></div><p>از هر جا دوست داری، شروع کن.</p></div><div class="filter-bar" role="group" aria-label="دسته‌بندی بازی‌ها">${[['all','همهٔ بازی‌ها'],['attention','توجه و تمرکز'],['memory','حافظه'],['speed','سرعت واکنش']].map(([id,label]) => `<button class="filter ${filter === id ? 'selected' : ''}" data-action="filter" data-filter="${id}" aria-pressed="${filter === id}">${label}${id === 'all' ? '<span>۷</span>' : ''}</button>`).join('')}<span class="filter-note">همهٔ بازی‌ها برای تو بازه ${icon('check')}</span></div><div class="game-grid" id="game-grid">${gameCards()}</div></section>
    <section class="little-note"><span class="note-symbol">${icon('spark')}</span><div><h3>برای بهترشدن، لازم نیست عجله کنی.</h3><p>از سطح آسان شروع کن، قانون بازی رو یاد بگیر و از مسیر لذت ببر.</p></div><span class="note-doodle">✳</span></section>`, 'home-main');
}
function gameCards() {
  const shown = GAMES.filter(game => filter === 'all' || game.tags.includes(filter));
  return shown.map((game, index) => {
    const records = profileRecords(clients).filter(item => item.kind === 'training' && item.result.gameId === game.id);
    return `<button class="game-card" data-action="open" data-game="${game.id}" style="--card-color:${game.color};--card-accent:${game.accent};--card-index:${index}"><div class="card-picture"><span class="card-number">${fa(GAMES.indexOf(game) + 1).padStart(2, '۰')}</span>${art(game.id)}${records.length ? `<span class="played-badge">${icon('check')} بازی کردی</span>` : ''}</div><div class="card-content"><span class="skill-label">${game.skill}</span><h3>${game.title}</h3><p>${game.subtitle}</p><div class="card-bottom"><span>${icon('clock')} ${game.time}</span><span class="card-arrow" aria-hidden="true">${icon('arrow')}</span></div></div></button>`;
  }).join('') + (filter === 'all' ? `<div class="routine-card"><span class="routine-flower">✳</span><span class="section-kicker">یک یادآوری کوچولو</span><h3>هر روز،<br>چند دقیقه برای ذهنت.</h3><p>یک بازی رو انتخاب کن.<br>شاید امروز رکورد تازه‌ای بزنی!</p><button class="text-button" data-action="about">راهنمای شروع ${icon('arrow')}</button><span class="routine-dots">● ● ●</span></div>` : '');
}

function lessonContent() {
  const step=lessonState?.steps[lessonState.index]; if(!step)return '';
  return `<div class="lesson-heading"><span class="section-kicker">نمونهٔ آموزشی · بدون زمان و بدون ثبت امتیاز</span><b>${fa(lessonState.index+1)} از ${fa(lessonState.steps.length)}</b></div><h3>${step.title}</h3><p>${step.prompt}</p><div class="lesson-stimuli ${step.reference!==undefined?'sequence':''}">${step.equipment?equipment(step.equipment):step.stimuli.map((stimulus,i)=>`<div class="lesson-token ${step.reference===i?'reference':''} ${step.reference!==undefined && i===step.stimuli.length-1?'current':''}">${symbol(stimulus)}${step.reference!==undefined?`<small>${i===step.stimuli.length-1?'فعلی':step.reference===i?'مرجع':fa(i+1)}</small>`:''}</div>`).join('')}</div>${lessonState.answered?`<div class="lesson-feedback ${lessonState.correct?'good':'wrong'}" role="status"><b>${lessonState.correct?'درست بود!':'این نمونه را دوباره بررسی کن.'}</b><p>${step.explanation}</p></div><button class="text-button" data-action="lesson-next">${lessonState.index+1<lessonState.steps.length?'نمونهٔ بعدی':'دوباره دیدن نمونه‌ها'} ←</button>`:`<div class="lesson-answers"><button class="button subtle" data-action="lesson-answer" data-response="true">بله، پاسخ می‌دهم</button><button class="button subtle" data-action="lesson-answer" data-response="false">نه، صبر می‌کنم</button></div>`}`;
}
function answerLesson(response) {
  if(route!=='detail'||!lessonState||lessonState.answered)return;
  lessonState.answered=true;lessonState.correct=response===lessonState.steps[lessonState.index].expected;
  tone(lessonState.correct);document.querySelector('#lesson-box').innerHTML=lessonContent();
  document.querySelector('#lesson-box [data-action="lesson-next"]')?.focus({preventScroll:true});
}
function nextLesson() {
  if(route!=='detail'||!lessonState)return;
  lessonState.index=(lessonState.index+1)%lessonState.steps.length;lessonState.answered=false;
  document.querySelector('#lesson-box').innerHTML=lessonContent();
  document.querySelector('#lesson-box [data-action="lesson-answer"]')?.focus({preventScroll:true});
}
async function assessment() {
  if(currentUser)await refreshClients();
  engine=null;guideState=null;route='assessment';if(modal.open)modal.close();setHash('#assessment');
  document.title='ارزیابی اولیه — حواس';page(assessmentView(clients),'content-main assessment-main');
}
function standardOptions(level='easy') {
  selectedLevel=level;selectedTheme='star';selectedMaterial='shapes';selectedHuntMode='standard';selectedLayout='grid';selectedSearchMode='single';selectedTrafficMode='circles';
}
function beginAssessment(id) {
  if(!activeProfile(clients)||!GAME_MAP[id])return assessment();
  standardOptions();guideState={profileId:clients.activeId,gameId:id};return detail(id);
}
function trainFromAssessment(id) {
  if(!GAME_MAP[id])return;
  const step=assessmentSteps(clients).find(step=>step.game.id===id);
  guideState=null;standardOptions(step?.recommendation?.level || 'easy');return detail(id);
}
function taskOptions(game) {
  if (game.id==='hunt') return `<fieldset class="theme-selector"><legend>تمرین کدام نوع توجه؟</legend><div class="theme-options">${[['standard','یک هدف · توجه پایدار'],['divided','دو هدف · توجه تقسیم‌شده']].map(([mode,label])=>`<button class="theme-button hunt-mode ${selectedHuntMode===mode?'selected':''}" data-action="hunt-mode" data-mode="${mode}" aria-pressed="${selectedHuntMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت دوهدفه، به هر کدام از دو نمونه پاسخ بده؛ مجموع هدف‌ها همچنان ۳۰ تاست.</p></fieldset>`;
  if (game.id==='traffic') return `<fieldset class="theme-selector"><legend>با کدام نشانه بازی کنیم؟</legend><div class="theme-options">${[['circles','دایره‌های قرمز و سبز'],['signs','ورود ممنوع و یک‌طرفه']].map(([mode,label])=>`<button class="theme-button ${selectedTrafficMode===mode?'selected':''}" data-action="traffic-mode" data-mode="${mode}" aria-pressed="${selectedTrafficMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت تابلوها، به نشانهٔ آبی یک‌طرفه پاسخ بده و تابلوی قرمز ورود ممنوع را نادیده بگیر.</p></fieldset>`;
  if (game.id==='nback') return materialOptions('حافظه را با چی تمرین کنیم؟', [['shapes','شکل‌ها'],['numbers','اعداد'],['toys','اسباب‌بازی‌ها']]);
  if (game.id==='search') return `<fieldset class="theme-selector"><legend>چیدمان شکل‌ها</legend><div class="theme-options">${[['grid','منظم'],['scattered','پراکنده']].map(([layout,label])=>`<button class="theme-button layout-button ${selectedLayout===layout?'selected':''}" data-action="search-layout" data-layout="${layout}" aria-pressed="${selectedLayout===layout}">${label}</button>`).join('')}</div></fieldset>${materialOptions('نوع محرک', [['shapes','شکل‌ها'],['letters','حروف انگلیسی']])}<fieldset class="theme-selector"><legend>چند هدف پیدا کنیم؟</legend><div class="theme-options">${[['single','یک هدف · حافظه'],['dual','دو هدف · توجه تقسیم‌شده']].map(([mode,label])=>`<button class="theme-button ${selectedSearchMode===mode?'selected':''}" data-action="search-mode" data-mode="${mode}" aria-pressed="${selectedSearchMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت دوهدفه، هر دو نمونه را حفظ کن و در هر دور هر دو را پیدا کن؛ هر کشف درست یک امتیاز دارد.</p></fieldset>`;
  return '';
}
function materialOptions(title, choices) {
  return `<fieldset class="theme-selector"><legend>${title}</legend><div class="theme-options">${choices.map(([id,label])=>`<button class="theme-button ${selectedMaterial===id?'selected':''}" data-action="material" data-material="${id}" aria-pressed="${selectedMaterial===id}">${label}</button>`).join('')}</div></fieldset>`;
}
function currentVariant() {
  if (selectedGame === 'hunt') return selectedHuntMode;
  if (selectedGame === 'traffic') return selectedTrafficMode === 'signs' ? 'signs' : 'standard';
  if (selectedGame === 'nback') return ['numbers','toys'].includes(selectedMaterial) ? selectedMaterial : 'standard';
  if (selectedGame === 'search') return searchVariant({material:selectedMaterial,layout:selectedLayout,targetCount:selectedSearchMode==='dual'?2:1});
  return 'standard';
}
function assessmentInfo() {
  const baseline = latestBaseline(clients, selectedGame, currentVariant());
  const last = profileRecords(clients).filter(r=>r.result.gameId===selectedGame && (r.result.protocolVersion || 2)===GAME_PROTOCOLS[selectedGame] && variantOf(r.result)===currentVariant()).at(-1)?.result;
  return `<div class="assessment-info"><b>${baseline ? 'ارزیابی پایه انجام شده' : 'شروع با ۵ تمرین و ارزیابی پایه'}</b><p>${last ? `سطح پیشنهادی: ${LEVELS[recommendLevel(last).level].label}. ${recommendLevel(last).reason}` : 'اول قانون را یاد می‌گیری؛ سپس براساس دقت، سرعت، خطاها و پاسخ‌های متوالی، یک سطح قابل‌تغییر پیشنهاد می‌شود.'}</p>${baseline ? '<button class="text-button" data-action="baseline">تکرار ارزیابی پایه</button>' : ''}</div>`;
}
function gameCopy(game) {
  if(game.id==='traffic' && selectedTrafficMode==='signs')return {...game,description:'فقط با دیدن تابلوی آبی یک‌طرفه حرکت کن. تابلوی ورود ممنوع یعنی باید صبر کنی و پاسخ ندهی.',rules:['تابلوی آبی یک‌طرفه: دکمهٔ «حرکت!» را بزن.','تابلوی قرمز ورود ممنوع: هیچ دکمه‌ای نزن.','تابلو کوتاه دیده می‌شود، اما تا شروع نوبت بعد فرصت پاسخ داری.']};
  if(game.id==='nback') {
    const noun=selectedMaterial==='numbers'?'عدد':selectedMaterial==='toys'?'اسباب‌بازی':'شکل';
    return {...game,description:`${noun}‌ها یکی‌یکی دیده می‌شوند. قانون می‌گوید محرک فعلی را با یک، دو یا سه محرک قبل مقایسه کنی.`,rules:[`در آسان، ${noun} فعلی را با یک محرک قبل مقایسه کن.`,`در متوسط دو و در سخت سه محرک قبل را به خاطر بیاور.`,`فقط وقتی ${noun} فعلی با همان محرک یکسان است پاسخ بده؛ به بقیه پاسخ نده.`]};
  }
  if(game.id==='search') {
    const dual=selectedSearchMode==='dual',noun=selectedMaterial==='letters'?'حرف':'شکل';
    return {...game,description:dual?`دو ${noun} را به خاطر بسپار و بعد، هر دو را در یک صفحهٔ شلوغ پیدا کن. جزئیات نمونه‌ها مهم‌اند.`:`${noun} نمونه را به خاطر بسپار و بعد آن را میان گزینه‌های مشابه پیدا کن.`,rules:[dual?'دو ثانیه به هر دو نمونه نگاه کن و جزئیاتشان را حفظ کن.':`دو ثانیه به ${noun} نمونه نگاه کن و جزئیاتش را حفظ کن.`,dual?'پس از پنهان‌شدن نمونه‌ها، هر دو هدف را پیدا کن؛ با پیدا‌کردن یکی، دور تمام نمی‌شود.':'پس از پنهان‌شدن نمونه، همان نمونه را بین گزینه‌ها پیدا کن.','هر کشف درست یک امتیاز دارد. برای هر دور زمان محدودی داری.']};
  }
  return game;
}
async function detail(id, updateHash = true) {
  if(currentUser)await refreshClients();
  if (!GAME_MAP[id]) return home();
  if (selectedGame !== id) selectedMaterial = 'shapes';
  engine = null; route = 'detail'; selectedGame = id; if (modal.open) modal.close(); if (updateHash) setHash(`#${id}`);
  if (guideState && (guideState.gameId!==id || guideState.profileId!==clients.activeId)) guideState = null;
  lessonState = { steps:createLesson(id,{level:selectedLevel,material:selectedMaterial,theme:selectedTheme,trafficMode:selectedTrafficMode}), index:0, answered:false };
  const policy=clients.difficulties.find(d=>d.gameId===id&&d.variant===currentVariant()&&d.protocolVersion===GAME_PROTOCOLS[id]);
  if(!guideState&&policy)selectedLevel=policy.level;
  lessonState = {steps:createLesson(id,{level:selectedLevel,material:selectedMaterial,theme:selectedTheme,trafficMode:selectedTrafficMode}),index:0,answered:false};
  const game = gameCopy(GAME_MAP[id]); document.title = `${game.title} — حواس`;
  page(`<div class="breadcrumb"><button data-action="home">بازی‌ها</button>${icon('chevron')}<span>${game.title}</span></div>${guideState?`<div class="guided-banner"><b>ارزیابی اولیه · ${fa(GAMES.findIndex(game=>game.id===id)+1)} از ۷</b><span>این بخش شامل پنج تمرین در سطح آسان است.</span><button class="text-button" data-action="assessment">دیدن مسیر ارزیابی ←</button></div>`:""}<section class="intro-layout"><div class="intro-copy"><div class="eyebrow">${icon('spark')} ${game.skill}</div><h1>${game.title}</h1><p class="intro-description">${game.description}</p><ol class="rules">${game.rules.map((rule,i) => `<li><span>${fa(i+1)}</span><p>${rule}</p></li>`).join('')}</ol>${lessonState.steps.length?`<section class="lesson-box" id="lesson-box" aria-label="نمونهٔ آموزشی تعاملی">${lessonContent()}</section>`:""}<fieldset class="level-selector"><legend>چالش امروزت چقدر باشه؟</legend><div class="levels">${Object.entries(LEVELS).map(([id,level],i) => `<button class="level-button ${selectedLevel === id ? 'selected' : ''}" data-action="level" data-level="${id}" aria-pressed="${selectedLevel === id}" ${guideState||currentUser?.role==='parent'?"disabled":""}><span class="level-bars" aria-hidden="true">${[0,1,2].map(j=>`<i class="${j<=i?'lit':''}"></i>`).join('')}</span><b>${level.label}</b><small>${level.caption}</small></button>`).join('')}</div></fieldset>${id === 'hunt' ? `<fieldset class="theme-selector"><legend>با چی بازی کنیم؟</legend><div class="theme-options">${Object.entries(THEMES).map(([key,label]) => `<button class="theme-button ${key===selectedTheme?'selected':''}" data-action="theme" data-theme="${key}" aria-pressed="${key===selectedTheme}">${label}</button>`).join('')}</div></fieldset>` : ''}${taskOptions(game)}${assessmentInfo()}${currentUser?.role!=='parent'&&activeProfile(clients)?`<div class="difficulty-policy"><span>روش سطح: ${policy?.mode==='fixed'?'ثابت؛ انتخاب سطح، تنظیم درمانگر را ثابت می‌کند.':'تطبیقی؛ سطح جلسهٔ بعد از عملکرد تعیین می‌شود.'}</span><button class="text-button" data-action="adaptive-level">فعال‌کردن سطح تطبیقی</button></div>`:''}<div class="start-row"><button class="button primary" data-action="practice">بریم تمرین کنیم ${icon('arrow')}</button>${!guideState && latestBaseline(clients,id,currentVariant()) ? '<button class="button primary" data-action="main-game">بازی اصلی ←</button>' : '<span>۵ تمرین؛ ارزیابی جدا از امتیاز اصلی</span>'}</div></div><aside class="intro-art" style="--card-color:${game.color}"><div class="intro-art-bubble">${art(id)}</div><div class="intro-art-note">${icon('target')} <span>یک قانون ساده، یک چالش جذاب</span></div><div class="session-summary" id="session-summary">${levelSummary(game)}</div></aside></section>`, 'content-main');
  if(guideState)document.querySelectorAll('[data-action="theme"],[data-action="hunt-mode"],[data-action="material"],[data-action="traffic-mode"],[data-action="search-mode"],[data-action="search-layout"]').forEach(button=>button.disabled=true);
}
function levelSummary(game) {
  const l = LEVELS[selectedLevel];
  if (game.kind === 'reaction') return `<span><b>۱۵۰</b> نوبت · ۳۰ هدف</span><span><b>${fa(l.visibleMs)}</b> میلی‌ثانیه نمایش</span>${game.id==='hunt'?`<span><b>${fa({easy:3,medium:5,hard:7}[selectedLevel])}</b> شکل هم‌زمان</span>`:''}`;
  if (game.kind === 'search') return `<span><b>۱۰</b> دور جست‌وجو</span><span><b>${fa(l.searchSeconds)}</b> ثانیه برای هر دور</span><span><b>${selectedSearchMode==='dual'?'۲':'۱'}</b> هدف در هر دور</span>`;
  return `<span><b>${fa(l.required)}</b> وسیلهٔ ضروری</span><span><b>${fa(l.seconds)}</b> ثانیه فرصت</span>`;
}

async function start(practice, forceBaseline = false) {
  if(starting)return;
  if(!currentUser)return showLogin();
  if (!activeProfile(clients)) { pendingStart = { practice, forceBaseline }; return profiles(); }
  sessionAssessment = Boolean(guideState && guideState.gameId===selectedGame && guideState.profileId===clients.activeId);
  if (sessionAssessment) { practice=true;forceBaseline=true;selectedLevel='easy'; }
  if (!practice && !latestBaseline(clients, selectedGame, currentVariant())) practice = true;
  sessionIsBaseline = practice && (forceBaseline || !latestBaseline(clients, selectedGame, currentVariant()));
  const options=gameOptions();
  starting=true;notify('در حال دریافت تنظیمات جلسه از سرور…');document.querySelectorAll('[data-action="practice"],[data-action="main-game"],[data-action="replay"]').forEach(button=>button.disabled=true);
  try {remoteRun=(!practice||sessionIsBaseline)?await api.request(`/children/${clients.activeId}/sessions`,{method:'POST',body:{...options,kind:sessionIsBaseline?'baseline':'training'}}):null;}
  finally {starting=false;document.querySelectorAll('[data-action="practice"],[data-action="main-game"],[data-action="replay"]').forEach(button=>button.disabled=false);}
  if(remoteRun)selectedLevel=remoteRun.settings.level;
  if (modal.open) modal.close();
  sessionRecordId=null;
  route = 'play'; engine = FACTORIES[selectedGame]({ ...options,level:selectedLevel,practice,random:remoteRun?seededRandom(remoteRun.settings.seed):Math.random }); engine.clock.pause(); arenaKey = '';
  const game = GAME_MAP[selectedGame];
  page(`<div class="play-heading"><div><span class="section-kicker">${practice ? sessionIsBaseline ? '۵ تمرین برای آموزش و ارزیابی پایه' : 'وقت تمرینه؛ امتیازت ثبت نمی‌شه' : 'نوبت ماجراجویی توئه'}</span><h1>${game.title}<span class="level-pill">${LEVELS[selectedLevel].label}</span></h1></div><button class="button subtle pause-button" data-action="pause">${icon('pause')} توقف</button></div><section class="play-panel ${game.kind}" aria-label="محیط بازی"><div class="play-hud"><div><span id="progress-label"></span><b id="position"></b></div><div class="hud-time">${icon('clock')}<div><span id="time-label"></span><b id="time"></b></div></div><div><span>پاسخ‌های هدف درست</span><b id="hits">۰</b></div></div><div class="progress-track"><span id="progress-fill"></span></div><div class="instruction-strip" id="instruction"></div><div id="arena" class="arena"></div><div class="play-controls" id="play-controls"></div><div id="feedback" class="feedback" role="status">با آرامش و دقت شروع کن؛ تو می‌تونی!</div></section><p class="play-footnote">${icon('info')} ${practice ? sessionIsBaseline ? 'این پنج تمرین برای آموزش و پیشنهاد سطح اولیه ثبت می‌شوند.' : 'این بخش فقط برای یادگرفتن قانون بازیه.' : game.kind==='reaction' ? 'محرک کوتاه دیده می‌شه؛ تا شروع نوبت بعد فرصت پاسخ داری.' : 'عجله نکن؛ انتخاب درست، مهم‌تر از انتخاب سریعه.'}</p>`, 'play-main');
  engine.clock.resume();
  updatePlay();
  frame = requestAnimationFrame(loop);
}
function loop() { if (route !== 'play' || !engine) return; updatePlay(); if (route === 'play') frame = requestAnimationFrame(loop); }
function setText(id, value) { const node = document.getElementById(id); if (node && node.textContent !== value) node.textContent = value; }
function updatePlay() {
  if (!engine || route !== 'play') return;
  engine.tick(); if (engine.done) return finish();
  const game = GAME_MAP[engine.gameId], reaction = game.kind === 'reaction', search = game.kind === 'search';
  const position = reaction ? engine.position : search ? engine.index : engine.practice ? engine.judged : engine.metrics.hits;
  const total = engine.total;
  setText('progress-label', reaction ? engine.current.scored === false ? 'اول به خاطر بسپار' : 'نوبت بازی' : search ? 'دور جست‌وجو' : engine.practice ? 'تمرین' : 'تجهیزات کوله');
  setText('position', reaction && engine.current.scored === false ? `${fa(engine.index+1)} از ${fa(engine.n)}` : `${fa(Math.min(total,position + (game.kind === 'adventure' && !engine.practice ? 0 : 1)))} از ${fa(total)}`);
  setText('hits', fa(engine.metrics.hits));
  setText('time-label', reaction || engine.practice && game.kind === 'adventure' ? 'زمان بازی' : 'زمان باقی‌مانده');
  setText('time', search && engine.preview ? 'نگاه کن' : time(reaction || engine.practice && game.kind === 'adventure' ? engine.clock.elapsed : engine.remainingMs));
  const fill = document.getElementById('progress-fill'); if (fill) fill.style.width = `${100*position/total}%`;
  const key = reaction ? `${engine.index}:${engine.gate}` : search ? `${engine.index}:${engine.preview}:${[...engine.rejected].join(',')}:${[...engine.found].join(',')}` : `${engine.judged}:${engine.items.map(i=>`${+i.collected}${+i.rejected}${+i.blocked}`).join('')}`;
  if (key !== arenaKey) {
    arenaKey = key;
    const presenting = (reaction || search) && !engine.gate && !engine.paused;
    if (presenting) engine.clock.pause();
    renderArena(game);
    if (presenting) { engine.clock.resume(); if(reaction) engine.onset = engine.clock.elapsed; }
  }
  if (reaction) {
    const stimulus = document.querySelector('.stimulus-shell'); if (stimulus) stimulus.style.visibility = engine.visible ? 'visible' : 'hidden';
    const response = document.querySelector('[data-action="respond"]'); if (response) response.disabled = engine.gate || engine.paused || engine.current.scored === false;
  }
  const feedback = document.getElementById('feedback');
  if (engine.feedback && feedback.textContent !== engine.feedback) { feedback.textContent = engine.feedback; feedback.className = `feedback ${engine.feedbackKind}`; }
}
function reactionScene(game) {
  const tap=`<button class="stimulus-tap" data-action="stimulus-response" data-trial="${engine.index}" aria-label="پاسخ به محرک نمایش‌داده‌شده">${symbol(engine.current.stimulus)}</button>`;
  if (game.id==='hunt') {
    const {size}=engine.current;
    return `<div class="reaction-stage hunt-stage"><div class="stage-caption">بین شکل‌ها، فقط هدف رو بزن؛ اگر هدف نیست، صبر کن.</div><div class="hunt-surface">${huntBackground(engine.background)}<div class="stimulus-shell hunt-array" style="--stimulus-size:${size}px">${engine.current.choices.map((choice,i)=>`<button class="stimulus-tap hunt-choice" data-action="stimulus-response" data-trial="${engine.index}" data-choice="${i}" style="left:${choice.position.x}%;top:${choice.position.y}%" aria-label="${esc(describe(choice.stimulus))}">${symbol(choice.stimulus)}</button>`).join('')}</div></div></div>`;
  }
  return `<div class="reaction-stage"><div class="stage-caption">${engine.current.scored===false?'این محرک رو فقط به خاطر بسپار':'خوب نگاه کن…'}</div><div class="focus-corners"><i></i><i></i><i></i><i></i><div class="stimulus-shell">${tap}</div></div><span class="stage-dots" aria-hidden="true">· · ·</span></div>`;
}
function searchBoard() {
  const scattered=engine.layout==='scattered';
  const style=scattered?`style="--scatter-columns:${engine.current.columns};--scatter-height:${engine.current.rows*78}px"`:'';
  return `<div class="search-grid ${selectedLevel} ${scattered?'scattered':''}" ${style}>${engine.current.choices.map((choice,i)=>`<button class="search-choice ${engine.rejected.has(i)?'rejected':''} ${engine.found.has(i)?'found':''}" ${scattered?`style="left:${choice.position.x}%;top:${choice.position.y}%;--scatter-angle:${choice.angle}deg"`:''} data-action="search-choice" data-index="${i}" aria-label="گزینهٔ ${fa(i+1)}: ${describe(choice)}" ${engine.rejected.has(i)||engine.found.has(i)?'disabled':''}>${symbol(choice)}${engine.found.has(i)?icon('check'):''}</button>`).join('')}</div>`;
}
function renderArena(game) {
  const arena = document.getElementById('arena'), controls = document.getElementById('play-controls'), instruction = document.getElementById('instruction');
  if (game.kind === 'reaction') {
    let cue, button;
    if (game.id === 'hunt') { cue = `<span class="target-examples">${engine.targets.map(target=>`<span class="target-mini">${symbol(target)}</span>`).join('')}</span><span>${engine.targets.length===2?'هدف‌های تو':'هدف تو'}: <b>${engine.targets.map(describe).join(' یا ')}</b></span>`; button = 'پیداش کردم'; }
    if (game.id === 'traffic' && selectedTrafficMode === 'signs') { cue = `${icon('target')}<span>یک‌طرفه: <b>حرکت کن</b> <i class="cue-divider"></i> ورود ممنوع: <b>صبر کن</b></span>`; button = 'حرکت!'; }
    else if (game.id === 'traffic') { cue = `${icon('target')}<span>سبز: <b>حرکت کن</b> <i class="cue-divider"></i> قرمز: <b>صبر کن</b></span>`; button = 'حرکت!'; }
    if (game.id === 'nback') { cue = `${icon('target')}<span>فقط اگر با <b>${fa(engine.n)} محرک قبل</b> یکسانه، پاسخ بده.</span>`; button = `مثل ${fa(engine.n)} تا قبله`; }
    if (game.id === 'stroop') { cue = `${icon('target')}<span>مرحلهٔ ${fa(engine.current.phase+1)}: <b>${STROOP_RULES[engine.current.phase].title}</b></span>`; button = 'این هدفه'; }
    instruction.innerHTML = cue;
    if (engine.gate) {
      const hunt=game.id==='hunt';
      const rule=hunt?{title:`${fa(engine.blockLengths[engine.current.phase])} ثانیه توجه پیوسته`,text:'خوب پیش رفتی! این دور کمی طولانی‌تره. همون هدف‌ها رو دنبال کن؛ هر وقت آماده‌ای ادامه بده.'}:STROOP_RULES[engine.current.phase];
      const example=hunt?engine.targets.map(target=>symbol(target)).join(''):symbol({shape:'word',word:'yellow',color:'yellow'});
      arena.innerHTML = `<div class="rule-transition"><span class="big-spark">✳</span><span class="section-kicker">${hunt?'حالا کمی طولانی‌تر تمرکز کنیم':'حالا قانون عوض می‌شه'}</span><h2>${rule.title}</h2><p>${rule.text}</p><div class="rule-example">${example}${icon('check')}</div><button class="button primary" data-action="acknowledge">فهمیدم، ادامه بدیم ${icon('arrow')}</button></div>`;
    } else arena.innerHTML = reactionScene(game);
    controls.innerHTML = `<button class="button response-button" data-action="respond" ${engine.gate || engine.current.scored === false ? 'disabled' : ''}>${icon('target')} ${button}</button><span class="keyboard-hint">یا کلید <kbd>فاصله</kbd> روی کیبورد</span>`;
  } else if (game.kind === 'search') {
    const dual=engine.targetCount===2;
    instruction.innerHTML = `${icon(engine.preview ? 'info' : 'target')}<span>${engine.preview ? dual?'دو ثانیه فرصت داری؛ <b>هر دو نمونه رو به خاطر بسپار.</b>':'دو ثانیه فرصت داری؛ <b>شکل و علامتش رو به خاطر بسپار.</b>' : dual?'نمونه‌ها پنهان شدند؛ <b>هر دو هدف رو پیدا کن.</b>':'نمونه پنهان شده؛ <b>همون شکل رو پیدا کن.</b>'}</span>`;
    if (engine.preview) arena.innerHTML = `<div class="search-preview"><span class="section-kicker">${dual?'هر دو نمونه رو یادت بمونه':'این نمونه رو یادت بمونه'}</span><div class="preview-targets">${engine.current.targets.map(target=>`<div class="preview-target"><div class="preview-symbol">${symbol(target)}</div><span class="preview-description">${describe(target)}</span></div>`).join('')}</div><span class="preview-countdown">بعدش پیداش کن!</span></div>`;
    else arena.innerHTML = searchBoard();
    controls.innerHTML = `<span class="search-tip">${icon('info')} ${engine.preview ? 'هنوز گزینه‌ها نمایش داده نشدن.' : dual?`${fa(engine.found.size)} از ۲ هدف این دور پیدا شده؛ به جزئیات دقت کن.`:'روی شکل درست بزن؛ به جزئیات دقت کن.'}</span>`;
  } else {
    instruction.innerHTML = `${icon('target')}<span>${engine.practice ? 'این وسیله برای سفر لازمه؟ <b>انتخاب کن یا «لازم نیست» رو بزن.</b>' : engine.ready ? '<b>کوله آماده‌ست! قبل از پایان زمان راهی شو.</b>' : `<b>${fa(engine.required.length)} وسیلهٔ ضروری</b> رو پیدا کن.${game.id==='space'?' اول موانع رو کنار بزن.':''}`}</span>`;
    const items = engine.practice ? [engine.currentItem] : engine.items;
    arena.innerHTML = `<div class="mission-brief"><b>${engine.mission.title}</b><p>${engine.practice ? 'این پنج وسیله را یکی‌یکی بررسی کن؛ برای انتخاب درست یا رد وسیلهٔ غیرضروری تصمیم بگیر.' : engine.mission.story}</p></div><div class="adventure-scene ${game.id} ${engine.practice?'practice-scene':''}">${sceneBackground(game.id)}<div class="scene-heading">${game.id==='space'?'ایستگاه فضایی حواس':'ساحل امید'} <span>${engine.practice?'آموزش انتخاب وسایل':'وسایل رو با دقت بررسی کن'}</span></div><div class="object-grid ${selectedLevel}">${items.map(item=>`<button class="scene-object ${item.collected?'collected':''} ${item.rejected?'rejected':''} ${item.blocked?'blocked':''}" data-action="item" data-index="${item.id}" aria-label="${item.blocked?'کنار زدن مانع':item.name}" ${item.collected||item.rejected?'disabled':''}>${equipment(item.blocked?'obstacle':item.icon)}<span>${item.blocked?'کنار بزن':item.name}</span>${item.blocked?'<b class="obstacle-plus">+</b>':''}</button>`).join('')}</div><div class="scene-vehicle">${art(game.id)}</div></div>`;
    controls.innerHTML = engine.practice ? `<button class="button subtle" data-action="reject-item" ${engine.currentItem.blocked?'disabled':''}>این وسیله لازم نیست ${icon('arrow')}</button>` : `<div class="inventory"><span>کولهٔ تو</span><div>${engine.required.map(([name],i)=>{ const item=engine.items.find(item=>item.icon===name&&item.collected); return `<span class="inventory-slot ${item?'filled':''}" title="${item?item.name:'هنوز پیدا نشده'}">${item?equipment(name):fa(i+1)}</span>`; }).join('')}</div></div><button class="button primary depart-button" data-action="depart" ${engine.ready?'':'disabled'}>${game.id==='space'?'پرتاب سفینه':'سوار کشتی شو'} ${icon('arrow')}</button>`;
  }
}

function finish() {
  const session = engine, result = session.result, game = GAME_MAP[selectedGame]; route = 'result';
  if (modal.open) modal.close();
  const needsSave=!session.practice||sessionIsBaseline;
  if(needsSave)pendingSave={run:remoteRun,result,childId:clients.activeId,ownerId:currentUser.id};
  const recommendation = recommendLevel(result);
  if (sessionIsBaseline) selectedLevel = recommendation.level;
  const ratio = result.maxScore ? result.score/result.maxScore : 0;
  const stars = !result.completed?0:ratio>=.85?3:ratio>=.5?2:ratio>0?1:0;
  const title = session.practice ? sessionIsBaseline ? 'ارزیابی پایه کامل شد' : 'تمرین تموم شد، آماده‌ای؟' : !result.completed ? 'این سفر هنوز ادامه داره!' : ratio>=.85 ? 'چه تمرکز درخشانی!' : ratio>=.5 ? 'آفرین، خوب پیش رفتی!' : 'هر بار، یک قدم بهتر!';
  const caption = session.practice ? sessionIsBaseline ? 'نتیجهٔ این پنج تمرین جدا از بازی اصلی در پرونده نگهداری می‌شود. پیشنهاد سطح اولیه است و می‌توانی آن را تغییر بدهی.' : 'قانون بازی رو یاد گرفتی. حالا می‌تونی ماجراجویی اصلی رو شروع کنی.' : !result.completed ? 'زمان تموم شد. یک بار دیگه امتحان کن؛ حالا وسایل رو بهتر می‌شناسی.' : game.kind==='adventure' ? session.mission.success : 'مهم‌ترین بخشش رو انجام دادی: با دقت بازی کردی. آمادهٔ یک چالش دیگه‌ای؟';
  page(`<section class="result-card">${trophyArt()}<div class="eyebrow">${session.practice?'۵ تمرین آموزشی':'پایان بازی'} <span>·</span> ${game.title}</div><h1>${title}</h1><p class="result-caption">${caption}</p>${!session.practice?`<div class="result-stars" aria-label="${fa(stars)} ستاره از ۳">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">★</span>`).join('')}</div>`:''}<div class="result-main-score"><b>${fa(result.score)}</b><span>از ${fa(result.maxScore)} ${session.practice?'پاسخ هدف':'امتیاز'}</span></div><div class="result-stats"><div>${icon('check')}<b>${fa(result.hits)}</b><span>انتخاب هدف درست</span></div><div>${icon('target')}<b>${fa(result.falseSelections)}</b><span>انتخاب اشتباه</span></div><div>${icon('info')}<b>${fa(result.omissions)}</b><span>هدف بدون پاسخ</span></div><div>${icon('clock')}<b>${time(result.durationMs)}</b><span>زمان فعال بازی</span></div><div>${icon('check')}<b>${fa(result.longestStreak)}</b><span>تصمیم درست متوالی</span></div>${game.kind==='reaction'?`<div>${icon('pause')}<b>${fa(result.correctRejections)}</b><span>خودداری درست از پاسخ</span></div>`:''}${result.meanReactionMs!==null?`<div>${icon('spark')}<b>${fa(result.meanReactionMs)} <small>ms</small></b><span>${result.reactionMeasure==='decision-interval'?'میانگین زمان انتخاب درست':'میانگین واکنش درست'}</span></div>`:''}</div>${game.kind==='reaction'?'<p class="score-note">امتیاز = هدف‌های درست، منهای انتخاب‌های اشتباه؛ حداقل صفر.</p>':''}${!session.practice || sessionIsBaseline?`<p class="local-note">${icon('check')} در حال ثبت نتیجه در سرور مرکز…</p>`:''}<div class="result-actions"><button class="button primary" data-action="${session.practice?'main-game':'replay'}">${session.practice?'بزن بریم بازی اصلی':'دوباره بازی کن'} ${icon(session.practice?'arrow':'repeat')}</button><button class="button subtle" data-action="${session.practice?'detail':'home'}">${session.practice?'برگشت به راهنما':'انتخاب بازی دیگه'}</button></div></section>`, 'result-main');
  if (!session.practice || sessionIsBaseline) {
    const note = document.querySelector('.local-note');
    note.innerHTML=`${icon('clock')} در حال ثبت نتیجه در سرور مرکز…`;
    const best = profileRecords(clients).filter(r=>r.kind==='training' && resultKey(r.result)===resultKey(result) && (r.result.protocolVersion || 2)===result.protocolVersion).map(r=>r.result).sort((a,b)=>b.score-a.score || Number(b.completed)-Number(a.completed))[0];
    if (Number.isFinite(best?.score)) document.querySelector('.result-main-score').insertAdjacentHTML('afterend', `<p class="best-score">${icon('trophy')} بهترین امتیاز تو در سطح ${LEVELS[result.level].label}: <b>${fa(best.score)} از ${fa(best.maxScore)}</b></p>`);
  }
  if(result.variant && result.variant!=='standard')document.querySelector('.result-caption').insertAdjacentHTML('afterend',`<span class="variant-note">${variantLabel(result.variant)}</span>`);
  document.querySelector('.result-actions').insertAdjacentHTML('beforebegin', `<div class="level-recommendation"><b>سطح پیشنهادی ${sessionIsBaseline?'برای شروع':'برای نوبت بعد'}: ${LEVELS[recommendation.level].label}</b><p>${recommendation.reason}</p><button class="text-button" data-action="recommended-level" data-level="${recommendation.level}">انتخاب سطح و دیدن راهنما ←</button></div>`);
  document.querySelector('.result-actions').insertAdjacentHTML('beforeend','<button class="text-button" data-action="dashboard">دیدن پرونده و گزارش‌ها</button>');
  if(sessionAssessment) {
    const next=nextAssessmentGame(clients);
    document.querySelector('.result-actions').innerHTML=`<button class="button primary" data-action="${next?'assessment-next':'assessment'}">${next?'ادامهٔ ارزیابی بازی بعد':'جمع‌بندی ارزیابی هفت بازی'} ${icon('arrow')}</button><button class="button subtle" data-action="assessment">مسیر ارزیابی و استراحت</button>`;
  } else if(sessionIsBaseline) document.querySelector('.result-actions').insertAdjacentHTML('beforeend','<button class="text-button" data-action="assessment">ارزیابی سایر بازی‌ها</button>');
  if(currentUser.role==='parent')document.querySelector('.level-recommendation button')?.remove();
  announcer.textContent = title;
  if(needsSave){document.querySelectorAll('.result-actions button').forEach(button=>button.disabled=true);void persistPending();}
}

function openModal(content, kind) {
  if (modal.open) modal.close(); modalKind=kind; modal.innerHTML = content; modal.showModal();
}
function about() {
  if (route==='play' && engine && !engine.paused) engine.pause();
  openModal(`<button class="modal-close icon-button" data-action="close-modal" aria-label="بستن راهنما">${icon('close')}</button><span class="big-spark">✳</span><h2 id="modal-title">بازی کنیم، کشف کنیم!</h2><p>حواس یک مجموعهٔ هفت‌تایی از بازی‌های توجه و حافظه‌ست. برای هر مراجع یک پروندهٔ مرکز داری؛ تمرین‌ها و نتیجه‌های هر نفر جدا ثبت می‌شوند.</p><ol class="modal-steps"><li><b>۱</b><span>مشخصات مراجع را ثبت کن و یک بازی انتخاب کن.</span></li><li><b>۲</b><span>با ۵ تمرین کوتاه، قانون را یاد بگیر و ارزیابی پایه را انجام بده.</span></li><li><b>۳</b><span>بازی کن و نتیجهٔ خودت رو ببین.</span></li></ol><p class="modal-small">روی گوشی با لمس بازی کن؛ روی کامپیوتر از ماوس و در بازی‌های واکنشی از کلید فاصله استفاده کن. صدا رو هم می‌تونی از بالای صفحه روشن کنی.</p><button class="button primary full-width" data-action="close-modal">فهمیدم ${icon('check')}</button>`, 'about');
}
function pause() {
  if (route!=='play'||!engine) return;
  engine.pause(); if(engine.done) return finish();
  openModal(`<span class="pause-emblem">${icon('pause')}</span><h2 id="modal-title">یک نفس تازه کن.</h2><p>بازی و زمان متوقف شده. هر وقت آماده بودی، از همین‌جا ادامه بده.</p><div class="modal-buttons"><button class="button primary" data-action="resume">ادامهٔ بازی ${icon('play')}</button><button class="button subtle" data-action="restart">از اول شروع کن ${icon('repeat')}</button><button class="text-button" data-action="home">برگشت به بازی‌ها ${icon('home')}</button></div>`, 'pause');
}
function closeModal() {
  if(modal.open) modal.close();
  if(route==='play'&&engine?.paused&&!engine.gate) engine.resume();
}
function tone(good) {
  if(!progress.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume(); const osc=audioContext.createOscillator(), gain=audioContext.createGain();
    osc.connect(gain); gain.connect(audioContext.destination); osc.type='sine'; osc.frequency.setValueAtTime(good?660:260,audioContext.currentTime);
    gain.gain.setValueAtTime(.045,audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.13);
    osc.start(); osc.stop(audioContext.currentTime+.14);
  } catch { /* Audio is optional. */ }
}
function answer(result) { if(result!==null&&result!==undefined) { tone(result===true||result==='cleared'); if(engine?.feedback) announcer.textContent=engine.feedback; } updatePlay(); }

async function profiles(editId = null, notice = '') {
  if(!currentUser)return showLogin();
  await refreshClients();if(currentUser.role!=='parent')members=(await api.request('/users')).users;
  guideState = null; engine = null; route = 'profiles'; editingProfile = editId;
  if (modal.open) modal.close(); setHash('#profiles'); document.title = 'پروندهٔ مراجعان — حواس';
  page(profilesView(clients, editId, notice,{user:currentUser,members}), 'content-main clients-main');
}
function continueAfterProfile() {
  if (pendingStart) { const next = pendingStart; pendingStart = null; return start(next.practice, next.forceBaseline); }
  return home();
}
async function dashboard() {
  await refreshClients();
  guideState = null; engine = null; route = 'reports'; if (modal.open) modal.close(); setHash('#reports');
  document.title = 'گزارش تمرین‌ها — حواس';
  page(reportsView(clients, reportState,currentUser), 'content-main reports-main');
}
function confirmDeleteProfile(id) {
  const p = clients.profiles.find(p=>p.id===id); if (!p) return;
  openModal(`<h2 id="modal-title">حذف پروندهٔ ${esc(p.firstName)}</h2><p>مشخصات و تمام ${fa(profileRecords(clients,id).length)} نتیجهٔ این مراجع از سرور مرکز حذف می‌شوند. پیش از حذف می‌توانی از گزارش‌ها خروجی بگیری.</p><div class="modal-buttons"><button class="button danger-button" data-action="confirm-delete-profile" data-id="${esc(id)}">حذف پرونده و نتیجه‌ها</button><button class="button subtle" data-action="close-modal">انصراف</button></div>`, 'delete-profile');
}
function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportProfile() {
  if(currentUser.role==='parent'||!clients.activeId)return;
  const data=await api.request(`/children/${clients.activeId}/export`);download(JSON.stringify(data,null,2),'application/json;charset=utf-8','havaas-profile.json');
}
async function exportTrials() {
  if(currentUser.role==='parent')return;
  const records=profileRecords(clients).filter(r=>(!reportState.game||r.result.gameId===reportState.game)&&(!reportState.level||r.result.level===reportState.level)&&(!reportState.variant||variantOf(r.result)===reportState.variant)&&(!reportState.kind||r.kind===reportState.kind));
  const record=records.find(r=>r.id===reportState.recordId)||records.at(-1);if(!record)return;
  const response=await fetch(`/api/children/${clients.activeId}/sessions/${record.id}/export`,{credentials:'same-origin'});if(!response.ok)throw Error('دریافت خروجی مجاز یا ممکن نیست.');download(await response.text(),'text/csv;charset=utf-8','havaas-responses.csv');
}
app.addEventListener('submit',event=>{event.preventDefault();void submitForm(event.target).catch(showError);});
async function submitForm(form){
  const values=Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name||el.getAttribute('name'),el.value]));
  if(form.id==='login-form'){
    const auth=await api.request('/auth/login',{method:'POST',body:values});
    if(pendingSave&&auth.user.id!==pendingSave.ownerId){await api.request('/auth/logout',{method:'POST'});await api.request('/auth/session');throw Error('برای ثبت نتیجه، با همان حساب اجراکننده وارد شوید.');}
    currentUser=auth.user;
    if(pendingSave){if(modal.open)modal.close();return persistPending();}
    if(inviteToken){inviteInfo=await api.request('/invitations/inspect',{method:'POST',body:{token:inviteToken}});return showLogin(inviteInfo);}
    await refreshClients();return home();
  }
  if(form.id==='accept-form'){
    const auth=await api.request('/invitations/accept',{method:'POST',body:{...values,token:inviteToken}});currentUser=auth.user;inviteToken=null;inviteInfo=null;history.replaceState?.({},'',location.pathname);await refreshClients();return home();
  }
  if(form.id==='password-form'){await api.request('/auth/change-password',{method:'POST',body:values});form.reset?.();return notify('رمز تغییر کرد؛ نشست‌های دیگر نیاز به ورود دوباره دارند.');}
  if(form.id==='invitation-form'){const data=await api.request('/invitations',{method:'POST',body:values});return showInvitation(data);}
  if(form.id!=='profile-form')return;
  const validation=validateProfile(values);if(validation.error){document.querySelector('#profile-error').textContent=validation.error;return;}
  const data=await api.request(editingProfile?`/children/${editingProfile}`:'/children',{method:editingProfile?'PATCH':'POST',body:{...validation.profile,...(values.therapistId?{therapistId:values.therapistId}:{})}});
  clients.activeId=data.profile.id;await refreshClients();
  if(pendingStart)return continueAfterProfile();
  return profiles(null,'مشخصات در سرور مرکز ذخیره شد؛ مراجع را انتخاب کن و ادامه بده.');
}
app.addEventListener('change',event=>{void changeInput(event).catch(showError);});
async function changeInput(event){
  if(event.target.id==='import-file'){const file=event.target.files?.[0];if(file)return previewLegacy(JSON.parse(await file.text()));}
  if(event.target.id==='report-profile') {
    if(!clients.profiles.some(p=>p.id===event.target.value))return;
    clients.activeId=event.target.value;reportState.recordId=null;await dashboard();
  }
  const filter=event.target.dataset.reportFilter;
  if(['game','level','variant','kind'].includes(filter)) {reportState[filter]=event.target.value;reportState.recordId=null;await dashboard();}
}
async function handleAction(event) {
  const button = event.target.closest('[data-action]'); if(!button||button.disabled) return;
  const action=button.dataset.action;
  if(starting&&!['sound','about'].includes(action))return;
  if(route==='play'&&['account','profiles','dashboard','home','assessment','open'].includes(action))engine?.clock.pause();
  if(pendingSave&&!['retry-save','reauth','sound','close-modal','about'].includes(action)){notify('ابتدا ثبت نتیجهٔ این جلسه را کامل کنید.');return;}
  if(action==='account')return account();
  if(action==='logout'){await api.request('/auth/logout',{method:'POST'});currentUser=null;members=[];inviteToken=null;inviteInfo=null;previewImport=null;remoteRun=null;Object.assign(clients,{activeId:null,profiles:[],records:[],difficulties:[]});await api.request('/auth/session');return showLogin();}
  if(action==='retry-save')return persistPending();
  if(action==='reauth'){await api.request('/auth/session');return openModal(loginView({reauth:true}),'reauth');}
  if(action==='invite-login')return showLogin(null);
  if(action==='retry-connect')return initialize();
  if(action==='copy-invitation'){const field=document.querySelector('#invitation-url');field.select();await navigator.clipboard?.writeText(field.value);return;}
  if(action==='reset-link')return showInvitation(await api.request('/invitations',{method:'POST',body:{email:button.dataset.email,purpose:'reset'}}));
  if(action==='toggle-user'){await api.request(`/users/${button.dataset.user}`,{method:'PATCH',body:{active:button.dataset.active==='true'}});return account();}
  if(action==='unlink-parent'){await api.request(`/children/${clients.activeId}/parents/${button.dataset.parent}`,{method:'DELETE'});return account();}
  if(action==='import-browser')return previewLegacy(readClients());
  if(action==='commit-import')return commitLegacy();
  if(action==='adaptive-level'){await api.request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'adaptive',level:selectedLevel}});await refreshClients();return detail(selectedGame,false);}
  if(button.tagName==='A') event.preventDefault();
  if(action==='home') return home();
  if(action==='profiles') return profiles();
  if(action==='assessment') return assessment();
  if(action==='assessment-next') return beginAssessment(nextAssessmentGame(clients));
  if(action==='assess-game') return beginAssessment(button.dataset.game);
  if(action==='assessment-train') return trainFromAssessment(button.dataset.game);
  if(action==='lesson-answer') return answerLesson(button.dataset.response==='true');
  if(action==='lesson-next') return nextLesson();
  if(action==='assessment-reports'){Object.assign(reportState,{kind:'baseline',game:'',level:'',variant:'standard',recordId:null});return dashboard();}
  if(action==='dashboard') {
    if(route==='result' && sessionRecordId) {
      const record=profileRecords(clients).find(record=>record.id===sessionRecordId);
      if(record)Object.assign(reportState,{kind:record.kind,game:record.result.gameId,level:record.result.level,variant:variantOf(record.result),recordId:record.id});
    }
    return dashboard();
  }
  if(action==='select-profile') { if(!clients.profiles.some(p=>p.id===button.dataset.id))return; clients.activeId=button.dataset.id; await refreshClients(); return continueAfterProfile(); }
  if(action==='edit-profile') return profiles(button.dataset.id);
  if(action==='delete-profile') return confirmDeleteProfile(button.dataset.id);
  if(action==='confirm-delete-profile') { await api.request(`/children/${button.dataset.id}`,{method:'DELETE'});modal.close();return profiles(null,'پرونده و همهٔ نتیجه‌های آن حذف شد.'); }
  if(action==='report-tab') { reportState.tab=button.dataset.tab; return dashboard(); }
  if(action==='select-record') { reportState.recordId=button.dataset.id; return dashboard(); }
  if(action==='print-report') return window.print();
  if(action==='export-profile') return exportProfile();
  if(action==='export-trials') return exportTrials();
  if(action==='recommended-level') { if(currentUser.role==='parent')return;guideState=null;selectedLevel=button.dataset.level;await api.request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'fixed',level:selectedLevel}});return detail(selectedGame); }
  if(action==='baseline') return start(true,true);
  if(action==='games') { if(route!=='home') home(); requestAnimationFrame(()=>document.querySelector('#games')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})); return; }
  if(action==='about') return about();
  if(action==='close-modal'||action==='resume') return closeModal();
  if(action==='sound') { progress.sound=!progress.sound; writeProgress(progress); document.querySelectorAll('.sound-button').forEach(node=>{ node.innerHTML=icon(progress.sound?'sound':'mute');node.setAttribute('aria-pressed',String(progress.sound));node.setAttribute('aria-label',progress.sound?'خاموش‌کردن صدا':'روشن‌کردن صدا'); }); tone(true); return; }
  if(action==='open') return detail(button.dataset.game);
  if(action==='detail') return detail(selectedGame);
  if(action==='filter') { filter=button.dataset.filter; document.querySelectorAll('.filter').forEach(node=>{ const selected=node.dataset.filter===filter; node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); document.querySelector('#game-grid').innerHTML=gameCards(); return; }
  if(action==='level'&&LEVELS[button.dataset.level]) { if(guideState||currentUser.role==='parent')return;selectedLevel=button.dataset.level;if(clients.activeId){await api.request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'fixed',level:selectedLevel}});}return detail(selectedGame,false); }
  if(action==='theme'&&THEMES[button.dataset.theme]) { selectedTheme=button.dataset.theme; document.querySelectorAll('[data-action="theme"]').forEach(node=>{ const selected=node.dataset.theme===selectedTheme;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); return detail(selectedGame,false); }
  if(action==='hunt-mode'&&['standard','divided'].includes(button.dataset.mode)) { selectedHuntMode=button.dataset.mode;document.querySelectorAll('.hunt-mode').forEach(node=>{const selected=node.dataset.mode===selectedHuntMode;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='traffic-mode') { selectedTrafficMode=button.dataset.mode==='signs'?'signs':'circles'; return detail(selectedGame,false); }
  if(action==='material' && ['shapes','letters','numbers','toys'].includes(button.dataset.material)) { selectedMaterial=button.dataset.material; return detail(selectedGame,false); }
  if(action==='search-mode'&&['single','dual'].includes(button.dataset.mode)){ selectedSearchMode=button.dataset.mode;return detail(selectedGame,false); }
  if(action==='search-layout'&&['grid','scattered'].includes(button.dataset.layout)) { selectedLayout=button.dataset.layout;document.querySelectorAll('.layout-button').forEach(node=>{const selected=node.dataset.layout===selectedLayout;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='practice') return start(true);
  if(action==='main-game'||action==='replay') return start(false);
  if(action==='pause') return pause();
  if(action==='restart') return start(engine?.practice ?? false);
  if(route!=='play'||!engine||modal.open) return;
  if(action==='respond') answer(engine.respond());
  if(action==='stimulus-response') answer(engine.respondToStimulus(Number(button.dataset.trial),button.dataset.choice===undefined?null:Number(button.dataset.choice)));
  if(action==='search-choice') answer(engine.choose(Number(button.dataset.index)));
  if(action==='item') answer(engine.choose(Number(button.dataset.index)));
  if(action==='reject-item') answer(engine.reject());
  if(action==='depart') { tone(engine.depart()); updatePlay(); }
  if(action==='acknowledge') { engine.acknowledge(); arenaKey=''; updatePlay(); }
}
app.addEventListener('click',event=>{void handleAction(event).catch(showError);});
app.addEventListener('pointerdown',event=>{
  if(route!=='play'||!engine||modal.open||event.isPrimary===false||event.button!==0)return;
  const button=event.target.closest('[data-action="stimulus-response"]');
  if(button) {event.preventDefault();answer(engine.respondToStimulus(Number(button.dataset.trial),button.dataset.choice===undefined?null:Number(button.dataset.choice)));}
});
modal.addEventListener('click',event=>{void handleAction(event).catch(showError);});
modal.addEventListener('submit',event=>{event.preventDefault();void submitForm(event.target).catch(showError);});
modal.addEventListener('cancel', event=>{ event.preventDefault(); closeModal(); });
document.addEventListener('keydown', event=>{
  if(event.key==='Escape'&&route==='play'&&!modal.open) { event.preventDefault(); pause(); }
  if(event.code==='Space'&&route==='play'&&!modal.open&&GAME_MAP[selectedGame].kind==='reaction') {
    event.preventDefault(); if(!event.repeat) answer(engine.respond());
  }
});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden&&route==='play'&&engine&&!engine.paused) { if(modal.open) { engine.pause(); } else pause(); } });
window.addEventListener('popstate',()=>{if(pendingSave){notify('نتیجه هنوز در سرور ثبت نشده است.');return;}const id=location.hash.slice(1); if(id==='assessment')assessment();else if(id==='profiles')profiles();else if(id==='reports')dashboard();else if(GAME_MAP[id]) detail(id,false); else home(false); });
function gameOptions(){return {gameId:selectedGame,level:selectedLevel,theme:selectedTheme,material:selectedMaterial,layout:selectedLayout,trafficMode:selectedTrafficMode,targetCount:selectedGame==='search'?(selectedSearchMode==='dual'?2:1):(selectedHuntMode==='divided'?2:1)};}
async function refreshClients(){
  const data=await api.request(`/bootstrap${clients.activeId?'?childId='+encodeURIComponent(clients.activeId):''}`);
  currentUser=data.user;Object.assign(clients,data);
}
function showLogin(invite=null){
  route='auth';engine=null;cancelAnimationFrame(frame);if(modal.open)modal.close();
  page(loginView({invite}), 'auth-main');
}
async function initialize(){
  try {
    const auth=await api.request('/auth/session');currentUser=auth.user;
    const match=location.hash.match(/^#invite\/([a-f0-9]{64})$/);if(match)inviteToken=match[1];
    if(inviteToken){inviteInfo=await api.request('/invitations/inspect',{method:'POST',body:{token:inviteToken}});return showLogin(inviteInfo);}
    if(!currentUser)return showLogin();
    await refreshClients();
    const id=location.hash.slice(1);if(id==='assessment')return assessment();if(id==='profiles')return profiles();if(id==='reports')return dashboard();if(id==='account')return account();if(GAME_MAP[id])return detail(id,false);return home(false);
  }catch(error){page(`<section class="surface empty-state"><h1>ارتباط با مرکز برقرار نشد</h1><p>${esc(error.message)}</p><button class="button primary" data-action="retry-connect">تلاش دوباره</button></section>`,'auth-main');}
}
function notify(message){
  let node=document.querySelector('#account-status')||document.querySelector('#app-status');
  if(!node){document.querySelector('main')?.insertAdjacentHTML('afterbegin','<p class="status-message" id="app-status" role="status"></p>');node=document.querySelector('#app-status');}
  if(node){node.hidden=false;node.textContent=message;}
}
function showError(error){
  const node=document.querySelector('#account-error')||document.querySelector('#profile-error');
  if(node)node.textContent=error.message||'عملیات انجام نشد.';else notify(error.message||'عملیات انجام نشد.');
  if(error.status===401&&!pendingSave){currentUser=null;members=[];Object.assign(clients,{activeId:null,profiles:[],records:[],difficulties:[]});void api.request('/auth/session').then(()=>showLogin()).catch(()=>{});}
}
async function persistPending(){
  const pending=pendingSave;if(!pending||pending.saving)return;
  pending.saving=true;
  try {
    const data=await api.request(`/children/${pending.childId}/sessions/${pending.run.id}/complete`,{method:'POST',body:{result:pending.result}});
    sessionRecordId=data.record.id;await refreshClients();pendingSave=null;
    const note=document.querySelector('.local-note');if(note)note.innerHTML=`${icon('check')} نتیجه در سرور مرکز ذخیره شد.`;
    document.querySelectorAll('.result-actions button').forEach(button=>button.disabled=false);
    if(data.record.kind==='training'&&!document.querySelector('.best-score'))document.querySelector('.result-main-score')?.insertAdjacentHTML('afterend',`<p class="best-score">بهترین امتیاز این سطح: <b>${fa(Math.max(...profileRecords(clients).filter(r=>r.kind==='training'&&resultKey(r.result)===resultKey(data.record.result)).map(r=>r.result.score)))} از ${fa(data.record.result.maxScore)}</b></p>`);
  }catch(error){
    pending.saving=false;const note=document.querySelector('.local-note');if(note)note.innerHTML=`<span>${icon('info')} نتیجه هنوز ثبت نشده: ${esc(error.message)} نتیجه تا بستن صفحه در حافظه می‌ماند.</span><button class="button subtle" data-action="retry-save">تلاش دوباره برای ثبت</button><button class="text-button" data-action="reauth">ورود دوباره با حساب اجراکننده</button>`;
  }
}
async function account(){
  if(!currentUser)return showLogin();await refreshClients();let parents=[];
  if(currentUser.role!=='parent'){members=(await api.request('/users')).users;if(clients.activeId)parents=(await api.request(`/children/${clients.activeId}/parents`)).users;}
  guideState=null;engine=null;route='account';setHash('#account');if(modal.open)modal.close();page(accountView(currentUser,members,clients.profiles,parents,clients.activeId),'content-main account-main');
}
function showInvitation(data){
  document.querySelector('#invitation-result').innerHTML=`<section class="surface invitation-card"><h2>لینک آماده است</h2><label>لینک یک‌بارمصرف<input id="invitation-url" readonly dir="ltr" value="${esc(data.url)}"></label><button class="button subtle" data-action="copy-invitation">کپی لینک</button><p>اعتبار تا ${new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.expiresAt))}</p></section>`;
}
async function previewLegacy(documentData){
  previewImport=await api.request('/imports/preview',{method:'POST',body:{document:documentData}});
  document.querySelector('#import-preview').innerHTML=importPreviewView(previewImport,clients.profiles,members,currentUser);
}
async function commitLegacy(){
  if(!previewImport?.id)return;
  const mapping=[...document.querySelectorAll('.import-mapping')].map(row=>({sourceId:row.dataset.source,targetId:row.querySelector('[name="targetId"]').value||null,therapistId:row.querySelector('[name="therapistId"]')?.value||null}));
  const data=await api.request('/imports/commit',{method:'POST',body:{previewId:previewImport.id,mapping}});previewImport=null;await refreshClients();await account();notify(`${fa(data.createdProfiles)} پرونده و ${fa(data.importedRecords)} نتیجه منتقل شد.`);
}
window.addEventListener('beforeunload',event=>{if(pendingSave){event.preventDefault();event.returnValue='';}});
await initialize();
