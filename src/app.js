import { GAMES, GAME_MAP, LEVELS, THEMES, COLOR_NAMES } from './config.js';
import { FACTORIES } from './games/index.js';
import { STROOP_RULES } from './games/stroop.js';
import { readProgress, writeProgress, resultKey } from './core/storage.js';
import { activeProfile, readClients, writeClients, profileRecords, latestBaseline, validateProfile, uid, addRecord, deleteProfile, escapeHTML as esc, variantOf } from './core/clients.js';
import { recommendLevel } from './core/reports.js';
import { profileStrip, profilesView, reportsView, variantLabel } from './client-ui.js';
import { icon, logo, art, heroArt, symbol, equipment, trophyArt, sceneBackground, huntBackground } from './visuals.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const announcer = document.querySelector('#announcer');
const progress = readProgress();
const clients = readClients();
let pendingStart = null, sessionIsBaseline = false, editingProfile = null;
const reportState = { tab: 'therapist', game: '', level: '', variant: '', kind: 'training', recordId: null };
const fa = value => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value);
const time = ms => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${fa(Math.floor(seconds / 60)).padStart(2, '۰')}:${fa(seconds % 60).padStart(2, '۰')}`; };
const shapeNames = { star: 'ستاره', circle: 'دایره', triangle: 'مثلث', square: 'مربع', diamond: 'لوزی', heart: 'قلب', fish: 'ماهی', butterfly: 'پروانه', bird: 'پرنده' };
const describe = stimulus => `${stimulus.shape.startsWith('letter-') ? `حرف ${stimulus.shape.slice(7)}` : stimulus.shape.startsWith('digit-') ? `عدد ${stimulus.shape.slice(6)}` : shapeNames[stimulus.shape] || 'شکل'} ${COLOR_NAMES[stimulus.color] || ''}${[' بدون علامت', ' با یک نقطه', ' با یک خط', ' با دو نقطه'][stimulus.detail || 0]}`;
let route = 'home', selectedGame = 'hunt', selectedLevel = 'easy', selectedTheme = 'star', selectedHuntMode = 'standard', selectedLayout = 'grid', selectedTrafficMode = 'circles', selectedMaterial = 'shapes', filter = 'all';
let engine = null, frame = 0, arenaKey = '', modalKind = '', audioContext;

function header() {
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="#" data-action="home" aria-label="حواس، صفحهٔ اصلی">${logo()}<span>حواس<small>ماجراجویی‌های ذهنی</small></span></a><nav aria-label="منوی اصلی"><button class="nav-link ${route === 'home' ? 'active' : ''}" data-action="games">بازی‌ها <span class="nav-count">۷</span></button><button class="nav-link" data-action="about">چطور بازی کنیم؟</button><button class="nav-link report-nav" data-action="dashboard">گزارش‌ها</button></nav><div class="header-end"><button class="profile-button" data-action="profiles">${activeProfile(clients) ? esc(activeProfile(clients).firstName) : 'ثبت مراجع'}</button><button class="icon-button sound-button" data-action="sound" aria-label="${progress.sound ? 'خاموش‌کردن صدا' : 'روشن‌کردن صدا'}" aria-pressed="${progress.sound}">${icon(progress.sound ? 'sound' : 'mute')}</button></div></div></header>`;
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
  pendingStart = null; engine = null; route = 'home'; if (modal.open) modal.close(); if (updateHash) setHash('');
  document.title = 'حواس — ماجراجویی‌های ذهنی';
  page(`<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="tiny-spark">✳</span> به دنیای حواس خوش اومدی</div><h1>یک بازی کوچک،<br>یک ذهن <span class="highlight">آماده‌تر.<svg viewBox="0 0 250 15" aria-hidden="true"><path d="M3 10Q120-3 246 8"/></svg></span></h1><p class="hero-description">کشف کن، به خاطر بسپار و با دقت انتخاب کن.<br>اینجا هر بازی، یک ماجراجویی تازه برای ذهن توئه.</p><div class="hero-actions"><button class="button primary" data-action="games">بزن بریم بازی ${icon('arrow')}</button><button class="text-button" data-action="about">${icon('play')} چطور بازی کنیم؟</button></div><div class="hero-facts"><span><b>۷</b> بازی متفاوت</span><i></i><span><b>۳</b> سطح چالش</span><i></i><span>${icon('check')} پروندهٔ شخصی تمرین</span></div></div><div class="hero-picture">${heroArt()}<div class="hero-caption"><span class="status-dot"></span> هر بار بازی، یک قدم رو به جلو</div></div></section>
    ${profileStrip(clients)}<section class="library" id="games" aria-labelledby="library-heading"><div class="section-heading"><div><div class="section-kicker">یک چالش تازه انتخاب کن</div><h2 id="library-heading">امروز کدوم ماجراجویی؟ ${icon('spark')}</h2></div><p>از هر جا دوست داری، شروع کن.</p></div><div class="filter-bar" role="group" aria-label="دسته‌بندی بازی‌ها">${[['all','همهٔ بازی‌ها'],['attention','توجه و تمرکز'],['memory','حافظه'],['speed','سرعت واکنش']].map(([id,label]) => `<button class="filter ${filter === id ? 'selected' : ''}" data-action="filter" data-filter="${id}" aria-pressed="${filter === id}">${label}${id === 'all' ? '<span>۷</span>' : ''}</button>`).join('')}<span class="filter-note">همهٔ بازی‌ها برای تو بازه ${icon('check')}</span></div><div class="game-grid" id="game-grid">${gameCards()}</div></section>
    <section class="little-note"><span class="note-symbol">${icon('spark')}</span><div><h3>برای بهترشدن، لازم نیست عجله کنی.</h3><p>از سطح آسان شروع کن، قانون بازی رو یاد بگیر و از مسیر لذت ببر.</p></div><span class="note-doodle">✳</span></section>`, 'home-main');
}
function gameCards() {
  const shown = GAMES.filter(game => filter === 'all' || game.tags.includes(filter));
  return shown.map((game, index) => {
    const records = profileRecords(clients).filter(item => item.kind === 'training' && item.result.gameId === game.id);
    return `<button class="game-card" data-action="open" data-game="${game.id}" style="--card-color:${game.color};--card-accent:${game.accent};--card-index:${index}"><div class="card-picture"><span class="card-number">${fa(GAMES.indexOf(game) + 1).padStart(2, '۰')}</span>${art(game.id)}${records.length ? `<span class="played-badge">${icon('check')} بازی کردی</span>` : ''}</div><div class="card-content"><span class="skill-label">${game.skill}</span><h3>${game.title}</h3><p>${game.subtitle}</p><div class="card-bottom"><span>${icon('clock')} ${game.time}</span><span class="card-arrow" aria-hidden="true">${icon('arrow')}</span></div></div></button>`;
  }).join('') + (filter === 'all' ? `<div class="routine-card"><span class="routine-flower">✳</span><span class="section-kicker">یک یادآوری کوچولو</span><h3>هر روز،<br>چند دقیقه برای ذهنت.</h3><p>یک بازی رو انتخاب کن.<br>شاید امروز رکورد تازه‌ای بزنی!</p><button class="text-button" data-action="about">راهنمای شروع ${icon('arrow')}</button><span class="routine-dots">● ● ●</span></div>` : '');
}

function taskOptions(game) {
  if (game.id==='hunt') return `<fieldset class="theme-selector"><legend>تمرین کدام نوع توجه؟</legend><div class="theme-options">${[['standard','یک هدف · توجه پایدار'],['divided','دو هدف · توجه تقسیم‌شده']].map(([mode,label])=>`<button class="theme-button hunt-mode ${selectedHuntMode===mode?'selected':''}" data-action="hunt-mode" data-mode="${mode}" aria-pressed="${selectedHuntMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت دوهدفه، به هر کدام از دو نمونه پاسخ بده؛ مجموع هدف‌ها همچنان ۳۰ تاست.</p></fieldset>`;
  if (game.id==='traffic') return `<fieldset class="theme-selector"><legend>با کدام نشانه بازی کنیم؟</legend><div class="theme-options">${[['circles','دایره‌های قرمز و سبز'],['signs','ورود ممنوع و یک‌طرفه']].map(([mode,label])=>`<button class="theme-button ${selectedTrafficMode===mode?'selected':''}" data-action="traffic-mode" data-mode="${mode}" aria-pressed="${selectedTrafficMode===mode}">${label}</button>`).join('')}</div></fieldset>`;
  if (game.id==='nback') return materialOptions('حافظه را با چی تمرین کنیم؟', [['shapes','شکل‌ها'],['numbers','اعداد'],['toys','اسباب‌بازی‌ها']]);
  if (game.id==='search') return `<fieldset class="theme-selector"><legend>چیدمان شکل‌ها</legend><div class="theme-options">${[['grid','منظم'],['scattered','پراکنده']].map(([layout,label])=>`<button class="theme-button layout-button ${selectedLayout===layout?'selected':''}" data-action="search-layout" data-layout="${layout}" aria-pressed="${selectedLayout===layout}">${label}</button>`).join('')}</div></fieldset>${materialOptions('نوع محرک', [['shapes','شکل‌ها'],['letters','حروف انگلیسی']])}`;
  return '';
}
function materialOptions(title, choices) {
  return `<fieldset class="theme-selector"><legend>${title}</legend><div class="theme-options">${choices.map(([id,label])=>`<button class="theme-button ${selectedMaterial===id?'selected':''}" data-action="material" data-material="${id}" aria-pressed="${selectedMaterial===id}">${label}</button>`).join('')}</div></fieldset>`;
}
function currentVariant() {
  if (selectedGame === 'hunt') return selectedHuntMode;
  if (selectedGame === 'traffic') return selectedTrafficMode === 'signs' ? 'signs' : 'standard';
  if (selectedGame === 'nback') return ['numbers','toys'].includes(selectedMaterial) ? selectedMaterial : 'standard';
  if (selectedGame === 'search') return [selectedMaterial === 'letters' ? 'letters' : '', selectedLayout === 'scattered' ? 'scattered' : ''].filter(Boolean).join('-') || 'standard';
  return 'standard';
}
function assessmentInfo() {
  const baseline = latestBaseline(clients, selectedGame, currentVariant());
  const last = profileRecords(clients).filter(r=>r.result.gameId===selectedGame && variantOf(r.result)===currentVariant()).at(-1)?.result;
  return `<div class="assessment-info"><b>${baseline ? 'ارزیابی پایه انجام شده' : 'شروع با ۵ تمرین و ارزیابی پایه'}</b><p>${last ? `سطح پیشنهادی: ${LEVELS[recommendLevel(last).level].label}. ${recommendLevel(last).reason}` : 'اول قانون را یاد می‌گیری؛ سپس براساس دقت، سرعت، خطاها و پاسخ‌های متوالی، یک سطح قابل‌تغییر پیشنهاد می‌شود.'}</p>${baseline ? '<button class="text-button" data-action="baseline">تکرار ارزیابی پایه</button>' : ''}</div>`;
}
function detail(id, updateHash = true) {
  if (!GAME_MAP[id]) return home();
  if (selectedGame !== id) selectedMaterial = 'shapes';
  engine = null; route = 'detail'; selectedGame = id; if (modal.open) modal.close(); if (updateHash) setHash(`#${id}`);
  const game = GAME_MAP[id]; document.title = `${game.title} — حواس`;
  page(`<div class="breadcrumb"><button data-action="home">بازی‌ها</button>${icon('chevron')}<span>${game.title}</span></div><section class="intro-layout"><div class="intro-copy"><div class="eyebrow">${icon('spark')} ${game.skill}</div><h1>${game.title}</h1><p class="intro-description">${game.description}</p><ol class="rules">${game.rules.map((rule,i) => `<li><span>${fa(i+1)}</span><p>${rule}</p></li>`).join('')}</ol><fieldset class="level-selector"><legend>چالش امروزت چقدر باشه؟</legend><div class="levels">${Object.entries(LEVELS).map(([id,level],i) => `<button class="level-button ${selectedLevel === id ? 'selected' : ''}" data-action="level" data-level="${id}" aria-pressed="${selectedLevel === id}"><span class="level-bars" aria-hidden="true">${[0,1,2].map(j=>`<i class="${j<=i?'lit':''}"></i>`).join('')}</span><b>${level.label}</b><small>${level.caption}</small></button>`).join('')}</div></fieldset>${id === 'hunt' ? `<fieldset class="theme-selector"><legend>با چی بازی کنیم؟</legend><div class="theme-options">${Object.entries(THEMES).map(([key,label]) => `<button class="theme-button ${key===selectedTheme?'selected':''}" data-action="theme" data-theme="${key}" aria-pressed="${key===selectedTheme}">${label}</button>`).join('')}</div></fieldset>` : ''}${taskOptions(game)}${assessmentInfo()}<div class="start-row"><button class="button primary" data-action="practice">بریم تمرین کنیم ${icon('arrow')}</button><span>${icon('info')} ۵ تمرین؛ ارزیابی جدا از امتیاز اصلی</span></div></div><aside class="intro-art" style="--card-color:${game.color}"><div class="intro-art-bubble">${art(id)}</div><div class="intro-art-note">${icon('target')} <span>یک قانون ساده، یک چالش جذاب</span></div><div class="session-summary" id="session-summary">${levelSummary(game)}</div></aside></section>`, 'content-main');
}
function levelSummary(game) {
  const l = LEVELS[selectedLevel];
  if (game.kind === 'reaction') return `<span><b>۱۵۰</b> نوبت بازی</span><span><b>${fa(l.visibleMs)}</b> میلی‌ثانیه نمایش</span>`;
  if (game.kind === 'search') return `<span><b>۱۰</b> دور جست‌وجو</span><span><b>${fa(l.searchSeconds)}</b> ثانیه برای هر دور</span>`;
  return `<span><b>${fa(l.required)}</b> وسیلهٔ ضروری</span><span><b>${fa(l.seconds)}</b> ثانیه فرصت</span>`;
}

function start(practice, forceBaseline = false) {
  if (!activeProfile(clients)) { pendingStart = { practice, forceBaseline }; return profiles(); }
  if (!practice && !latestBaseline(clients, selectedGame, currentVariant())) practice = true;
  sessionIsBaseline = practice && (forceBaseline || !latestBaseline(clients, selectedGame, currentVariant()));
  if (modal.open) modal.close();
  route = 'play'; engine = FACTORIES[selectedGame]({ level: selectedLevel, theme: selectedTheme, targetCount: selectedHuntMode==='divided'?2:1, layout: selectedLayout, trafficMode: selectedTrafficMode, material: selectedMaterial, practice }); arenaKey = '';
  const game = GAME_MAP[selectedGame];
  page(`<div class="play-heading"><div><span class="section-kicker">${practice ? sessionIsBaseline ? '۵ تمرین برای آموزش و ارزیابی پایه' : 'وقت تمرینه؛ امتیازت ثبت نمی‌شه' : 'نوبت ماجراجویی توئه'}</span><h1>${game.title}<span class="level-pill">${LEVELS[selectedLevel].label}</span></h1></div><button class="button subtle pause-button" data-action="pause">${icon('pause')} توقف</button></div><section class="play-panel ${game.kind}" aria-label="محیط بازی"><div class="play-hud"><div><span id="progress-label"></span><b id="position"></b></div><div class="hud-time">${icon('clock')}<div><span id="time-label"></span><b id="time"></b></div></div><div><span>پاسخ‌های هدف درست</span><b id="hits">۰</b></div></div><div class="progress-track"><span id="progress-fill"></span></div><div class="instruction-strip" id="instruction"></div><div id="arena" class="arena"></div><div class="play-controls" id="play-controls"></div><div id="feedback" class="feedback" role="status">با آرامش و دقت شروع کن؛ تو می‌تونی!</div></section><p class="play-footnote">${icon('info')} ${practice ? 'این بخش فقط برای یادگرفتن قانون بازیه.' : game.kind==='reaction' ? 'محرک کوتاه دیده می‌شه؛ تا شروع نوبت بعد فرصت پاسخ داری.' : 'عجله نکن؛ انتخاب درست، مهم‌تر از انتخاب سریعه.'}</p>`, 'play-main');
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
  const key = reaction ? `${engine.index}:${engine.gate}` : search ? `${engine.index}:${engine.preview}:${[...engine.rejected].join(',')}` : `${engine.judged}:${engine.items.map(i=>`${+i.collected}${+i.rejected}${+i.blocked}`).join('')}`;
  if (key !== arenaKey) { arenaKey = key; renderArena(game); }
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
    const {position,size}=engine.current;
    return `<div class="reaction-stage hunt-stage"><div class="stage-caption">هدف رو دیدی؟ روی خودش بزن یا از دکمهٔ پایین استفاده کن.</div><div class="hunt-surface">${huntBackground(engine.background)}<div class="stimulus-shell" style="left:${position.x}%;top:${position.y}%;--stimulus-size:${size}px">${tap}</div></div></div>`;
  }
  return `<div class="reaction-stage"><div class="stage-caption">${engine.current.scored===false?'این شکل رو فقط به خاطر بسپار':'خوب نگاه کن…'}</div><div class="focus-corners"><i></i><i></i><i></i><i></i><div class="stimulus-shell">${tap}</div></div><span class="stage-dots" aria-hidden="true">· · ·</span></div>`;
}
function searchBoard() {
  const scattered=engine.layout==='scattered';
  const style=scattered?`style="--scatter-columns:${engine.current.columns};--scatter-height:${engine.current.rows*78}px"`:'';
  return `<div class="search-grid ${selectedLevel} ${scattered?'scattered':''}" ${style}>${engine.current.choices.map((choice,i)=>`<button class="search-choice ${engine.rejected.has(i)?'rejected':''}" ${scattered?`style="left:${choice.position.x}%;top:${choice.position.y}%;--scatter-angle:${choice.angle}deg"`:''} data-action="search-choice" data-index="${i}" aria-label="گزینهٔ ${fa(i+1)}: ${describe(choice)}" ${engine.rejected.has(i)?'disabled':''}>${symbol(choice)}</button>`).join('')}</div>`;
}
function renderArena(game) {
  const arena = document.getElementById('arena'), controls = document.getElementById('play-controls'), instruction = document.getElementById('instruction');
  if (game.kind === 'reaction') {
    let cue, button;
    if (game.id === 'hunt') { cue = `<span class="target-examples">${engine.targets.map(target=>`<span class="target-mini">${symbol(target)}</span>`).join('')}</span><span>${engine.targets.length===2?'هدف‌های تو':'هدف تو'}: <b>${engine.targets.map(describe).join(' یا ')}</b></span>`; button = 'پیداش کردم'; }
    if (game.id === 'traffic' && selectedTrafficMode === 'signs') { cue = `${icon('target')}<span>یک‌طرفه: <b>حرکت کن</b> <i class="cue-divider"></i> ورود ممنوع: <b>صبر کن</b></span>`; button = 'حرکت!'; }
    else if (game.id === 'traffic') { cue = `${icon('target')}<span>سبز: <b>حرکت کن</b> <i class="cue-divider"></i> قرمز: <b>صبر کن</b></span>`; button = 'حرکت!'; }
    if (game.id === 'nback') { cue = `${icon('target')}<span>فقط اگر با <b>${fa(engine.n)} شکل قبل</b> یکسانه، پاسخ بده.</span>`; button = `مثل ${fa(engine.n)} تا قبله`; }
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
    instruction.innerHTML = `${icon(engine.preview ? 'info' : 'target')}<span>${engine.preview ? 'دو ثانیه فرصت داری؛ <b>شکل و علامتش رو به خاطر بسپار.</b>' : 'نمونه پنهان شده؛ <b>همون شکل رو پیدا کن.</b>'}</span>`;
    if (engine.preview) arena.innerHTML = `<div class="search-preview"><span class="section-kicker">این شکل رو یادت بمونه</span><div class="preview-symbol">${symbol(engine.current.target)}</div><span class="preview-description">${describe(engine.current.target)}</span><span class="preview-countdown">بعدش پیداش کن!</span></div>`;
    else arena.innerHTML = searchBoard();
    controls.innerHTML = `<span class="search-tip">${icon('info')} ${engine.preview ? 'هنوز گزینه‌ها نمایش داده نشدن.' : 'روی شکل درست بزن؛ به جزئیات دقت کن.'}</span>`;
  } else {
    instruction.innerHTML = `${icon('target')}<span>${engine.practice ? 'این وسیله برای سفر لازمه؟ <b>انتخاب کن یا «لازم نیست» رو بزن.</b>' : engine.ready ? '<b>کوله آماده‌ست! قبل از پایان زمان راهی شو.</b>' : `<b>${fa(engine.required.length)} وسیلهٔ ضروری</b> رو پیدا کن.${game.id==='space'?' اول موانع رو کنار بزن.':''}`}</span>`;
    const items = engine.practice ? [engine.currentItem] : engine.items;
    arena.innerHTML = `<div class="adventure-scene ${game.id} ${engine.practice?'practice-scene':''}">${sceneBackground(game.id)}<div class="scene-heading">${game.id==='space'?'ایستگاه فضایی حواس':'ساحل امید'} <span>${engine.practice?'آموزش انتخاب وسایل':'وسایل رو با دقت بررسی کن'}</span></div><div class="object-grid ${selectedLevel}">${items.map(item=>`<button class="scene-object ${item.collected?'collected':''} ${item.rejected?'rejected':''} ${item.blocked?'blocked':''}" data-action="item" data-index="${item.id}" aria-label="${item.blocked?'کنار زدن مانع':item.name}" ${item.collected||item.rejected?'disabled':''}>${equipment(item.blocked?'obstacle':item.icon)}<span>${item.blocked?'کنار بزن':item.name}</span>${item.blocked?'<b class="obstacle-plus">+</b>':''}</button>`).join('')}</div><div class="scene-vehicle">${art(game.id)}</div></div>`;
    controls.innerHTML = engine.practice ? `<button class="button subtle" data-action="reject-item" ${engine.currentItem.blocked?'disabled':''}>این وسیله لازم نیست ${icon('arrow')}</button>` : `<div class="inventory"><span>کولهٔ تو</span><div>${engine.required.map(([name],i)=>{ const item=engine.items.find(item=>item.icon===name&&item.collected); return `<span class="inventory-slot ${item?'filled':''}" title="${item?item.name:'هنوز پیدا نشده'}">${item?equipment(name):fa(i+1)}</span>`; }).join('')}</div></div><button class="button primary depart-button" data-action="depart" ${engine.ready?'':'disabled'}>${game.id==='space'?'پرتاب سفینه':'سوار کشتی شو'} ${icon('arrow')}</button>`;
  }
}

function finish() {
  const session = engine, result = session.result, game = GAME_MAP[selectedGame]; route = 'result';
  if (modal.open) modal.close();
  let persisted = true;
  if (!session.practice || sessionIsBaseline) { addRecord(clients, result, sessionIsBaseline ? 'baseline' : 'training'); persisted = writeClients(clients); }
  const recommendation = recommendLevel(result);
  if (sessionIsBaseline) selectedLevel = recommendation.level;
  const ratio = result.maxScore ? result.score/result.maxScore : 0;
  const stars = ratio>=.85?3:ratio>=.5?2:ratio>0?1:0;
  const title = session.practice ? sessionIsBaseline ? 'ارزیابی پایه کامل شد' : 'تمرین تموم شد، آماده‌ای؟' : !result.completed ? 'این سفر هنوز ادامه داره!' : ratio>=.85 ? 'چه تمرکز درخشانی!' : ratio>=.5 ? 'آفرین، خوب پیش رفتی!' : 'هر بار، یک قدم بهتر!';
  const caption = session.practice ? sessionIsBaseline ? 'نتیجهٔ این پنج تمرین جدا از بازی اصلی در پرونده ثبت شد. پیشنهاد سطح اولیه است و می‌توانی آن را تغییر بدهی.' : 'قانون بازی رو یاد گرفتی. حالا می‌تونی ماجراجویی اصلی رو شروع کنی.' : !result.completed ? 'زمان تموم شد. یک بار دیگه امتحان کن؛ حالا وسایل رو بهتر می‌شناسی.' : 'مهم‌ترین بخشش رو انجام دادی: با دقت بازی کردی. آمادهٔ یک چالش دیگه‌ای؟';
  page(`<section class="result-card">${trophyArt()}<div class="eyebrow">${session.practice?'۵ تمرین آموزشی':'پایان بازی'} <span>·</span> ${game.title}</div><h1>${title}</h1><p class="result-caption">${caption}</p>${!session.practice?`<div class="result-stars" aria-label="${fa(stars)} ستاره از ۳">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">★</span>`).join('')}</div>`:''}<div class="result-main-score"><b>${fa(result.score)}</b><span>از ${fa(result.maxScore)} ${session.practice?'پاسخ هدف':'امتیاز'}</span></div><div class="result-stats"><div>${icon('check')}<b>${fa(result.hits)}</b><span>انتخاب هدف درست</span></div><div>${icon('target')}<b>${fa(result.falseSelections)}</b><span>انتخاب اشتباه</span></div><div>${icon('info')}<b>${fa(result.omissions)}</b><span>هدف بدون پاسخ</span></div><div>${icon('clock')}<b>${time(result.durationMs)}</b><span>زمان فعال بازی</span></div><div>${icon('check')}<b>${fa(result.longestStreak)}</b><span>تصمیم درست متوالی</span></div>${game.kind==='reaction'?`<div>${icon('pause')}<b>${fa(result.correctRejections)}</b><span>خودداری درست از پاسخ</span></div>`:''}${result.meanReactionMs!==null?`<div>${icon('spark')}<b>${fa(result.meanReactionMs)} <small>ms</small></b><span>${result.reactionMeasure==='decision-interval'?'میانگین زمان انتخاب درست':'میانگین واکنش درست'}</span></div>`:''}</div>${game.kind==='reaction'?'<p class="score-note">امتیاز = هدف‌های درست، منهای انتخاب‌های اشتباه؛ حداقل صفر.</p>':''}${!session.practice || sessionIsBaseline?`<p class="local-note">${icon('check')} نتیجهٔ این بازی فقط در مرورگر تو نگهداری می‌شه.</p>`:''}<div class="result-actions"><button class="button primary" data-action="${session.practice?'main-game':'replay'}">${session.practice?'بزن بریم بازی اصلی':'دوباره بازی کن'} ${icon(session.practice?'arrow':'repeat')}</button><button class="button subtle" data-action="${session.practice?'detail':'home'}">${session.practice?'برگشت به راهنما':'انتخاب بازی دیگه'}</button></div></section>`, 'result-main');
  if (!session.practice || sessionIsBaseline) {
    const note = document.querySelector('.local-note');
    if (!persisted) note.innerHTML = `${icon('info')} ذخیره‌سازی مرورگر در دسترس نیست؛ همچنان می‌تونی بازی کنی.`;
    const best = profileRecords(clients).filter(r=>r.kind==='training' && resultKey(r.result)===resultKey(result)).map(r=>r.result).sort((a,b)=>b.score-a.score)[0];
    if (Number.isFinite(best?.score)) document.querySelector('.result-main-score').insertAdjacentHTML('afterend', `<p class="best-score">${icon('trophy')} بهترین امتیاز تو در سطح ${LEVELS[result.level].label}: <b>${fa(best.score)} از ${fa(best.maxScore)}</b></p>`);
  }
  if(result.variant && result.variant!=='standard')document.querySelector('.result-caption').insertAdjacentHTML('afterend',`<span class="variant-note">${variantLabel(result.variant)}</span>`);
  document.querySelector('.result-actions').insertAdjacentHTML('beforebegin', `<div class="level-recommendation"><b>سطح پیشنهادی ${sessionIsBaseline?'برای شروع':'برای نوبت بعد'}: ${LEVELS[recommendation.level].label}</b><p>${recommendation.reason}</p><button class="text-button" data-action="recommended-level" data-level="${recommendation.level}">انتخاب سطح و دیدن راهنما ←</button></div>`);
  document.querySelector('.result-actions').insertAdjacentHTML('beforeend','<button class="text-button" data-action="dashboard">دیدن پرونده و گزارش‌ها</button>');
  announcer.textContent = title;
}

function openModal(content, kind) {
  if (modal.open) modal.close(); modalKind=kind; modal.innerHTML = content; modal.showModal();
}
function about() {
  if (route==='play' && engine && !engine.paused) engine.pause();
  openModal(`<button class="modal-close icon-button" data-action="close-modal" aria-label="بستن راهنما">${icon('close')}</button><span class="big-spark">✳</span><h2 id="modal-title">بازی کنیم، کشف کنیم!</h2><p>حواس یک مجموعهٔ هفت‌تایی از بازی‌های توجه و حافظه‌ست. برای هر مراجع یک پروندهٔ محلی می‌سازی؛ تمرین‌ها و نتیجه‌های هر نفر جدا ثبت می‌شوند.</p><ol class="modal-steps"><li><b>۱</b><span>مشخصات مراجع را ثبت کن و یک بازی انتخاب کن.</span></li><li><b>۲</b><span>با ۵ تمرین کوتاه، قانون را یاد بگیر و ارزیابی پایه را انجام بده.</span></li><li><b>۳</b><span>بازی کن و نتیجهٔ خودت رو ببین.</span></li></ol><p class="modal-small">روی گوشی با لمس بازی کن؛ روی کامپیوتر از ماوس و در بازی‌های واکنشی از کلید فاصله استفاده کن. صدا رو هم می‌تونی از بالای صفحه روشن کنی.</p><button class="button primary full-width" data-action="close-modal">فهمیدم ${icon('check')}</button>`, 'about');
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

function profiles(editId = null, notice = '') {
  engine = null; route = 'profiles'; editingProfile = editId;
  if (modal.open) modal.close(); setHash('#profiles'); document.title = 'پروندهٔ مراجعان — حواس';
  page(profilesView(clients, editId, notice), 'content-main clients-main');
}
function continueAfterProfile() {
  if (pendingStart) { const next = pendingStart; pendingStart = null; return start(next.practice, next.forceBaseline); }
  return home();
}
function dashboard() {
  engine = null; route = 'reports'; if (modal.open) modal.close(); setHash('#reports');
  document.title = 'گزارش تمرین‌ها — حواس';
  page(reportsView(clients, reportState), 'content-main reports-main');
}
function confirmDeleteProfile(id) {
  const p = clients.profiles.find(p=>p.id===id); if (!p) return;
  openModal(`<h2 id="modal-title">حذف پروندهٔ ${esc(p.firstName)}</h2><p>مشخصات و تمام ${fa(profileRecords(clients,id).length)} نتیجهٔ این مراجع از این مرورگر حذف می‌شوند. پیش از حذف می‌توانی از گزارش‌ها خروجی بگیری.</p><div class="modal-buttons"><button class="button danger-button" data-action="confirm-delete-profile" data-id="${esc(id)}">حذف پرونده و نتیجه‌ها</button><button class="button subtle" data-action="close-modal">انصراف</button></div>`, 'delete-profile');
}
function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportProfile() {
  const profile = activeProfile(clients); if (!profile) return;
  download(JSON.stringify({ version:1, exportedAt:new Date().toISOString(), profile, records:profileRecords(clients) },null,2),'application/json;charset=utf-8','havaas-profile.json');
}
function exportTrials() {
  const records = profileRecords(clients).filter(r=>(!reportState.game || r.result.gameId===reportState.game) && (!reportState.level || r.result.level===reportState.level) && (!reportState.variant || variantOf(r.result)===reportState.variant) && (!reportState.kind || r.kind===reportState.kind));
  const record = records.find(r=>r.id===reportState.recordId) || records.at(-1); if (!record) return;
  const rows = [['ردیف','محرک هدف','پاسخ داده شد','درست','زمان پاسخ میلی‌ثانیه','زمان فعال میلی‌ثانیه','وسیله','دور','مرحله'],...(record.result.outcomes || []).map(o=>[o.number,o.target,o.response,o.correct,o.reactionMs ?? '',o.atMs,o.item || '',o.round || '',o.phase===undefined?'':o.phase+1])];
  download('\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8','havaas-responses.csv');
}
app.addEventListener('submit', event=>{
  if(event.target.id!=='profile-form')return;
  event.preventDefault(); const form=event.target;
  const input=Object.fromEntries(['firstName','lastName','birthDate','grade','school','concerns'].map(name=>[name,form.querySelector(`[name="${name}"]`).value]));
  const validation=validateProfile(input);
  if(validation.error) { document.querySelector('#profile-error').textContent=validation.error;return; }
  const existing=clients.profiles.find(p=>p.id===editingProfile);
  if(existing) Object.assign(existing,validation.profile);
  else { const profile={...validation.profile,id:uid(),createdAt:new Date().toISOString()};clients.profiles.push(profile);clients.activeId=profile.id; }
  const saved=writeClients(clients);
  if(pendingStart)return continueAfterProfile();
  profiles(null,saved?'مشخصات ذخیره شد؛ از فهرست، مراجع را انتخاب کن و ادامه بده.':'ذخیره‌سازی مرورگر در دسترس نیست؛ پرونده فقط تا زمان بستن یا نوسازی این صفحه باقی می‌ماند.');
});
app.addEventListener('change',event=>{
  if(event.target.id==='report-profile') {
    if(!clients.profiles.some(p=>p.id===event.target.value))return;
    clients.activeId=event.target.value;reportState.recordId=null;writeClients(clients);dashboard();
  }
  const filter=event.target.dataset.reportFilter;
  if(['game','level','variant','kind'].includes(filter)) {reportState[filter]=event.target.value;reportState.recordId=null;dashboard();}
});
function handleAction(event) {
  const button = event.target.closest('[data-action]'); if(!button||button.disabled) return;
  const action=button.dataset.action;
  if(button.tagName==='A') event.preventDefault();
  if(action==='home') return home();
  if(action==='profiles') return profiles();
  if(action==='dashboard') return dashboard();
  if(action==='select-profile') { if(!clients.profiles.some(p=>p.id===button.dataset.id))return; clients.activeId=button.dataset.id; writeClients(clients); return continueAfterProfile(); }
  if(action==='edit-profile') return profiles(button.dataset.id);
  if(action==='delete-profile') return confirmDeleteProfile(button.dataset.id);
  if(action==='confirm-delete-profile') { deleteProfile(clients,button.dataset.id); const saved=writeClients(clients); modal.close(); return profiles(null,saved?'پرونده و همهٔ نتیجه‌های آن حذف شد.':'پرونده از این جلسه حذف شد؛ ذخیره‌سازی مرورگر در دسترس نیست.'); }
  if(action==='report-tab') { reportState.tab=button.dataset.tab; return dashboard(); }
  if(action==='select-record') { reportState.recordId=button.dataset.id; return dashboard(); }
  if(action==='print-report') return window.print();
  if(action==='export-profile') return exportProfile();
  if(action==='export-trials') return exportTrials();
  if(action==='recommended-level') { selectedLevel=button.dataset.level; return detail(selectedGame); }
  if(action==='baseline') return start(true,true);
  if(action==='games') { if(route!=='home') home(); requestAnimationFrame(()=>document.querySelector('#games')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})); return; }
  if(action==='about') return about();
  if(action==='close-modal'||action==='resume') return closeModal();
  if(action==='sound') { progress.sound=!progress.sound; writeProgress(progress); document.querySelectorAll('.sound-button').forEach(node=>{ node.innerHTML=icon(progress.sound?'sound':'mute');node.setAttribute('aria-pressed',String(progress.sound));node.setAttribute('aria-label',progress.sound?'خاموش‌کردن صدا':'روشن‌کردن صدا'); }); tone(true); return; }
  if(action==='open') return detail(button.dataset.game);
  if(action==='detail') return detail(selectedGame);
  if(action==='filter') { filter=button.dataset.filter; document.querySelectorAll('.filter').forEach(node=>{ const selected=node.dataset.filter===filter; node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); document.querySelector('#game-grid').innerHTML=gameCards(); return; }
  if(action==='level'&&LEVELS[button.dataset.level]) { selectedLevel=button.dataset.level; document.querySelectorAll('.level-button').forEach(node=>{ const selected=node.dataset.level===selectedLevel;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); document.querySelector('#session-summary').innerHTML=levelSummary(GAME_MAP[selectedGame]); return; }
  if(action==='theme'&&THEMES[button.dataset.theme]) { selectedTheme=button.dataset.theme; document.querySelectorAll('.theme-button').forEach(node=>{ const selected=node.dataset.theme===selectedTheme;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); return; }
  if(action==='hunt-mode'&&['standard','divided'].includes(button.dataset.mode)) { selectedHuntMode=button.dataset.mode;document.querySelectorAll('.hunt-mode').forEach(node=>{const selected=node.dataset.mode===selectedHuntMode;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='traffic-mode') { selectedTrafficMode=button.dataset.mode==='signs'?'signs':'circles'; return detail(selectedGame,false); }
  if(action==='material' && ['shapes','letters','numbers','toys'].includes(button.dataset.material)) { selectedMaterial=button.dataset.material; return detail(selectedGame,false); }
  if(action==='search-layout'&&['grid','scattered'].includes(button.dataset.layout)) { selectedLayout=button.dataset.layout;document.querySelectorAll('.layout-button').forEach(node=>{const selected=node.dataset.layout===selectedLayout;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='practice') return start(true);
  if(action==='main-game'||action==='replay') return start(false);
  if(action==='pause') return pause();
  if(action==='restart') return start(engine?.practice ?? false);
  if(route!=='play'||!engine||modal.open) return;
  if(action==='respond') answer(engine.respond());
  if(action==='stimulus-response') answer(engine.respondToStimulus(Number(button.dataset.trial)));
  if(action==='search-choice') answer(engine.choose(Number(button.dataset.index)));
  if(action==='item') answer(engine.choose(Number(button.dataset.index)));
  if(action==='reject-item') answer(engine.reject());
  if(action==='depart') { tone(engine.depart()); updatePlay(); }
  if(action==='acknowledge') { engine.acknowledge(); arenaKey=''; updatePlay(); }
}
app.addEventListener('click', handleAction);
app.addEventListener('pointerdown',event=>{
  if(route!=='play'||!engine||modal.open||event.isPrimary===false||event.button!==0)return;
  const button=event.target.closest('[data-action="stimulus-response"]');
  if(button) {event.preventDefault();answer(engine.respondToStimulus(Number(button.dataset.trial)));}
});
modal.addEventListener('click', handleAction);
modal.addEventListener('cancel', event=>{ event.preventDefault(); closeModal(); });
document.addEventListener('keydown', event=>{
  if(event.key==='Escape'&&route==='play'&&!modal.open) { event.preventDefault(); pause(); }
  if(event.code==='Space'&&route==='play'&&!modal.open&&GAME_MAP[selectedGame].kind==='reaction') {
    event.preventDefault(); if(!event.repeat) answer(engine.respond());
  }
});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden&&route==='play'&&engine&&!engine.paused) { if(modal.open) { engine.pause(); } else pause(); } });
window.addEventListener('popstate',()=>{ const id=location.hash.slice(1); if(id==='profiles')profiles();else if(id==='reports')dashboard();else if(GAME_MAP[id]) detail(id,false); else home(false); });
if(location.hash==='#profiles')profiles();else if(location.hash==='#reports')dashboard();else if(GAME_MAP[location.hash.slice(1)]) detail(location.hash.slice(1),false); else home(false);
