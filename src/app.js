import {getLocale,setLocale,languageSelector} from './i18n.js';
import {numberLocale} from './i18n.js';
import {t as uiText,lt} from './i18n.js';
import {createFormTracker} from './pwa-forms.js';
import {themeSelector} from './theme-ui.js';
import {PlatformMotion,platformTheme} from './platform-motion.js';
import {sectionArt} from './platform-art.js';
import {profileFamilies,profileEntry,validateProfileSettings} from './training-profiles.js';
import {gameSettingsView,trainingProfilesList,trainingProfileEditor,profileAssignmentOptions,profileAssignmentSummary} from './training-profile-ui.js';
import {timingIdentity,defaultTiming,TIMING_VARIANTS,timingFields,timingPath} from './game-timing.js';
import {createNavigationGuard,handleTabKey} from './navigation-guard.js';
import {createHistoryNavigation} from './history-navigation.js';
import {auditView,syncAuditDate,auditDateField} from './audit-ui.js';
import { ApiClient,ApiError } from './api.js';
import {setupPwa} from './pwa.js';
import {syncBirthDate,birthDateField} from './birth-date.js';
import {copyTextField} from './clipboard.js';
import { preloadWorld,worldBackground,gameArtwork } from './worlds.js';
import { GuidancePlayer, guidanceKey, lessonGuidanceKey } from './guidance.js';
import {memoryLessonState,memoryLessonView,stroopRulePicture} from './learning-ui.js';
import {capturePlayFocus,restorePlayFocus,moveFieldFocus,syncHuntFocus} from './play-input.js';
import {PlayMotion,animalPose,captureMotionSource,sceneAtmosphere} from './play-motion.js';
import { arkScene } from './ark-ui.js';
import { spaceScene } from './space-ui.js';
import { trafficScene } from './traffic-ui.js';
import { trafficOutcome } from './traffic-art.js';
import { searchOutcomeArt } from './search-art.js';
import { memoryOutcomeArt } from './nback-art.js';
import { stroopOutcomeArt } from './stroop-art.js';
import { huntOutcomeArt } from './hunt-art.js';
import { huntScene,huntTargetCue,huntControls,huntDisplayPosition } from './hunt-ui.js';
import { stroopScene,stroopControls } from './stroop-ui.js';
import { memoryStage,memoryRule,memoryControls } from './nback-ui.js';
import { searchWorkspaceHeading,searchPreview,searchChoices,searchMemoryNote } from './search-ui.js';
import { huntPosition,huntOnScreen } from './games/hunt.js';
import { accountView, loginView, importPreviewView, roleName, reportLinksView, passwordView } from './account-ui.js';
import {adminShell,adminOverview,adminUsersView,createUserView,registrationView,invitationsView,userDetailsView,clientWelcome} from './dashboard-ui.js';
import { seededRandom } from './core/random.js';
import { ActiveClock } from './core/session.js';
import { preparationView, countdownView, reviewView, transitionView, stroopStages, trafficRoad, missionChecklist, searchTargetStatus, searchRounds, huntBlocks, learningRecap, roundBreakView, guideControl, trafficProgress, trafficRulePicture, stroopScorecard, missionInventory } from './play-ui.js';
import { GAMES, GAME_MAP, GAME_PROTOCOLS, LEVELS, THEMES, HUNT_SETTINGS, reactionTiming, RULE_NOTICE_MS, EXPERIENCE_VERSION } from './config.js';
import { FACTORIES } from './games/index.js';
import { searchVariant } from './games/search.js';
import { assessmentSteps, nextAssessmentGame } from './core/assessment.js';
import { createLesson } from './lessons.js';
import { STROOP_RULES,stroopRules } from './games/stroop.js';
import { readProgress, writeProgress } from './core/storage.js';
import { activeProfile, readClients, profileRecords, latestBaseline, validateProfile, escapeHTML as esc, variantOf } from './core/clients.js';
import { describeStimulus } from './stimuli.js';
import { recommendLevel, comparableRecords, needsMorePractice } from './core/reports.js';
import { reportsView, assessmentView, variantLabel } from './client-ui.js';
import { icon, logo, art, heroArt, symbol, equipment, trophyArt, huntBackground, missionOutcomeArt } from './visuals.js';

setLocale(getLocale());
let pendingLocale=null;
let localeChangeAttempt=null;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const announcer = document.querySelector('#announcer');
const playMotion=new PlayMotion({document});
const platformMotion=new PlatformMotion({document});
const progress = readProgress();
const guidance=new GuidancePlayer({onState:(state,key)=>{
  document.querySelectorAll('[data-action=listen-guide]').forEach(button=>{const active=state==='playing'&&(button.dataset.guide===key||button.dataset.guide==='current');button.setAttribute('aria-pressed',String(active));button.classList.toggle('listening',active);});
  document.querySelectorAll('.audio-guide-status').forEach(node=>{node.textContent=state==='unavailable'?uiText('صدا پخش نشد؛ دوباره دکمهٔ بشنو را بزن.'):state==='playing'?uiText('در حال پخش راهنمای صوتی'):'';});
}});
const clients = {version:1,activeId:null,profiles:[],records:[],difficulties:[]};
const api=new ApiClient();
const formTracker=createFormTracker();
const navigationGuard=createNavigationGuard({document,tracker:formTracker,identity:()=>`${currentUser?.id||'guest'}:${clients.activeId||''}`,prepareDraft:(form,values)=>{if(form.id==='admin-difficulty-form'){form.elements.gameId.value=values.gameId;syncPolicyControls();}},onSaveError:showError});
let currentUser=null,members=[],inviteToken=null,inviteInfo=null,remoteRun=null,pendingSave=null,starting=false,launchAttempt=null,previewImport=null,importAttempt=null;
let inspectedUserId=null,publicReportData=null,viewVersion=0;
let dashboardDays=30,userTab='overview',registrationToken=null,createContext={};
let pendingAdminRefresh=null,pendingPanelRefresh=null;
let inspectedRevision=1,unresolvedProfiles=[],unresolvedPage=1,unresolvedPages=1;
const auditState={page:1,actorId:'',userId:'',actorSearch:'',targetSearch:'',action:'',from:'',to:''};
let sessionBestScore=null,completedRecord=null;
const adminState={search:'',status:'',role:'',sort:'newest',page:1};
let pendingStart = null, sessionIsBaseline = false, editingProfile = null, guideState = null, sessionAssessment = false, lessonState = null, sessionRecordId = null;
let sessionOptions = null, repeatingPractice = false;
let keyboardPlay=false;
const reportState = { tab: 'admin', game: '', level: '', variant: '', kind: 'training', recordId: null };
const fa = value => new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 0 }).format(value);
const time = ms => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${fa(Math.floor(seconds / 60)).padStart(2, uiText('۰'))}:${fa(seconds % 60).padStart(2, uiText('۰'))}`; };
const describe = describeStimulus;
let route = 'home', selectedGame = 'hunt', selectedLevel = 'easy', selectedTheme = 'star', selectedHuntMode = 'standard', selectedLayout = 'grid', selectedSearchMode = 'single', selectedTrafficMode = 'circles', selectedMaterial = 'shapes', filter = 'all';
let engine = null, frame = 0, arenaKey = '', modalKind = '', audioContext;
let playPhase='ready', preparationClock=null, reactionPointerInput=false, loadedWorld=null,guidanceVisit=null;
const guestScreen=()=>['registration','invitation','connecting','connection-error'].includes(route);

function cardDuration(game) {
  if(game.kind!=='reaction')return game.time;
  const durations=Object.keys(LEVELS).flatMap(level=>(game.id==='hunt'?['star','fish']:['star']).map(theme=>(150+(game.id==='nback'?LEVELS[level].n:0))*reactionTiming({gameId:game.id,level,theme}).intervalMs));
  return lt`${time(Math.min(...durations))} تا ${time(Math.max(...durations))}`;
}

function header() {
 if(publicReportData||!currentUser||guestScreen())return lt`<header class="site-header"><div class="header-inner"><span class="brand">${logo()} حواس</span><div class="header-end"><span class="header-note">${publicReportData?uiText('گزارش خانواده'):uiText('همراه رشد و توجه')}</span>${themeSelector()}</div></div></header>`;
 if(currentUser.passwordChangeRequired)return lt`<header class="site-header"><div class="header-inner"><span class="brand">${logo()} حواس</span><div class="header-end">${themeSelector()}<button class="text-button" data-action="logout">خروج</button></div></div></header>`;
 if(currentUser.role==='admin')return adminShell(currentUser,route==='admin'?'overview':route==='invitations'?'invitations':route==='account'?'settings':route==='audit'?'audit':route==='game-settings'?'game-settings':'users');
 const nav=[['home','home',uiText('خانه')],['games','grid',uiText('بازی‌ها')],['dashboard','activity',uiText('پیشرفت من')],['account','user',uiText('حساب')]];
 return lt`<header class="site-header client-header"><div class="header-inner"><a class="brand" href="#app" data-action="home">${logo()}<span>حواس<small>ماجراجویی‌های ذهنی</small></span></a><nav aria-label="منوی اصلی">${nav.map(([action,symbol,label])=>`<button class="nav-link ${route==='home'&&action==='home'||route==='reports'&&action==='dashboard'||route==='account'&&action==='account'?'active':''}" data-action="${action}">${icon(symbol)}${label}</button>`).join('')}</nav><div class="header-end">${themeSelector()}<button class="profile-button" data-action="account">${esc(currentUser.name)}</button><button class="icon-button sound-button" data-action="sound" aria-label="${progress.sound?uiText('خاموش‌کردن صدا و راهنمای گویا'):uiText('روشن‌کردن صدا و راهنمای گویا')}" aria-pressed="${progress.sound}">${icon(progress.sound?'sound':'mute')}</button></div></div></header><nav class="client-bottom-nav" aria-label="منوی موبایل">${nav.map(([action,symbol,label])=>`<button data-action="${action}" class="${route==='home'&&action==='home'||route==='reports'&&action==='dashboard'||route==='account'&&action==='account'?'active':''}">${icon(symbol)}<span>${label}</span></button>`).join('')}</nav>`;
}
const footer = () => lt`<footer class="site-footer"><span>${logo()} حواس؛ جایی برای بازی و کشف</span><span>با سرعت خودت، به سبک خودت ${icon('spark')}</span></footer>`;
function page(content, className = '') {
  navigationGuard.stash();
  platformMotion.reset();
  if(!modal.open)modal.replaceChildren();
  playMotion.reset();
  guidance.stop();
  if(!['detail','play','result'].includes(route))guidanceVisit=null;
  viewVersion++;
  if(launchAttempt){launchAttempt=null;starting=false;}
  cancelAnimationFrame(frame);
  document.body.dataset.screen=route;reactionPointerInput=false;
  if(['detail','play','result'].includes(route)&&GAME_MAP[selectedGame])document.body.dataset.game=selectedGame;
  else delete document.body.dataset.game;
  document.body.dataset.panel=currentUser?.role==='admin'&&!publicReportData&&!guestScreen()&&!currentUser.passwordChangeRequired?'admin':currentUser&&!publicReportData&&!guestScreen()?'client':'guest';
  const theme=platformTheme(route,document.body.dataset.panel);
  if(theme)document.body.dataset.platformTheme=theme;
  else delete document.body.dataset.platformTheme;
  document.body.classList.remove('admin-menu-open');
  app.innerHTML = `${header()}<main id="main" class="${className}" tabindex="-1">${route==='result'?guideControl(guidanceKey(sessionOptions||gameOptions())):''}${content}</main>${footer()}`;
  const languageHost=app.querySelector('header .header-end')||app.querySelector('header .admin-identity')||app.querySelector('header .header-inner')||app.querySelector('header');
  languageHost?.insertAdjacentHTML('beforeend',languageSelector());
  if(theme){
    app.querySelectorAll('.client-welcome,.client-quick-stats,.game-card,.routine-card,.little-note,.page-title,.assessment-step,.account-grid>.surface,.admin-stats>.surface,.dashboard-charts>.surface').forEach(node=>node.setAttribute('data-reveal',''));
    app.querySelectorAll('.empty-state,.dashboard-empty').forEach(node=>node.insertAdjacentHTML('afterbegin',sectionArt('pause')));
    platformMotion.sync(app);
  }
  syncSidebarAccess();
  queueMicrotask(()=>navigationGuard.sync());
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('#main').focus({ preventScroll: true });
}
async function accountError(error,viewerId,viewerRole){
 if(error.status!==403||!viewerId)return error;
 let auth;
 try{auth=await api.request('/auth/session');}
 catch(sessionError){return sessionError.status===401?sessionError:error;}
 if(auth.user?.id!==viewerId||auth.user?.role!==viewerRole)return new ApiError(uiText('حساب این مرورگر تغییر کرده است؛ دوباره وارد شوید.'),401,'ACCOUNT_CHANGED');
 return error;
}
async function request(path,options){
 const publicPath=['/auth/session','/auth/login','/invitations/inspect','/invitations/accept','/public/report','/public/registration/inspect','/public/registration/complete'].includes(path),viewerId=currentUser?.id,viewerRole=currentUser?.role;
 const stale=()=>!publicPath&&(currentUser?.id!==viewerId||currentUser?.role!==viewerRole);
 try{const data=await api.request(path,options);if(stale())throw new ApiError(uiText('پاسخ متعلق به حساب قبلی است.'),0,'STALE_RESPONSE');return data;}
 catch(error){
  if(stale())throw new ApiError(uiText('پاسخ متعلق به حساب قبلی است.'),0,'STALE_RESPONSE');
  const failure=publicPath?error:await accountError(error,viewerId,viewerRole);
  if(stale())throw new ApiError(uiText('پاسخ متعلق به حساب قبلی است.'),0,'STALE_RESPONSE');throw failure;
 }
}
// A response may render only into the account and navigation that requested it.
function beginView(){if(launchAttempt){launchAttempt=null;starting=false;}return {version:++viewVersion,userId:currentUser?.id,role:currentUser?.role};}
const currentView=view=>view.version===viewVersion&&view.userId===currentUser?.id&&view.role===currentUser?.role;
async function viewRequest(view,path,options){try{const data=await request(path,options);return currentView(view)?data:null;}catch(error){if(currentView(view))throw error;return null;}}
const historyNavigation=createHistoryNavigation({window,history,location,needsConfirmation:()=>Boolean(pendingSave)||navigationGuard.hasChanges(),confirm:()=>{if(pendingSave){notify(uiText('نتیجه هنوز در سرور ثبت نشده است.'));return false;}return navigationGuard.allow(submitForm);},navigate:()=>navigate(),onError:showError});
function setHash(hash) { historyNavigation.push(hash); }
function home(updateHash = true) {
  if(pendingLocale){setLocale(pendingLocale);clients.locale=pendingLocale;pendingLocale=null;}
  if(!currentUser)return showLogin();
  if(currentUser.passwordChangeRequired)return forcedPassword();
  if(currentUser.role==='admin')return adminPanel();
  pendingStart = null; guideState = null; engine = null; route = 'home'; if (modal.open) modal.close(); if (updateHash) setHash('#app');
  document.title = uiText('حواس — ماجراجویی‌های ذهنی');
  page(lt`${clientWelcome(clients,currentUser)}<section class="library" id="games" aria-labelledby="library-heading"><div class="section-heading"><div><div class="section-kicker">بازی مورد علاقه‌ات رو پیدا کن</div><h2 id="library-heading">دوست داری چی بازی کنی؟ ${icon('spark')}</h2></div><p>از هر جا دوست داری، شروع کن.</p></div><div class="filter-bar" role="group" aria-label="دسته‌بندی بازی‌ها">${[['all',uiText('همهٔ بازی‌ها')],['attention',uiText('توجه و تمرکز')],['memory',uiText('حافظه')],['speed',uiText('سرعت واکنش')]].map(([id,label]) => `<button class="filter ${filter === id ? 'selected' : ''}" data-action="filter" data-filter="${id}" aria-pressed="${filter === id}">${label}${id === 'all' ? uiText('<span>۷</span>') : ''}</button>`).join('')}<span class="filter-note">همهٔ بازی‌ها رو می‌تونی انتخاب کنی ${icon('check')}</span></div><div class="game-grid" id="game-grid">${gameCards()}</div></section>
    <section class="little-note"><span class="note-symbol">${icon('spark')}</span><div><h3>برای بهترشدن، لازم نیست عجله کنی.</h3><p>اول قانون بازی رو یاد بگیر. هر وقت آماده بودی، شروع کن.</p></div><span class="note-doodle">✳</span></section>`, 'home-main');
}
function gameCards() {
  const shown = GAMES.filter(game => filter === 'all' || game.tags.includes(filter));
  return shown.map((game, index) => {
    const records = profileRecords(clients).filter(item => item.kind === 'training' && item.result.gameId === game.id);
    return `<button class="game-card" data-reveal data-action="open" data-game="${game.id}" style="--card-color:${game.color};--card-accent:${game.accent};--card-index:${index}"><div class="card-picture"><span class="card-number">${fa(GAMES.indexOf(game) + 1).padStart(2, uiText('۰'))}</span>${gameArtwork(game.id,{lazy:true})}${(clients.panelSummary?.games.find(g=>g.id===game.id)?.count??records.length) ? lt`<span class="played-badge">${icon('check')} بازی کردی</span>` : ''}</div><div class="card-content"><span class="skill-label">${game.skill}</span><h3>${game.title}</h3><p>${game.subtitle}</p><div class="card-bottom"><span>${icon('clock')} ${cardDuration(game)}</span><span class="card-arrow" aria-hidden="true">${icon('arrow')}</span></div></div></button>`;
  }).join('') + (filter === 'all' ? lt`<div class="routine-card"><span class="routine-flower">✳</span><span class="section-kicker">یادآوری</span><h3>هر روز، <br>چند دقیقه برای ذهنت.</h3><p>با یک بازی شروع کن. <br>لازم نیست همه رو یک‌جا انجام بدی.</p><button class="text-button" data-action="about">راهنمای شروع ${icon('arrow')}</button><span class="routine-dots">● ● ●</span></div>` : '');
}

function lessonContent() {
  const step=lessonState?.steps[lessonState.index];if(!step)return '';
  if(step.kind==='search')return searchLessonContent(step);
  const memory=step.kind==='memory',ready=!memory||memoryLessonState(step,lessonState).ready;
  const sample=memory?memoryLessonView(step,lessonState):`<div class="lesson-stimuli">${step.equipment?equipment(step.equipment):step.stimuli.map(value=>`<div class="lesson-token">${symbol(value)}</div>`).join('')}</div>`;
  const feedback=lessonState.answered?lt`<div class="lesson-feedback ${lessonState.correct?'good':'wrong'}" role="status"><b>${icon(lessonState.correct?'check':'repeat')} ${lessonState.correct?uiText('درست بود!'):uiText('با هم نگاه کنیم')}</b><div class="lesson-expected ${step.expected?'do-cue':'wait-cue'}">${icon(step.expected?'tap':'wait')}<strong>${step.expected?uiText('بزن'):uiText('صبر کن')}</strong></div><details class="companion-guide"><summary>چرا؟</summary><p>${step.explanation}</p></details></div><button class="text-button" data-action="lesson-next">نمونهٔ بعدی ${icon('arrow')}</button>`:ready?lt`<div class="lesson-answers"><button class="button lesson-yes" data-action="lesson-answer" data-response="true">${icon('tap')} بزن</button><button class="button wait-button" data-action="lesson-answer" data-response="false">${icon('wait')} صبر کن</button></div>`:'';
  return lt`<div class="lesson-heading"><span class="section-kicker">با هم یاد بگیریم</span><b>${fa(lessonState.index+1)} از ${fa(lessonState.steps.length)}</b></div><h3>${step.title}</h3><p>${step.prompt}</p>${guideControl(lessonGuidanceKey(selectedGame,step,gameOptions()))}${selectedGame==='stroop'?stroopRulePicture(step.phase):''}${sample}${feedback}`;
}
function searchLessonContent(step) {
  const found=lessonState.searchFound||[],rejected=lessonState.searchRejected||[],answered=lessonState.answered,hidden=step.memorize&&lessonState.memoryHidden,showChoices=!step.memorize||hidden;
  return lt`<div class="lesson-heading"><span class="section-kicker">کارآگاه کوچک · بدون زمان و بدون ثبت امتیاز</span><b>${fa(lessonState.index+1)} از ${fa(lessonState.steps.length)}</b></div><h3>${step.title}</h3><p>${step.prompt}</p>${guideControl(lessonGuidanceKey('search',step,gameOptions()))}<div class="lesson-search-samples ${hidden?'samples-hidden':''}" aria-label="${hidden?uiText('نمونه‌ها پنهان شده‌اند'):uiText('نمونه‌های هدف')}">${step.samples.map(sample=>`<span>${hidden?uiText('<b aria-hidden="true">؟</b>'):symbol(sample)}</span>`).join('')}</div>${showChoices?`<div class="lesson-search-choices">${step.choices.map((choice,i)=>lt`<button class="lesson-choice ${found.includes(i)?'found':''} ${rejected.includes(i)?'rejected':''}" data-action="lesson-choice" data-index="${i}" aria-label="گزینهٔ ${fa(i+1)}: ${esc(describe(choice))}" ${answered||found.includes(i)||rejected.includes(i)?'disabled':''}>${symbol(choice)}${found.includes(i)?icon('check'):''}</button>`).join('')}</div>`:uiText('<button class="button subtle lesson-memory-button" data-action="lesson-hide">به خاطر سپردم؛ گزینه‌ها را ببین</button>')}${hidden&&!answered?uiText('<button class="text-button" data-action="lesson-show">نمونه را دوباره ببین</button>'):''}${lessonState.lastCorrect!==undefined?`<div class="lesson-feedback ${lessonState.lastCorrect?'good':'wrong'}" role="status"><b>${answered?uiText('همهٔ هدف‌ها را پیدا کردی!'):lessonState.lastCorrect?uiText('یکی پیدا شد؛ هدف دیگر را هم پیدا کن.'):uiText('شبیه نمونه است؛ جزئیات را دوباره نگاه کن.')}</b><p>${step.explanation}</p></div>`:''}${answered?uiText('<button class="text-button" data-action="lesson-next">نمونهٔ بعدی ←</button>'):''}`;
}
function answerLessonChoice(index) {
  const step=lessonState?.steps[lessonState.index];if(route!=='detail'||step?.kind!=='search'||lessonState.answered||step.memorize&&!lessonState.memoryHidden||!Number.isInteger(index)||!step.choices[index])return;
  lessonState.searchFound||=[];lessonState.searchRejected||=[];
  if(lessonState.searchFound.includes(index)||lessonState.searchRejected.includes(index))return;
  const choice=step.choices[index],correct=step.samples.some(sample=>['shape','color','detail'].every(key=>sample[key]===choice[key]));
  (correct?lessonState.searchFound:lessonState.searchRejected).push(index);lessonState.lastCorrect=correct;
  lessonState.answered=lessonState.searchFound.length===step.samples.length;tone(correct);
  document.querySelector('#lesson-box').innerHTML=lessonContent();
  const next=document.querySelector('#lesson-box [data-action="lesson-next"]')||[...document.querySelectorAll('#lesson-box .lesson-choice:not(:disabled)')].find(button=>Number(button.dataset.index)>index)||document.querySelector('#lesson-box .lesson-choice:not(:disabled)');next?.focus({preventScroll:true});
}
function answerLesson(response) {
  if(route!=='detail'||!lessonState||lessonState.answered)return;
  const step=lessonState.steps[lessonState.index];if(step.kind==='memory'&&!memoryLessonState(step,lessonState).ready)return;
  lessonState.answered=true;lessonState.correct=response===lessonState.steps[lessonState.index].expected;
  tone(lessonState.correct);document.querySelector('#lesson-box').innerHTML=lessonContent();
  document.querySelector('#lesson-box [data-action="lesson-next"]')?.focus({preventScroll:true});
}
function nextLesson() {
  guidance.stop();
  if(route!=='detail'||!lessonState)return;
  lessonState.index=(lessonState.index+1)%lessonState.steps.length;lessonState.answered=false;lessonState.searchFound=[];lessonState.searchRejected=[];lessonState.lastCorrect=undefined;lessonState.memoryHidden=false;lessonState.memoryIndex=0;lessonState.memoryHelp=false;
  document.querySelector('#lesson-box').innerHTML=lessonContent();
  document.querySelector('#lesson-box [data-action="lesson-memory-next"],#lesson-box [data-action="lesson-answer"],#lesson-box [data-action="lesson-choice"],#lesson-box [data-action="lesson-hide"]')?.focus({preventScroll:true});
}
async function assessment() {
  if(!currentUser)return showLogin();if(currentUser.role==='admin')return adminPanel();
  const view=beginView();if(!await refreshClients(view))return;
  engine=null;guideState=null;route='assessment';if(modal.open)modal.close();setHash('#assessment');
  document.title=uiText('ارزیابی اولیه — حواس');page(assessmentView(clients),'content-main assessment-main');
}
function standardOptions(level='easy') {
  selectedLevel=level;selectedTheme='star';selectedMaterial='shapes';selectedHuntMode='standard';selectedLayout='grid';selectedSearchMode='single';selectedTrafficMode='circles';
}
function beginAssessment(id) {
  if(!activeProfile(clients)||!Object.hasOwn(GAME_MAP,id))return assessment();
  standardOptions();guideState={profileId:clients.activeId,gameId:id};return detail(id);
}
function trainFromAssessment(id) {
  if(!Object.hasOwn(GAME_MAP,id))return;
  const step=assessmentSteps(clients).find(step=>step.game.id===id);
  guideState=null;standardOptions(step?.recommendation?.level || 'easy');return detail(id);
}
function taskOptions(game) {
  if (game.id==='hunt') return lt`<fieldset class="theme-selector"><legend>تمرین کدام نوع توجه؟</legend><div class="theme-options">${[['standard',uiText('یک هدف · توجه پایدار')],['divided',uiText('دو هدف · توجه تقسیم‌شده')]].map(([mode,label])=>`<button class="theme-button hunt-mode ${selectedHuntMode===mode?'selected':''}" data-action="hunt-mode" data-mode="${mode}" aria-pressed="${selectedHuntMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت دوهدفه، به هر کدام از دو نمونه پاسخ بده؛ مجموع هدف‌ها همچنان ۳۰ تاست.</p></fieldset>`;
  if (game.id==='traffic') return lt`<fieldset class="theme-selector"><legend>با کدام نشانه بازی کنیم؟</legend><div class="theme-options">${[['circles',uiText('دایره‌های قرمز و سبز')],['signs',uiText('ورود ممنوع و یک‌طرفه')]].map(([mode,label])=>`<button class="theme-button ${selectedTrafficMode===mode?'selected':''}" data-action="traffic-mode" data-mode="${mode}" aria-pressed="${selectedTrafficMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت تابلوها، به نشانهٔ آبی یک‌طرفه پاسخ بده و تابلوی قرمز ورود ممنوع را نادیده بگیر.</p></fieldset>`;
  if (game.id==='nback') return materialOptions(uiText('حافظه را با چی تمرین کنیم؟'), [['shapes',uiText('شکل‌ها')],['numbers',uiText('اعداد')],['toys',uiText('اسباب‌بازی‌ها')]]);
  if (game.id==='search') return lt`<fieldset class="theme-selector"><legend>چیدمان شکل‌ها</legend><div class="theme-options">${[['grid',uiText('منظم')],['scattered',uiText('پراکنده')]].map(([layout,label])=>`<button class="theme-button layout-button ${selectedLayout===layout?'selected':''}" data-action="search-layout" data-layout="${layout}" aria-pressed="${selectedLayout===layout}">${label}</button>`).join('')}</div></fieldset>${materialOptions(uiText('نوع محرک'), [['shapes',uiText('شکل‌ها')],['letters',uiText('حروف انگلیسی')]])}<fieldset class="theme-selector"><legend>چند هدف پیدا کنیم؟</legend><div class="theme-options">${[['single',uiText('یک هدف · حافظه')],['dual',uiText('دو هدف · توجه تقسیم‌شده')]].map(([mode,label])=>`<button class="theme-button ${selectedSearchMode===mode?'selected':''}" data-action="search-mode" data-mode="${mode}" aria-pressed="${selectedSearchMode===mode}">${label}</button>`).join('')}</div><p class="option-hint">در حالت دوهدفه، هر دو نمونه را حفظ کن و در هر دور هر دو را پیدا کن؛ هر کشف درست یک امتیاز دارد.</p></fieldset>`;
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
  const last = clients.panelSummary?clients.panelSummary.latestResults.find(r=>r.result.gameId===selectedGame&&variantOf(r.result)===currentVariant())?.result:profileRecords(clients).filter(r=>r.result.gameId===selectedGame && (r.result.protocolVersion || 2)===GAME_PROTOCOLS[selectedGame] && variantOf(r.result)===currentVariant()).at(-1)?.result;
  return `<div class="assessment-info"><b>${baseline ? uiText('ارزیابی پایه انجام شده') : uiText('شروع با ۵ تمرین و ارزیابی پایه')}</b><p>${last ? lt`سطح پیشنهادی: ${LEVELS[recommendLevel(last).level].label}. ${recommendLevel(last).reason}` : uiText('اول قانون را یاد می‌گیری؛ سپس براساس دقت، سرعت، خطاها و پاسخ‌های متوالی، یک سطح قابل‌تغییر پیشنهاد می‌شود.')}</p>${baseline ? uiText('<button class="text-button" data-action="baseline">تکرار ارزیابی پایه</button>') : ''}</div>`;
}
function gameCopy(game) {
  if(game.id==='traffic' && selectedTrafficMode==='signs')return {...game,description:uiText('فقط با دیدن تابلوی آبی یک‌طرفه حرکت کن. تابلوی ورود ممنوع یعنی باید صبر کنی و پاسخ ندهی.'),rules:[uiText('تابلوی آبی یک‌طرفه: دکمهٔ «حرکت!» را بزن.'),uiText('تابلوی قرمز ورود ممنوع: هیچ دکمه‌ای نزن.'),uiText('تابلو کوتاه دیده می‌شود، اما تا شروع نوبت بعد فرصت پاسخ داری.')]};
  if(game.id==='nback') {
    const noun=selectedMaterial==='numbers'?uiText('عدد'):selectedMaterial==='toys'?uiText('اسباب‌بازی'):uiText('شکل');
    return {...game,description:lt`${noun}‌ها یکی‌یکی دیده می‌شوند. قانون می‌گوید محرک فعلی را با یک، دو یا سه محرک قبل مقایسه کنی.`,rules:[lt`در آسان، ${noun} فعلی را با یک محرک قبل مقایسه کن.`,lt`در متوسط دو و در سخت سه محرک قبل را به خاطر بیاور.`,lt`فقط وقتی ${noun} فعلی با همان محرک یکسان است پاسخ بده؛ به بقیه پاسخ نده.`]};
  }
  if(game.id==='search') {
    const dual=selectedSearchMode==='dual',noun=selectedMaterial==='letters'?uiText('حرف'):uiText('شکل');
    return {...game,description:dual?lt`دو ${noun} را به خاطر بسپار و بعد، هر دو را در یک صفحهٔ شلوغ پیدا کن. جزئیات نمونه‌ها مهم‌اند.`:lt`${noun} نمونه را به خاطر بسپار و بعد آن را میان گزینه‌های مشابه پیدا کن.`,rules:[dual?lt`${((gameOptions().timing?.previewMs||2000)/1000).toLocaleString(numberLocale())} ثانیه به هر دو نمونه نگاه کن و جزئیاتشان را حفظ کن.`:lt`${((gameOptions().timing?.previewMs||2000)/1000).toLocaleString(numberLocale())} ثانیه به ${noun} نمونه نگاه کن و جزئیاتش را حفظ کن.`,dual?uiText('پس از پنهان‌شدن نمونه‌ها، هر دو هدف را پیدا کن؛ با پیدا‌کردن یکی، دور تمام نمی‌شود.'):uiText('پس از پنهان‌شدن نمونه، همان نمونه را بین گزینه‌ها پیدا کن.'),uiText('هر کشف درست یک امتیاز دارد. برای هر دور زمان محدودی داری.')]};
  }
  return game;
}
async function detail(id, updateHash = true) {
  if(!currentUser)return showLogin();if(currentUser.role==='admin')return adminPanel();
  const view=beginView();if(!await refreshClients(view))return;
  if(!Object.hasOwn(GAME_MAP,id))return home();
  if(selectedGame!==id)selectedMaterial='shapes';selectedGame=id;
  const key=timingIdentity({...gameOptions(),variant:currentVariant()});
  if(clients.activeId){
    const data=await viewRequest(view,`${timingPath(clients.activeId)}?${new URLSearchParams(key)}`);if(!currentView(view))return;
    clients.gameTimings={...data,childId:clients.activeId};
  }else delete clients.gameTimings;
  return renderDetail(id,updateHash);
}
function renderDetail(id, updateHash = true) {
  if (!Object.hasOwn(GAME_MAP,id)) return home();
  if (selectedGame !== id) selectedMaterial = 'shapes';
  engine = null; route = 'detail'; selectedGame = id; if (modal.open) modal.close(); if (updateHash) setHash(`#${id}`);
  if (guideState && (guideState.gameId!==id || guideState.profileId!==clients.activeId)) guideState = null;
  const policy=clients.difficulties.find(d=>d.gameId===id&&d.variant===currentVariant()&&d.protocolVersion===GAME_PROTOCOLS[id]);
  if(!guideState&&policy)selectedLevel=policy.level;
  lessonState = {steps:createLesson(id,{level:selectedLevel,material:selectedMaterial,theme:selectedTheme,trafficMode:selectedTrafficMode,targetCount:id==='search'?(selectedSearchMode==='dual'?2:1):(selectedHuntMode==='divided'?2:1)}),index:0,answered:false};
  const game = gameCopy(GAME_MAP[id]); document.title = lt`${game.title} — حواس`;
  page(lt`<div class="breadcrumb"><button data-action="home">بازی‌ها</button>${icon('chevron')}<span>${game.title}</span></div>${guideState?lt`<div class="guided-banner"><b>ارزیابی اولیه · ${fa(GAMES.findIndex(game=>game.id===id)+1)} از ۷</b><span>این بخش شامل پنج تمرین در سطح آسان است.</span><button class="text-button" data-action="assessment">دیدن مسیر ارزیابی ←</button></div>`:""}<section class="intro-layout"><div class="intro-copy"><div class="eyebrow">${icon('spark')} ${game.skill}</div><h1>${game.title}</h1><details class="companion-guide intro-companion"><summary>راهنمای همراه</summary><p class="intro-description">${game.description}</p><ol class="rules">${game.rules.map((rule,i) => `<li><span>${fa(i+1)}</span><p>${rule}</p></li>`).join('')}</ol></details>${lessonState.steps.length?lt`<section class="lesson-box" id="lesson-box" aria-label="نمونهٔ آموزشی تعاملی">${lessonContent()}</section>`:""}<fieldset class="level-selector"><legend>سطح تمرین تعیین‌شده${policy?.trainingProfile?` · ${esc(policy.trainingProfile.name)}`:''}</legend><div class="levels">${Object.entries(LEVELS).map(([id,level],i) => `<button class="level-button ${selectedLevel === id ? 'selected' : ''}" data-action="level" data-level="${id}" aria-pressed="${selectedLevel === id}" ${guideState||currentUser?.role!=='admin'?"disabled":""}><span class="level-bars" aria-hidden="true">${[0,1,2].map(j=>`<i class="${j<=i?'lit':''}"></i>`).join('')}</span><b>${level.label}</b><small>${level.caption}</small></button>`).join('')}</div></fieldset>${id === 'hunt' ? lt`<fieldset class="theme-selector"><legend>با چی بازی کنیم؟</legend><div class="theme-options">${Object.entries(THEMES).map(([key,label]) => `<button class="theme-button ${key===selectedTheme?'selected':''}" data-action="theme" data-theme="${key}" aria-pressed="${key===selectedTheme}">${label}</button>`).join('')}</div></fieldset>` : ''}${taskOptions(game)}${assessmentInfo()}${currentUser?.role==='admin'&&activeProfile(clients)?lt`<div class="difficulty-policy"><span>روش سطح: ${policy?.mode==='fixed'?uiText('ثابت؛ انتخاب سطح، تنظیم ادمین را ثابت می‌کند.'):uiText('تطبیقی؛ سطح جلسهٔ بعد از عملکرد تعیین می‌شود.')}</span><button class="text-button" data-action="adaptive-level">فعال‌کردن سطح تطبیقی</button></div>`:''}<div class="start-row"><button class="button primary" data-action="practice">بریم تمرین کنیم ${icon('arrow')}</button>${!guideState && latestBaseline(clients,id,currentVariant()) ? uiText('<button class="button primary" data-action="main-game">بازی اصلی ←</button>') : uiText('<span>۵ تمرین؛ ارزیابی جدا از امتیاز اصلی</span>')}</div></div><aside class="intro-art" style="--card-color:${game.color}"><div class="intro-art-bubble">${gameArtwork(id,{theme:selectedTheme})}</div><div class="intro-art-note">${icon('target')} <span>یک قانون ساده، یک چالش جذاب</span></div><div class="session-summary" id="session-summary">${levelSummary(game)}</div></aside></section>`, 'content-main');
  if(guideState)document.querySelectorAll('[data-action="theme"],[data-action="hunt-mode"],[data-action="material"],[data-action="traffic-mode"],[data-action="search-mode"],[data-action="search-layout"]').forEach(button=>button.disabled=true);
  if(lessonState.steps.length)narrateEntry(lessonGuidanceKey(selectedGame,lessonState.steps[lessonState.index],gameOptions()));
}
function levelSummary(game) {
  const l = LEVELS[selectedLevel];
  const timing=gameOptions().timing||defaultTiming(gameOptions()),{visibleMs,intervalMs}=timing;
  if (game.kind === 'reaction') return lt`<span><b>۱۵۰</b> نوبت · ۳۰ هدف</span><span><b>${fa(visibleMs)}</b> میلی‌ثانیه نمایش</span><span><b>${time((150+(game.id==='nback'?l.n:0))*intervalMs)}</b> زمان فعال</span>${game.id==='hunt'?lt`<span><b>${fa(HUNT_SETTINGS[selectedLevel].sceneItems)}</b> شکل هم‌زمان</span>`:''}`;
  if (game.kind === 'search') return lt`<span><b>۱۰</b> دور جست‌وجو</span><span><b>${(timing.searchMs/1000).toLocaleString(numberLocale())}</b> ثانیه برای هر دور</span><span><b>${selectedSearchMode==='dual'?uiText('۲'):uiText('۱')}</b> هدف در هر دور</span>`;
  return lt`<span><b>${fa(l.required)}</b> وسیلهٔ ضروری</span><span><b>${(timing.limitMs/1000).toLocaleString(numberLocale())}</b> ثانیه فرصت</span>`;
}

async function start(practice, forceBaseline = false, repeatOptions = null) {
  if(starting)return;
  if(!currentUser)return showLogin();
  if (!activeProfile(clients)) { pendingStart = { practice, forceBaseline }; return profiles(); }
  // Starting takes precedence over an older, still-loading guide for this game.
  beginView();
  if(!repeatOptions)sessionAssessment = Boolean(guideState && guideState.gameId===selectedGame && guideState.profileId===clients.activeId);
  if (sessionAssessment && !repeatOptions) { practice=true;forceBaseline=true;selectedLevel='easy'; }
  if (!practice && !latestBaseline(clients, selectedGame, currentVariant())) practice = true;
  sessionIsBaseline = !repeatOptions && practice && (forceBaseline || !latestBaseline(clients, selectedGame, currentVariant()));
  if(practice&&!sessionIsBaseline&&!repeatOptions){
    const policy=clients.difficulties.find(d=>d.gameId===selectedGame&&d.variant===currentVariant()&&d.protocolVersion===GAME_PROTOCOLS[selectedGame]);
    if(policy)selectedLevel=policy.level;
  }
  const options={...(repeatOptions||gameOptions()),locale:getLocale()};
  if(repeatOptions){selectedGame=options.gameId;selectedLevel=options.level;}
  const attempt={};launchAttempt=attempt;starting=true;notify(uiText('در حال آماده‌سازی بازی…'));document.querySelectorAll('[data-action="practice"],[data-action="repeat-practice"],[data-action="main-game"],[data-action="replay"]').forEach(button=>button.disabled=true);
  try {
    const run=(!practice||sessionIsBaseline)?await request(`/children/${clients.activeId}/sessions`,{method:'POST',body:{...options,kind:sessionIsBaseline?'baseline':'training'}}):null;
    if(!run&&!repeatOptions){
      const key=timingIdentity({...options,variant:currentVariant()}),data=await request(`${timingPath(clients.activeId)}?${new URLSearchParams(key)}`);
      if(data.effectiveLevel)options.level=selectedLevel=data.effectiveLevel;
      options.timing={...data.levels.find(row=>row.level===selectedLevel).timing};if(data.trainingProfile)options.trainingProfile=data.trainingProfile;else delete options.trainingProfile;
    }
    if(!run&&!repeatOptions)options.seed=globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    const world=await preloadWorld(run?.settings||options);
    if(launchAttempt!==attempt)return;
    remoteRun=run;loadedWorld=world;
  }catch(error){
    if(launchAttempt!==attempt)return;
    // A failed launch may have superseded a mode change's pending guide fetch.
    // Restore its selected mode from local state, including while offline.
    if(route==='detail'&&error.status!==401&&error.code!=='PASSWORD_CHANGE_REQUIRED')renderDetail(selectedGame,false);
    throw error;
  }
  finally {if(launchAttempt===attempt){launchAttempt=null;starting=false;document.querySelectorAll('[data-action="practice"],[data-action="repeat-practice"],[data-action="main-game"],[data-action="replay"]').forEach(button=>button.disabled=false);}}
  if(remoteRun){selectedLevel=remoteRun.settings.level;selectedGame=remoteRun.settings.gameId;sessionBestScore=remoteRun.bestScore??null;}
  if (modal.open) modal.close();
  sessionRecordId=null;completedRecord=null;
  route = 'play'; playPhase='ready'; preparationClock=null;
  engine = FACTORIES[selectedGame]({ ...options,...remoteRun?.settings,...(remoteRun?{experienceVersion:remoteRun.settings.experienceVersion??1,trainingProfile:remoteRun.settings.trainingProfile||null}:{}),level:selectedLevel,practice,reviewEnabled:remoteRun?remoteRun.settings.reviewEnabled:practice,random:remoteRun?seededRandom(remoteRun.settings.seed):Math.random }); engine.clock.pause(); arenaKey = '';
  sessionOptions={...options,...remoteRun?.settings,level:engine.level,experienceVersion:engine.experienceVersion,trainingProfile:engine.trainingProfile?{...engine.trainingProfile}:null,...(engine.experienceVersion>=3?{timing:{...engine.timing}}:{})};
  repeatingPractice=Boolean(repeatOptions);
  const game = GAME_MAP[selectedGame];
  page(lt`<div class="play-heading"><div><span class="section-kicker">${practice ? sessionIsBaseline ? uiText('۵ تمرین برای آموزش و ارزیابی پایه') : uiText('وقت تمرینه؛ امتیازت ثبت نمی‌شه') : uiText('نوبت ماجراجویی توئه')}</span><h1>${game.title}<span class="level-pill">${LEVELS[selectedLevel].label}</span></h1></div><div class="play-heading-actions">${themeSelector()}${guideControl('current',uiText('راهنما'))}<button class="icon-button sound-button" data-action="sound" aria-label="${progress.sound?uiText('خاموش‌کردن صدا و راهنمای گویا'):uiText('روشن‌کردن صدا و راهنمای گویا')}" aria-pressed="${progress.sound}">${icon(progress.sound?'sound':'mute')}</button><button class="button subtle pause-button" data-action="pause">${icon('pause')} توقف</button></div></div><section class="play-panel ${game.kind}" data-game="${game.id}" data-interval-ms="${engine.intervalMs||1000}" data-visible-ms="${engine.visibleMs||0}" style="--game-color:${game.color};--game-accent:${game.accent}" aria-label="محیط بازی"><div class="play-hud"><div><span id="progress-label"></span><b id="position"></b></div><div class="hud-time">${icon('clock')}<div><span id="time-label"></span><b id="time"></b></div></div><div><span>پاسخ‌های هدف درست</span><b id="hits">۰</b></div></div><div class="progress-track"><span id="progress-fill"></span></div><div class="instruction-strip" id="instruction"></div><div id="arena" class="arena"></div><div class="play-controls" id="play-controls"></div><div class="visual-feedback" id="visual-feedback" aria-hidden="true"><span class="feedback-good">${icon('check')}</span><span class="feedback-wrong">${icon('repeat')}</span><span class="feedback-cleared">${icon('spark')}</span><strong class="feedback-label"></strong></div><div id="feedback" class="feedback" role="status">با آرامش و دقت شروع کن؛ تو می‌تونی!</div></section><p class="play-footnote">${icon('info')} ${practice ? sessionIsBaseline ? uiText('این پنج تمرین برای آموزش و پیشنهاد سطح اولیه ثبت می‌شوند.') : uiText('این بخش فقط برای یادگرفتن قانون بازیه.') : game.kind==='reaction' ? uiText('محرک کوتاه دیده می‌شه؛ تا شروع نوبت بعد فرصت پاسخ داری.') : uiText('عجله نکن؛ انتخاب درست، مهم‌تر از انتخاب سریعه.')}</p>`, 'play-main');
  updatePlay();
  frame = requestAnimationFrame(loop);
}
function loop() { if (route !== 'play' || !engine) return; updatePlay(); if (route === 'play') frame = requestAnimationFrame(loop); }
function setText(id, value) { const node = document.getElementById(id); if (node && node.textContent !== value) node.textContent = value; }
function beginGame() {
  if(playPhase!=='ready'||route!=='play'||modal.open)return;
  guidance.stop();
  playPhase='countdown';preparationClock=new ActiveClock();preparationClock.pause();arenaKey='';updatePlay();preparationClock.resume();
  announcer.textContent=uiText('بازی تا سه ثانیهٔ دیگر شروع می‌شود.');
}
function updatePreparation() {
  setText('progress-label',uiText('آماده‌سازی'));setText('position',uiText('هنوز شروع نشده'));setText('time-label',uiText('زمان بازی'));setText('time',uiText('۰۰:۰۰'));
  const fill=document.getElementById('progress-fill');if(fill)fill.style.width='0%';
  const key=`preparation:${playPhase}`;
  document.querySelector('.play-panel').dataset.phase=playPhase;
  if(arenaKey!==key){
    arenaKey=key;
    document.querySelector('#instruction').innerHTML=`${icon('info')}<span>${playPhase==='ready'?uiText('نمونه را ببین یا راهنما را بشنو.'):uiText('با پایان شمارش، بازی شروع می‌شود.')}</span>`;
    document.querySelector('#arena').innerHTML=playPhase==='ready'?preparationView(engine):countdownView();
    document.querySelector('#play-controls').innerHTML=playPhase==='ready'?lt`<button class="button primary begin-button" data-action="begin-game">آماده‌ام، شروع کنیم ${icon('play')}</button><span class="keyboard-hint">یا کلید <kbd>فاصله</kbd></span>`:'';
    setText('feedback',uiText('زمان آماده‌شدن و خواندن توضیحات، جزو زمان بازی نیست.'));
  }
  if(playPhase==='countdown'){
    const number=Math.max(1,3-Math.floor(preparationClock.elapsed/1000)),node=document.getElementById('countdown-number');
    setText('countdown-number',fa(number));if(node)node.className=number%2?'countdown-odd':'countdown-even';
  }
}
function updatePlay() {
  if (!engine || route !== 'play') return;
  playMotion.sync(document.querySelector('.play-panel'),engine,{paused:modal.open||document.hidden===true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
  if(playPhase!=='playing'){
    if(playPhase==='countdown'&&preparationClock.elapsed>=3000&&!modal.open){
      playPhase='playing';arenaKey='';setText('feedback',uiText('با آرامش و دقت ادامه بده؛ تو می‌تونی!'));updatePlay();engine.clock.resume();if(GAME_MAP[engine.gameId].kind==='reaction')engine.onset=engine.clock.elapsed;updatePlay();
      announcer.textContent=uiText('بازی شروع شد.');return;
    }
    updatePreparation();return;
  }
  engine.tick(); if (engine.done) return finish();
  if(engine.transitionClock)setText('transition-seconds',fa(Math.max(1,Math.ceil((RULE_NOTICE_MS-engine.transitionClock.elapsed)/1000))));
  const game = GAME_MAP[engine.gameId], reaction = game.kind === 'reaction', search = game.kind === 'search';
  const position = reaction ? engine.position : search ? engine.index : engine.practice ? engine.judged : engine.metrics.hits;
  const total = engine.total;
  setText('progress-label', reaction ? engine.current.scored === false ? uiText('اول به خاطر بسپار') : uiText('نوبت بازی') : search ? uiText('دور جست‌وجو') : engine.practice ? uiText('تمرین') : uiText('تجهیزات کوله'));
  setText('position', reaction && engine.current.scored === false ? lt`${fa(engine.index+1)} از ${fa(engine.n)}` : lt`${fa(Math.min(total,position + (game.kind === 'adventure' && !engine.practice ? 0 : 1)))} از ${fa(total)}`);
  setText('hits', fa(engine.metrics.hits));
  setText('time-label', reaction || engine.practice && game.kind === 'adventure' ? uiText('زمان بازی') : uiText('زمان باقی‌مانده'));
  setText('time', search && engine.preview ? uiText('نگاه کن') : time(reaction || engine.practice && game.kind === 'adventure' ? engine.clock.elapsed : engine.remainingMs));
  const fill = document.getElementById('progress-fill'); if (fill) fill.style.width = `${100*position/total}%`;
  document.querySelector('.play-panel').dataset.phase=engine.roundBreak?'round-break':engine.review?'review':engine.gate?'rule':'playing';
  document.querySelector('.hud-time').classList.toggle('time-urgent',!engine.review&&!engine.roundBreak&&!reaction&&!engine.practice&&engine.remainingMs<=10000);
  if(engine.roundBreak){setText('time-label',uiText('استراحت بین دورها'));setText('time','—');}
  const key = `${Boolean(engine.roundBreak)}:${Boolean(engine.review)}:` + (reaction ? `${engine.index}:${engine.gate}` : search ? `${engine.index}:${engine.preview}:${[...engine.rejected].join(',')}:${[...engine.found].join(',')}` : `${engine.judged}:${engine.items.map(i=>`${+i.collected}${+i.rejected}${+i.blocked}`).join('')}`);
  if (key !== arenaKey) {
    arenaKey = key;
    const panel=document.querySelector('.play-panel');
    const focus=keyboardPlay?(capturePlayFocus(panel)||(document.activeElement===document.body?{action:''}:null)):null;
    delete panel.dataset.response;
    const presenting = !engine.gate && !engine.paused;
    const transitionClock=engine.transitionClock,transitioning=transitionClock&&!transitionClock.paused;
    if (presenting) engine.clock.pause();
    if (transitioning) transitionClock.pause();
    renderArena(game);
    restorePlayFocus(panel,focus);
    if(search&&engine.preview&&!engine.review){const node=document.querySelector('.search-preview');const bounds=node?.getBoundingClientRect?.();if(bounds&&(bounds.top<0||bounds.bottom>window.innerHeight))node.scrollIntoView({block:'center',behavior:'instant'});}
    if(game.kind==='adventure'&&!engine.practice&&engine.ready){const button=document.querySelector('[data-action="depart"]');const bounds=button?.getBoundingClientRect?.();if(bounds&&(bounds.bottom>window.innerHeight||bounds.top<0))button.scrollIntoView({block:'nearest',behavior:'instant'});}
    if (presenting) { engine.clock.resume(); if(reaction) engine.onset = engine.clock.elapsed; }
    if (transitioning&&!modal.open&&!document.hidden) transitionClock.resume();
  }
  if (reaction) {
    const huntFocus=engine.gameId==='hunt'&&engine.moving?document.activeElement:null;
    const stimulus = document.querySelector('.stimulus-shell'); if (stimulus) stimulus.style.visibility = engine.visible ? 'visible' : 'hidden';
    if(engine.gameId==='hunt'&&engine.moving){
      const nodes=[...document.querySelectorAll('.hunt-choice')],height=document.querySelector('.hunt-surface')?.clientHeight||0,size=nodes[0]?.offsetHeight||0;
      nodes.forEach((node,index)=>{
        const choice=engine.current.choices[index],canonical=huntPosition(choice,engine.clock.elapsed-engine.onset,engine.visibleMs);
        const position=huntDisplayPosition(engine,choice,canonical,height,size);
        node.style.left=`${position.x}%`;node.style.top=`${position.y}%`;
        const selectable=engine.visible&&huntOnScreen(engine.current.choices[index],engine.clock.elapsed-engine.onset,engine.visibleMs)&&!engine.response;
        node.disabled=!selectable;node.tabIndex=selectable?0:-1;node.setAttribute('aria-hidden',String(!selectable));node.classList.toggle('left-field',position.x>110);
        const pose=animalPose(engine.theme,engine.clock.elapsed-engine.onset,index),reduced=playMotion.reduced;
        node.style.setProperty('--wing-flap',String(reduced?1:pose.flap));node.style.setProperty('--animal-tilt',`${reduced?0:pose.tilt}deg`);node.style.setProperty('--tail-angle',`${reduced?0:pose.tail}deg`);
      });
    }
    if(engine.gameId==='traffic'){
      const road=document.querySelector('.traffic-road'),distance=trafficProgress(engine);
      if(road){road.dataset.progress=String(distance);road.querySelector('.road-destination').classList.toggle('arrived',distance===1);}
    }
    const response = document.querySelector('[data-action="respond"]'); if (response) response.disabled = engine.gate || engine.paused || !!engine.response || engine.current.scored === false;
    if(engine.gameId==='hunt'&&engine.moving)syncHuntFocus(document.querySelector('.hunt-surface'),huntFocus);
  }
  if(search&&engine.preview&&!engine.review){setText('preview-seconds',lt`${fa(Math.ceil((engine.revealAt-engine.clock.elapsed)/1000))} ثانیه`);const previewFill=document.querySelector('.preview-timer span');const previewRatio=Math.max(0,Math.min(1,(engine.revealAt-engine.clock.elapsed)/engine.timing.previewMs));if(previewFill)previewFill.style.width=`${100*previewRatio}%`;document.querySelector('.search-clock-arc')?.setAttribute('stroke-dashoffset',String(100*(1-previewRatio)));}
  playMotion.sync(document.querySelector('.play-panel'),engine,{paused:modal.open||document.hidden===true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
  if(search&&!engine.preview&&!engine.review&&!engine.roundBreak){const timeFill=document.querySelector('#search-time-fill');if(timeFill)timeFill.style.width=`${100*engine.remainingMs/engine.timing.searchMs}%`;}
  const missionFill=document.querySelector('#mission-time-fill');if(missionFill)missionFill.style.width=`${engine.practice?100:100*engine.remainingMs/engine.limitMs}%`;
  const feedback = document.getElementById('feedback');
  if (engine.feedback && feedback.textContent !== engine.feedback) { feedback.textContent = engine.feedback; feedback.className = `feedback ${engine.feedbackKind}`; }
}
function reactionScene(game) {
  if(game.id==='traffic')return trafficScene(engine,trafficRoad(engine));
  if(game.id==='nback')return memoryStage(engine,worldBackground(engine,loadedWorld));
  if(game.id==='stroop')return stroopScene(engine,worldBackground(engine,loadedWorld));
  const tap=lt`<button class="stimulus-tap" data-action="stimulus-response" data-trial="${engine.index}" aria-label="پاسخ به محرک نمایش‌داده‌شده">${symbol(engine.current.stimulus)}</button>`;
  if(game.id==='hunt')return huntScene(engine,worldBackground(engine,loadedWorld),sceneAtmosphere(engine.theme));
  return lt`${game.id==='stroop'?stroopStages(engine.current.phase):''}<div class="reaction-stage">${worldBackground(engine,loadedWorld)}<div class="stage-caption">خوب نگاه کن…</div><div class="focus-corners"><i></i><i></i><i></i><i></i><div class="stimulus-shell">${tap}</div></div><span class="stage-dots" aria-hidden="true">· · ·</span></div>`;
}
function searchBoard() { return searchChoices(engine); }
function renderArena(game) {
  const arena = document.getElementById('arena'), controls = document.getElementById('play-controls'), instruction = document.getElementById('instruction');
  if(engine.roundBreak){instruction.innerHTML=lt`${icon('pause')}<span>قبل از نمونهٔ بعد، <b>آماده شو</b></span>`;arena.innerHTML=roundBreakView(engine);controls.innerHTML=lt`<button class="button primary next-round-button" data-action="next-round">آماده‌ام، دور ${fa(engine.index+2)} ${icon('arrow')}</button><span class="keyboard-hint">یا کلید <kbd>فاصله</kbd></span>`;return;}
  if(engine.review){
    instruction.innerHTML=lt`${icon('info')}<span>مرور تمرین · <b>زمان متوقف است</b></span>`;arena.innerHTML=reviewView(engine);
    const position=game.kind==='reaction'?engine.position:game.kind==='search'?engine.index:engine.judged;
    controls.innerHTML=`<button class="button primary review-next" data-action="continue-review">${position>=engine.total-1?uiText('دیدن نتیجهٔ تمرین'):uiText('آماده‌ام، تمرین بعدی')} ${icon('arrow')}</button>`;return;
  }
  if (game.kind === 'reaction') {
    let cue, button;
    if (game.id === 'hunt') { cue = huntTargetCue(engine); button = uiText('پیداش کردم'); }
    if(game.id==='traffic'){cue=trafficRulePicture(engine.variant==='signs');button=uiText('حرکت!');}
    if (game.id === 'nback') { cue = memoryRule(engine); button = lt`مثل ${fa(engine.n)} تا قبله`; }
    if (game.id === 'stroop') { cue = lt`${stroopRulePicture(engine.current.phase,engine)}<span class="sr-only">مرحلهٔ ${fa(engine.current.phase+1)}: ${stroopRules(engine)[engine.current.phase].title}</span>`; button = uiText('این هدفه'); }
    instruction.innerHTML = cue;
    if (engine.gate) {
      arena.innerHTML=transitionView(engine);
    } else arena.innerHTML = reactionScene(game);
    controls.innerHTML = game.id==='hunt'?huntControls(engine):game.id==='nback'?memoryControls(engine):game.id==='stroop'?stroopControls(engine):lt`<button class="button response-button" data-action="respond" ${engine.gate || engine.response || engine.current.scored === false ? 'disabled' : ''}>${icon('tap')} <span>${game.id==='traffic'?uiText('حرکت'):uiText('بزن')}</span><span class="sr-only">${button}</span></button><span class="keyboard-hint">یا کلید <kbd>فاصله</kbd> روی کیبورد</span>`;
  } else if (game.kind === 'search') {
    const dual=engine.targetCount===2;
    instruction.innerHTML = `${icon(engine.preview ? 'info' : 'target')}<span>${engine.preview ? dual?lt`${(engine.timing.previewMs/1000).toLocaleString(numberLocale())} ثانیه فرصت داری؛ <b>هر دو نمونه رو به خاطر بسپار.</b>`:lt`${(engine.timing.previewMs/1000).toLocaleString(numberLocale())} ثانیه فرصت داری؛ <b>شکل و علامتش رو به خاطر بسپار.</b>` : dual?uiText('نمونه‌ها پنهان شدند؛ <b>هر دو هدف رو پیدا کن.</b>'):uiText('نمونه پنهان شده؛ <b>همون شکل رو پیدا کن.</b>')}</span>`;
    arena.innerHTML=`<div class="search-world">${searchWorkspaceHeading(engine)}${searchRounds(engine)}${engine.preview?searchPreview(engine):`<div class="search-board-meta">${searchMemoryNote()}${searchTargetStatus(engine)}</div><div class="search-time-track" aria-hidden="true"><span id="search-time-fill"></span></div>${searchBoard()}`}</div>`;
    controls.innerHTML = `<span class="search-tip">${icon('info')} ${engine.preview ? uiText('هنوز گزینه‌ها نمایش داده نشدن.') : dual?lt`${fa(engine.found.size)} از ۲ هدف این دور پیدا شده؛ به جزئیات دقت کن.`:uiText('روی شکل درست بزن؛ به جزئیات دقت کن.')}</span>`;
  } else {
    instruction.innerHTML = `${icon('target')}<span>${engine.practice ? uiText('این وسیله برای سفر لازمه؟ <b>لازم است؟ «بردار»؛ لازم نیست؟ «دست نگه دار».</b>') : engine.ready ? (game.id==='space'?uiText('<b>سفینه آماده‌ست! حالا پرتاب کن.</b>'):uiText('<b>کوله آماده‌ست! قبل از پایان زمان راهی شو.</b>')) : lt`<b>${fa(engine.required.length)} وسیلهٔ ضروری</b> رو پیدا کن.${game.id==='space'?uiText(' اول موانع رو کنار بزن.'):''}`}</span>`;
    arena.innerHTML=game.id==='ark'?arkScene(engine,missionChecklist(engine)):spaceScene(engine,missionChecklist(engine));
    controls.innerHTML = engine.practice ? lt`<button class="button response-button collect-button" data-action="item" data-index="${engine.currentItem.id}" ${engine.currentItem.blocked?'disabled':''}>${icon('bag')} بردار</button><button class="button wait-button" data-action="reject-item" ${engine.currentItem.blocked?'disabled':''}>${icon('wait')} دست نگه دار</button>` : `${missionInventory(engine)}<button class="button primary depart-button" data-action="depart" ${engine.ready?'':'disabled'}>${icon(game.id==='space'?'rocket':engine.ready?'check':'bag')}${game.id==='space'?uiText('پرتاب سفینه'):uiText('سوار کشتی شو')} ${icon('arrow')}</button>`;
  }
}

function renderResultActions() {
  const actions=document.querySelector('.result-actions');
  if(route!=='result'||!engine||!actions)return;
  const practice=engine.practice,morePractice=practice&&needsMorePractice(engine.result);
  const button=(action,label,style='subtle')=>`<button class="button ${style}" data-action="${action}">${label}</button>`;
  const repeat=button('repeat-practice',uiText('دوباره تمرین کنیم'),morePractice?'primary':'subtle');
  let content;
  if(sessionAssessment){
    const next=nextAssessmentGame(clients);
    const onward=button(next?'assessment-next':'assessment',next?uiText('ادامهٔ ارزیابی بازی بعد'):uiText('جمع‌بندی ارزیابی هفت بازی'),morePractice?'subtle':'primary');
    content=(morePractice?repeat+onward:onward+repeat)+button('assessment',uiText('مسیر ارزیابی و استراحت'));
  }else if(practice){
    const main=button('main-game',uiText('بزن بریم بازی اصلی'),morePractice?'subtle':'primary');
    content=(morePractice?repeat+main:main+repeat)+button('detail',uiText('برگشت به راهنما'));
    if(sessionIsBaseline)content+=uiText('<button class="text-button" data-action="assessment">ارزیابی سایر بازی‌ها</button>');
  }else content=button('replay',lt`دوباره بازی کن ${icon('repeat')}`,'primary')+button('home',uiText('انتخاب بازی دیگه'));
  actions.innerHTML=content+uiText('<button class="text-button" data-action="dashboard">دیدن اطلاعات کاربر و گزارش‌ها</button>');
  if(pendingSave)actions.querySelectorAll('button').forEach(button=>button.disabled=true);
}

function finish({renderOnly=false}={}) {
  if(pendingLocale){setLocale(pendingLocale);clients.locale=pendingLocale;pendingLocale=null;}
  const session = engine, result = session.result, game = GAME_MAP[selectedGame]; route = 'result';
  if (modal.open) modal.close();
  const needsSave=!session.practice||sessionIsBaseline;
  if(needsSave&&!renderOnly)pendingSave={run:remoteRun,result,childId:clients.activeId,ownerId:currentUser.id};
  const recommendation = recommendLevel(result);
  const morePractice=session.practice&&needsMorePractice(result);
  if (sessionIsBaseline) selectedLevel = recommendation.level;
  const ratio = result.maxScore ? result.score/result.maxScore : 0;
  const stars = !result.completed?0:ratio>=.85?3:ratio>=.5?2:ratio>0?1:0;
  const title = session.practice ? sessionIsBaseline ? uiText('ارزیابی پایه کامل شد') : morePractice ? uiText('یک فرصت تازه برای تمرین!') : uiText('تمرین تموم شد، آماده‌ای؟') : !result.completed ? uiText('این سفر هنوز ادامه داره!') : ratio>=.85 ? uiText('چه تمرکز درخشانی!') : ratio>=.5 ? uiText('آفرین، خوب پیش رفتی!') : uiText('هر بار، یک قدم بهتر!');
  const caption = morePractice ? uiText('پنج تمرین رو انجام دادی. پیشنهاد می‌کنیم یک بار دیگه با هم تمرین کنیم؛ می‌تونی مسیرت رو هم ادامه بدی.') : session.practice ? sessionIsBaseline ? uiText('نتیجهٔ این پنج تمرین جدا از بازی اصلی در اطلاعات کاربر نگهداری می‌شود. پیشنهاد سطح اولیه براساس همین تمرین‌هاست.') : uiText('پنج تمرین رو انجام دادی. هر وقت آماده بودی، می‌تونی ماجراجویی اصلی رو شروع کنی.') : !result.completed ? result.hits===result.maxScore?uiText('همهٔ وسایل را پیدا کردی! دفعهٔ بعد، پیش از پایان زمان دکمهٔ حرکت را بزن.'):uiText('زمان تمام شد؛ در مرور پایین، نیازهای باقی‌ماندهٔ سفر را بشناس و دوباره امتحان کن.') : game.kind==='adventure' ? session.mission.success : uiText('مهم‌ترین بخشش رو انجام دادی: با دقت بازی کردی. آمادهٔ یک چالش دیگه‌ای؟');
  page(lt`<section class="result-card">${game.id==='hunt'&&!session.practice?huntOutcomeArt(session):game.id==='stroop'&&!session.practice?stroopOutcomeArt(session):game.id==='nback'&&!session.practice?memoryOutcomeArt(session):game.id==='search'&&!session.practice?searchOutcomeArt(session):game.id==='traffic'&&!session.practice?trafficOutcome(trafficProgress(session),session):game.kind==='adventure'&&!session.practice?missionOutcomeArt(game.id,result.completed):trophyArt()}<div class="eyebrow">${session.practice?uiText('۵ تمرین آموزشی'):uiText('پایان بازی')} <span>·</span> ${game.title}</div><h1>${title}</h1><p class="result-caption">${caption}</p>${!session.practice?lt`<div class="result-stars" aria-label="${fa(stars)} ستاره از ۳">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${i<stars?'★':'☆'}</span>`).join('')}</div>`:''}<div class="result-main-score"><b>${fa(result.score)}</b><span>از ${fa(result.maxScore)} ${session.practice?uiText('پاسخ هدف'):uiText('امتیاز')}</span></div><div class="result-stats"><div>${icon('check')}<b>${fa(result.hits)}</b><span>انتخاب هدف درست</span></div><div>${icon('target')}<b>${fa(result.falseSelections)}</b><span>انتخاب اشتباه</span></div><div>${icon('info')}<b>${fa(result.omissions)}</b><span>هدف بدون پاسخ</span></div><div>${icon('clock')}<b>${time(result.durationMs)}</b><span>زمان فعال بازی</span></div><div>${icon('check')}<b>${fa(result.longestStreak)}</b><span>تصمیم درست متوالی</span></div>${game.kind==='reaction'?lt`<div>${icon('pause')}<b>${fa(result.correctRejections)}</b><span>خودداری درست از پاسخ</span></div>`:''}${result.meanReactionMs!==null?`<div>${icon('spark')}<b>${fa(result.meanReactionMs)} <small>ms</small></b><span>${result.reactionMeasure==='decision-interval'?uiText('میانگین زمان انتخاب درست'):uiText('میانگین واکنش درست')}</span></div>`:''}</div>${stroopScorecard(session)}${learningRecap(session)}${game.kind==='reaction'?uiText('<p class="score-note">امتیاز = هدف‌های درست، منهای انتخاب‌های اشتباه؛ حداقل صفر.</p>'):''}${!session.practice || sessionIsBaseline?lt`<p class="local-note">${icon('check')} در حال ثبت نتیجه در سرور مرکز…</p>`:''}<div class="result-actions"></div></section>`, 'result-main');
  if (!session.practice || sessionIsBaseline) {
    const note = document.querySelector('.local-note');
    note.innerHTML=lt`${icon('clock')} در حال ثبت نتیجه در سرور مرکز…`;
    const best = (clients.panelSummary&&sessionBestScore!==null?[{score:sessionBestScore,maxScore:result.maxScore}]:comparableRecords(profileRecords(clients),{kind:'training',result}).map(r=>r.result)).sort((a,b)=>b.score-a.score || Number(b.completed)-Number(a.completed))[0];
    if (Number.isFinite(best?.score)) document.querySelector('.result-main-score').insertAdjacentHTML('afterend', lt`<p class="best-score">${icon('trophy')} بهترین امتیاز تو در سطح ${LEVELS[result.level].label}: <b>${fa(best.score)} از ${fa(best.maxScore)}</b></p>`);
  }
  if(result.variant && result.variant!=='standard')document.querySelector('.result-caption').insertAdjacentHTML('afterend',`<span class="variant-note">${variantLabel(result.variant)}</span>`);
  document.querySelector('.result-actions').insertAdjacentHTML('beforebegin', lt`<div class="level-recommendation"><b>سطح پیشنهادی ${sessionIsBaseline?uiText('برای شروع'):uiText('برای نوبت بعد')}: ${LEVELS[recommendation.level].label}</b><p>${recommendation.reason}</p><button class="text-button" data-action="recommended-level" data-level="${recommendation.level}">انتخاب سطح و دیدن راهنما ←</button></div>`);
  if(morePractice)document.querySelector('.result-learning')?.setAttribute('open','');
  renderResultActions();
  if(currentUser.role!=='admin')document.querySelector('.level-recommendation button')?.remove();
  announcer.textContent = title;
  renderSaveStatus();
  if(needsSave&&!renderOnly)void persistPending();
}

function openModal(content, kind) {
  if (modal.open) modal.close(); modalKind=kind; modal.innerHTML = content; modal.showModal();
  queueMicrotask(()=>navigationGuard.sync());
  if(route==='play'&&engine)playMotion.sync(document.querySelector('.play-panel'),engine,{paused:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
}
function about() {
  if (route==='play' && engine){if(!engine.paused)engine.pause();preparationClock?.pause();}
  openModal(lt`<button class="modal-close icon-button" data-action="close-modal" aria-label="بستن راهنما">${icon('close')}</button><span class="big-spark">✳</span><h2 id="modal-title">بازی کنیم، کشف کنیم!</h2><p>حواس هفت بازی برای تمرین دقت و حافظه داره. تمرین‌ها و نتیجه‌های هر نفر در حساب خودش ذخیره می‌شن.</p><ol class="modal-steps"><li><b>۱</b><span>از صفحهٔ اصلی، یک بازی انتخاب کن.</span></li><li><b>۲</b><span>با پنج تمرین کوتاه، قانون بازی رو یاد بگیر.</span></li><li><b>۳</b><span>بازی اصلی رو انجام بده و نتیجه‌ات رو ببین.</span></li></ol><p class="modal-small">روی گوشی با لمس بازی کن؛ روی کامپیوتر از ماوس و در بازی‌های واکنشی از کلید فاصله استفاده کن. صدا رو هم می‌تونی از بالای صفحه روشن کنی.</p><button class="button primary full-width" data-action="close-modal">فهمیدم ${icon('check')}</button>`, 'about');
}
function pause() {
  if (route!=='play'||!engine) return;
  guidance.stop();
  engine.pause(); preparationClock?.pause(); if(engine.done) return finish();
  openModal(lt`<span class="pause-emblem">${icon('pause')}</span><h2 id="modal-title">یک نفس تازه کن.</h2><p>بازی و زمان متوقف شده. هر وقت آماده بودی، از همین‌جا ادامه بده.</p>${guideControl(guidanceKey({...engine,...gameOptions(),n:engine.n,phase:engine.current?.phase}))}${languageSelector(pendingLocale||getLocale())}<div class="modal-buttons"><button class="button primary" data-action="resume">ادامهٔ بازی ${icon('play')}</button><button class="button subtle" data-action="restart">از اول شروع کن ${icon('repeat')}</button><button class="text-button" data-action="home">برگشت به بازی‌ها ${icon('home')}</button></div>`, 'pause');
}
function closeModal() {
  guidance.stop();
  if(modal.open) modal.close();
  if(route==='play'&&engine){if(playPhase==='countdown')preparationClock?.resume();else if(playPhase==='playing'&&engine.paused)engine.resume();updatePlay();}
  if(route==='play'&&['hunt','traffic','nback','stroop'].includes(engine?.gameId)&&modalKind==='pause'&&!modal.open){
    (document.querySelector('.response-button:not(:disabled)')||document.querySelector('#main'))?.focus({preventScroll:true});
  }
  refreshAdminAfterDialog();
}
function syncSoundControls(){
  document.querySelectorAll('.sound-button').forEach(node=>{node.innerHTML=icon(progress.sound?'sound':'mute');node.setAttribute('aria-pressed',String(progress.sound));node.setAttribute('aria-label',progress.sound?uiText('خاموش‌کردن صدا و راهنمای گویا'):uiText('روشن‌کردن صدا و راهنمای گویا'));});
}
function narrateEntry(key){
  const identity=`${currentUser?.id}:${clients.activeId}:${selectedGame}`;
  if(guidanceVisit?.identity!==identity)guidanceVisit={identity,attempted:false};
  if(guidanceVisit.attempted)return;
  guidanceVisit.attempted=true;
  if(progress.sound&&key)void guidance.play(key);
}

function changeMemoryLesson(action){
  const step=lessonState?.steps[lessonState.index];if(route!=='detail'||step?.kind!=='memory')return;
  guidance.stop();
  if(action==='lesson-memory-next')lessonState.memoryIndex=Math.min(step.stimuli.length-1,(lessonState.memoryIndex||0)+1);
  if(action==='lesson-memory-help')lessonState.memoryHelp=true;
  if(action==='lesson-memory-replay'){lessonState.memoryIndex=0;lessonState.memoryHelp=false;lessonState.answered=false;}
  document.querySelector('#lesson-box').innerHTML=lessonContent();
  document.querySelector('#lesson-box [data-action="lesson-memory-next"],#lesson-box [data-action="lesson-answer"]')?.focus({preventScroll:true});
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
function answer(result,context={}) {
  if(result===null||result===undefined){updatePlay();return;}
  const good=result===true||result==='cleared',kind=result==='cleared'?'cleared':good?'good':'wrong';
  const sourceNode=context.itemId!==undefined?document.querySelector(`.scene-object[data-index="${context.itemId}"]`):context.searchIndex!==undefined?document.querySelector(`.search-choice[data-index="${context.searchIndex}"]`):context.choiceIndex!==undefined?document.querySelector(`.hunt-choice[data-choice="${context.choiceIndex}"]`):document.querySelector(['hunt','traffic','nback','stroop'].includes(engine.gameId)?'.response-button':'.focus-corners');
  const source=captureMotionSource(sourceNode);
  tone(good);if(engine?.feedback)announcer.textContent=engine.feedback;
  updatePlay();if(route!=='play')return;
  document.querySelector('.play-panel').dataset.response=good?'good':'wrong';
  const visual=document.querySelector('#visual-feedback');
  if(visual){
    visual.dataset.kind=kind;
    const label=visual.querySelector('.feedback-label');
    if(label)label.textContent=kind==='cleared'?uiText('راه باز شد'):good?uiText('آفرین!'):!engine.practice&&GAME_MAP[engine.gameId].kind==='adventure'?uiText('۲ ثانیه کمتر'):uiText('دوباره ببین');
    playMotion.toast(visual);
  }
  playMotion.burst(source,kind);
  if(context.itemId!==undefined&&result===true&&!engine.practice){const item=engine.items.find(item=>item.id===context.itemId);playMotion.fly(source,document.querySelector(`.inventory-slot[data-equipment="${item.icon}"]`));}
  if(context.itemId!==undefined){const item=document.querySelector(`[data-action="item"][data-index="${context.itemId}"]`);if(item)item.dataset.effect=result==='cleared'?'cleared':result?'packed':'rejected';}
  if(context.searchIndex!==undefined&&result===true&&engine.gameId==='search'){
    const outcome=engine.outcomes.at(-1);
    if(engine.index+1===outcome?.round){
      const destination=engine.review?document.querySelector('.review-targets .ready-token'):engine.roundBreak?document.querySelector('.round-emblem'):document.querySelector(`.target-status.discovered[data-target-index="${outcome.stimulus.targetIndex}"]`);
      playMotion.fly(source,destination);
    }
  }
  if(context.choiceIndex!==undefined){const choice=document.querySelector(`.hunt-choice[data-choice="${context.choiceIndex}"]`);if(choice)choice.dataset.picked=kind;}
}

async function profiles(){return adminUsers();}
function continueAfterProfile() {
  if (pendingStart) { const next = pendingStart; pendingStart = null; return start(next.practice, next.forceBaseline); }
  return home();
}
async function dashboard() {
  if(publicReportData)return refreshPublicReport();
  if(currentUser?.role==='admin'&&inspectedUserId){
    if(route!=='admin-user')return inspectUser(inspectedUserId);
    activateUserTab('sessions');return loadUserTab();
  }
  if(!currentUser)return showLogin();const view=beginView();if(!await refreshClients(view))return;
  if(!await loadReportData(view))return;
  guideState=null;engine=null;route='reports';if(modal.open)modal.close();setHash('#reports');
  document.title=uiText('گزارش تمرین‌ها — حواس');page(reportsView(clients,reportState,currentUser),'content-main reports-main');
}

function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportProfile() {
  if(currentUser.role!=='admin'||!clients.activeId)return;
  const view={version:viewVersion,userId:currentUser.id,role:currentUser.role};
  const data=await viewRequest(view,`/children/${clients.activeId}/export`);
  if(currentView(view))download(JSON.stringify(data,null,2),'application/json;charset=utf-8','havaas-profile.json');
}
async function exportTrials() {
  if(currentUser.role!=='admin')return;
  const view={version:viewVersion,userId:currentUser.id,role:currentUser.role};
  const records=profileRecords(clients).filter(r=>(!reportState.game||r.result.gameId===reportState.game)&&(!reportState.level||r.result.level===reportState.level)&&(!reportState.variant||variantOf(r.result)===reportState.variant)&&(!reportState.kind||r.kind===reportState.kind));
  const record=clients.reportPage?.selected||records.find(r=>r.id===reportState.recordId)||records.at(-1);if(!record)return;
  try{
    const response=await fetch(`/api/children/${clients.activeId}/sessions/${record.id}/export`,{credentials:'same-origin',headers:{'X-App-Locale':getLocale()}});
    if(!currentView(view)){await response.body?.cancel();return;}
    if(!response.ok){
      let error;try{error=await response.json();}catch{}
      throw new ApiError(typeof error?.error==='string'?uiText(error.error):uiText('این فایل در دسترس نیست یا اجازهٔ دریافتش را ندارید.'),response.status,typeof error?.code==='string'?error.code:'EXPORT_FAILED');
    }
    if(response.headers.get('Content-Type')?.split(';',1)[0].trim().toLowerCase()!=='text/csv'){
      await response.body?.cancel();throw new ApiError(uiText('فایل CSV درست دریافت نشد. دوباره تلاش کنید.'),response.status,'INVALID_RESPONSE');
    }
    const data=await response.text();if(currentView(view))download('\uFEFF'+data.replace(/^\uFEFF/,''),'text/csv;charset=utf-8','havaas-responses.csv');
  }catch(error){
    if(!currentView(view))return;
    if(error instanceof ApiError){const failure=await accountError(error,view.userId,view.role);if(currentView(view))throw failure;return;}
    throw new ApiError(uiText('فایل دریافت نشد. دوباره تلاش کنید.'),0,'NETWORK_ERROR',{cause:error});
  }
}
app.addEventListener('submit',event=>{event.preventDefault();void submitForm(event.target).catch(showError);});
function acknowledgeForm(form,data){
 if(data?.user){form.dataset.revision=String(data.user.revision||1);const input=form.querySelector('[name=username]');if(input)input.value=data.user.username;}
 if(data?.profile){form.dataset.profileRevision=String(data.profile.revision||1);if(form.id==='profile-form')form.dataset.revision=String(data.profile.revision||1);}
 navigationGuard.acknowledge(form,form.submission||formTracker.capture(form));
}
function refreshFailure(error,retry=null){
 if(error.code==='STALE_RESPONSE')return;
 if(error.status===401||error.code==='PASSWORD_CHANGE_REQUIRED')return showError(error);
 if(retry)pendingPanelRefresh={view:{version:viewVersion,userId:currentUser?.id,role:currentUser?.role},retry};
 notify(uiText('تغییرات ذخیره شد، اما فهرست به‌روز نشد. برای دیدن آخرین اطلاعات دوباره تلاش کنید.'));
 const node=document.querySelector('#account-status')||document.querySelector('#app-status');
 if(node&&!node.querySelector('[data-action=refresh-panel]'))node.insertAdjacentHTML('beforeend',uiText(' <button class="button subtle" data-action="refresh-panel">دریافت دوبارهٔ اطلاعات</button>'));
}
async function retryPanelRefresh(){
 const pending=pendingPanelRefresh;pendingPanelRefresh=null;if(pending&&currentView(pending.view))return pending.retry();
 if(route==='report-links')return refreshReportLinks({version:viewVersion,userId:currentUser.id,role:currentUser.role},clients.activeId);
 if(route==='admin-user')return inspectUser(inspectedUserId);
 if(route==='admin-users')return adminUsers();if(route==='invitations')return adminInvitations();if(route==='admin')return adminPanel();
 return refreshClients();
}
async function refreshReportLinks(view,childId){
 const data=await viewRequest(view,`/children/${childId}/report-links`);if(!currentView(view)||route!=='report-links')return;
 const holder=document.createElement('div');holder.innerHTML=reportLinksView(data.links,activeProfile(clients));
 const sections=document.querySelectorAll('main>section.surface'),fresh=holder.querySelectorAll('section.surface');
 if(sections.length>1&&fresh.length>1)sections[sections.length-1].innerHTML=fresh[fresh.length-1].innerHTML;
}
function reportQuery(view='panel'){
 const params=new URLSearchParams({view,page:reportState.page||1,pageSize:20,game:reportState.game||'',level:reportState.level||'',variant:reportState.variant||'',kind:reportState.kind??'training'});
 if(reportState.recordId)params.set('recordId',reportState.recordId);return params;
}
async function loadReportData(view){
 if(!clients.panelSummary)return true;
 const jobs=[viewRequest(view,`/children/${clients.activeId}/reports?${reportQuery()}`)];
 if(currentUser.role==='admin')jobs.push(viewRequest(view,`/users?role=user&page=${clients.selectorPage||1}&pageSize=20&search=${encodeURIComponent(clients.selectorSearch||'')}`));
 const [report,users]=await Promise.all(jobs);if(!currentView(view)||!report)return false;
 clients.reportPage=report;
 if(users){clients.selectorPages=users.pagination.pages;clients.selectorPage=users.pagination.page;clients.selectorProfiles=users.users.filter(u=>u.childId).map(u=>({id:u.childId,ownerUserId:u.id,firstName:u.name,lastName:''}));const active=activeProfile(clients);if(active&&!clients.selectorProfiles.some(p=>p.id===active.id))clients.selectorProfiles.unshift(active);}
 return true;
}
function activateUserTab(tab){
 userTab=tab;viewVersion++;
 document.querySelectorAll('.user-tabs [role=tab]').forEach(node=>{const active=node.dataset.tab===tab;node.classList.toggle('selected',active);node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;});
 document.querySelectorAll('[id^="user-"][role=tabpanel]').forEach(panel=>panel.hidden=panel.id!==`user-${tab}`);
}
async function loadUserTab(){
 if(userTab==='audit')return showAudit(true);
  if(userTab==='difficulty')return loadProfileAssignmentSummary();
 if(userTab!=='sessions')return;
 const panel=document.querySelector('#user-sessions');if(!panel)return;
 const view=beginView();panel.setAttribute('aria-busy','true');
 try{if(!await loadReportData(view)||!currentView(view))return;panel.innerHTML=reportsView(clients,reportState,currentUser);}
 catch(error){if(currentView(view))showError(error);}
 finally{if(currentView(view))panel.removeAttribute('aria-busy');}
}
async function showAudit(embedded=route==='admin-user'&&userTab==='audit'){
 if(currentUser?.role!=='admin')return home();const view=beginView();
 const query=new URLSearchParams({...auditState,pageSize:20,...(embedded?{userId:inspectedUserId}:{})});
 const [data,actors,targets]=await Promise.all([viewRequest(view,`/admin/audit-events?${query}`),viewRequest(view,`/users?pageSize=20&search=${encodeURIComponent(auditState.actorSearch)}`),embedded?Promise.resolve(null):viewRequest(view,`/users?pageSize=20&search=${encodeURIComponent(auditState.targetSearch)}`)]);if(!currentView(view)||!data)return;auditState.page=data.pagination.page;data.actors=actors?.users||[];data.targets=targets?.users||[];
 for(const [id,options] of [[auditState.actorId,data.actors],[embedded?null:auditState.userId,data.targets]])if(id&&!options.some(user=>user.id===id)){const selected=await viewRequest(view,`/users/${id}`);if(!currentView(view))return;if(selected?.user)options.push(selected.user);}
 if(embedded){const panel=document.querySelector('#user-audit');if(panel)panel.innerHTML=auditView(data,auditState,true);return;}
 route='audit';setHash('#admin/audit');page(auditView(data,auditState),'content-main admin-main');
}
async function refreshPublicReport(viewMode='panel'){
 const token=location.hash.match(/^#report\/([a-f0-9]{64})$/)?.[1];if(!token)return renderPublicReport();
 const view=beginView(),body={...Object.fromEntries(reportQuery(viewMode)),token};delete body.recordId;if(reportState.recordId)body.recordRef=reportState.recordId;
 const data=await viewRequest(view,'/public/report',{method:'POST',body});if(!currentView(view))return;
 publicReportData=data;return renderPublicReport();
}
async function loadSessionDetails(details){
 if(currentUser?.role!=='admin'||!details||details.dataset.loaded==='true')return;
 const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},id=details.dataset.sessionDetail;
 if(!id)return;details.setAttribute('aria-busy','true');
 try{
  const data=await viewRequest(view,`/children/${clients.activeId}/sessions/${id}`);if(!currentView(view)||!details.isConnected||!data)return;
  if(clients.reportPage?.selected?.id!==id)return;
  clients.reportPage.selected={...clients.reportPage.selected,result:data.record.result};
  const holder=document.createElement('div');holder.innerHTML=reportsView(clients,reportState,currentUser);const fresh=holder.querySelector('.outcome-details');
  if(fresh)details.innerHTML=fresh.innerHTML;details.dataset.loaded='true';
 }catch(error){if(currentView(view)){if(error.status===401||error.status===403)return showError(error);details.innerHTML=uiText('<summary>جزئیات جلسه</summary><p role="alert">جزئیات جلسه دریافت نشد. دوباره تلاش کنید.</p><button class="button subtle" data-action="retry-details">تلاش دوباره</button>');}}
 finally{if(details.isConnected)details.removeAttribute('aria-busy');}
}
async function printReport(){
 if(!clients.reportPage&&!publicReportData?.pagination)return window.print();
 const view={version:viewVersion,userId:currentUser?.id,role:currentUser?.role},publicView=!!publicReportData;
 let data,state;
 if(publicView){const token=location.hash.match(/^#report\/([a-f0-9]{64})$/)?.[1],body={...Object.fromEntries(reportQuery('print')),token};delete body.recordId;if(reportState.recordId)body.recordRef=reportState.recordId;data=await viewRequest(view,'/public/report',{method:'POST',body});if(!currentView(view))return;const id='shared-report',adapt=r=>r?{id:r.ref,profileId:id,kind:r.kind,result:r.result}:null;state={activeId:id,profiles:[{id,firstName:data.displayName,lastName:''}],records:[],reportPage:{...data,records:data.records.map(adapt),selected:adapt(data.selected),trend:data.trend.map(adapt)}};
 }else{data=await viewRequest(view,`/children/${clients.activeId}/reports?${reportQuery('print')}`);if(!currentView(view))return;state={...clients,reportPage:data};}
 const overlay=document.createElement('div');overlay.id='report-print-overlay';overlay.innerHTML=reportsView(state,reportState,publicView?{role:'public'}:currentUser);document.body.append(overlay);document.body.classList.add('printing-report');
 try{window.print();}finally{overlay.remove();document.body.classList.remove('printing-report');}
}
app.addEventListener('toggle',event=>{if(event.target.matches?.('.outcome-details[open]'))void loadSessionDetails(event.target);},{capture:true});
for(const type of ['input','change'])document.addEventListener(type,event=>{const form=event.target.closest?.('form');if(form){delete form.dataset.acknowledged;formTracker.changed(form);}},{capture:true});

async function submitForm(form){
  if(form.dataset.waiting==='true')return;
  const submission=formTracker.capture(form);form.submission=submission;
  if(form.dataset.acknowledged==='true')return;
  form.dataset.waiting='true';form.setAttribute('aria-busy','true');
  const controls=[...form.querySelectorAll('input,textarea,select,button')].map(control=>({control,disabled:control.disabled}));
  controls.forEach(({control})=>control.disabled=true);
  try{const result=await processForm(form);if(result!==false)navigationGuard.acknowledge(form,submission);return result;}finally{delete form.dataset.waiting;form.removeAttribute('aria-busy');controls.forEach(({control,disabled})=>control.disabled=disabled);pwa?.sync();}
}
async function processForm(form){
  const values=Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name||el.getAttribute('name'),el.value]));
  if(form.id==='training-profile-form')return saveTrainingProfile(form,values);
  if(form.id==='login-form'){
    if(!api.csrfToken)await request('/auth/session');
    const auth=await request('/auth/login',{method:'POST',body:values});
    if(pendingSave&&auth.user.id!==pendingSave.ownerId){await request('/auth/logout',{method:'POST'});await request('/auth/session');throw Error(uiText('برای ذخیرهٔ نتیجه، با همان حسابی وارد شوید که بازی را با آن انجام دادید.'));}
    currentUser=auth.user;
    if(pendingSave){if(modal.open)modal.close();return persistPending();}
    if(inviteToken){inviteInfo=await request('/invitations/inspect',{method:'POST',body:{token:inviteToken}});return showLogin(inviteInfo);}
    return openSignedInHome(auth);
  }
  if(form.id==='accept-form'){
    const auth=await request('/invitations/accept',{method:'POST',body:{...values,token:inviteToken}});history.replaceState?.({},'',location.pathname);return openSignedInHome(auth);
  }
  if(form.id==='password-form'){const wasForced=currentUser.passwordChangeRequired;const data=await request('/auth/change-password',{method:'POST',body:values});currentUser=data.user;form.reset?.();if(wasForced)return openSignedInHome(data);return notify(uiText('رمز تغییر کرد. اگر حواس در دستگاه دیگری باز است، باید آنجا هم دوباره وارد شوید.'));}
  if(form.id==='registration-form'){
    const auth=await request('/public/registration/complete',{method:'POST',body:{token:registrationToken,username:values.username,password:values.password,email:values.email,profile:values}});history.replaceState?.({},'',location.pathname);return openSignedInHome(auth);
  }
  if(form.id==='registration-link-form'){
    const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},data=await request('/registration-links',{method:'POST',body:values});acknowledgeForm(form);if(!currentView(view))return false;
    if(form.isConnected&&modal.open){form.hidden=true;showInvitation(data);}scheduleAdminRefresh(view);return;
  }
  if(form.id==='audit-filter-form'){Object.assign(auditState,values,{page:1});return showAudit();}
  if(form.id==='import-target-filter'){return loadImportTargets(values.search,1);}
  if(form.id==='report-client-filter'){clients.selectorSearch=values.search;clients.selectorPage=1;return dashboard();}
  if(form.id==='user-filter-form'){Object.assign(adminState,values,{page:1});return adminUsers();}
  if(form.id==='create-user-form'){
    const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},preview=previewImport,data=await request('/users',{method:'POST',body:{...values,profile:values}});
    acknowledgeForm(form);if(!currentView(view))return false;if(!form.isConnected||!modal.open){scheduleAdminRefresh(view);return;}
    if(form.dataset.importSource&&preview&&preview===previewImport){const source=form.dataset.importSource;const choices=new Map([...document.querySelectorAll('.import-mapping')].map(row=>[row.dataset.source,row.querySelector('[name=targetId]').value]));if(data.profile&&!clients.profiles.some(p=>p.id===data.profile.id))clients.profiles.push(data.profile);preview.profiles.forEach(p=>p.targetId=p.sourceId===source?data.profile.id:choices.get(p.sourceId)||p.targetId);if(modal.open)modal.close();const target=document.querySelector('#import-preview');if(target)target.innerHTML=importPreviewView(preview,clients.profiles);return notify(uiText('کاربر ساخته شد؛ انتقال سوابق را تأیید کنید.'));}
    if(data.url){openModal(uiText('<h2 id="modal-title">دعوت مدیر</h2><div id="invitation-result"></div><button class="button subtle" data-action="close-modal">بستن</button>'),'invitation');showInvitation(data);}else{if(modal.open)modal.close();}notify(uiText('کاربر با موفقیت ساخته شد.'));void refreshCreatedUsers();return;
  }
  if(form.id==='edit-user-form'){const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},body={username:values.username,...(form.dataset.role==='user'?{profile:values}:{name:values.name})};body.expectedRevision=Number(form.dataset.revision);if(body.profile)body.expectedProfileRevision=Number(form.dataset.profileRevision);const data=await request(`/users/${form.dataset.user}`,{method:'PATCH',body});acknowledgeForm(form,data);if(data.user.id===currentUser.id)currentUser=data.user;if(!currentView(view)||!form.isConnected)return false;notify(uiText('اطلاعات کاربر ذخیره شد.'));try{await inspectUser(data.user.id);notify(uiText('اطلاعات کاربر ذخیره شد.'));}catch(error){if(currentUser?.id===view.userId)refreshFailure(error);}return;}
  if(form.id==='report-link-form'){const childId=clients.activeId,version=viewVersion;const data=await request(`/children/${childId}/report-links`,{method:'POST',body:values});acknowledgeForm(form);if(version!==viewVersion||childId!==clients.activeId)return;showInvitation(data);form.hidden=true;document.querySelector('#invitation-result')?.insertAdjacentHTML('beforeend',uiText('<button class="button subtle" data-action="new-report-link">ساخت لینک جدید</button>'));notify(uiText('لینک ساخته شد.'));try{await refreshReportLinks({version:viewVersion,userId:currentUser.id,role:currentUser.role},childId);}catch(error){if(version===viewVersion)refreshFailure(error);}return;}
  if(form.id==='admin-difficulty-form'){
    const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},childId=clients.activeId,custom=values.level.startsWith('profile:');
    try{
      const data=await request(`/children/${childId}/difficulty`,{method:'PATCH',body:{...policyOptions(values.gameId,values.variant),mode:custom?'fixed':values.mode,level:custom?undefined:values.level,trainingProfileId:custom?values.level.slice(8):null,expectedRevision:Number(form.dataset.revision||0)}});
      if(data.setting){const row=data.setting,setting={gameId:row.game_id??row.gameId,variant:row.variant,protocolVersion:row.protocol??row.protocolVersion,mode:row.mode,level:row.level,revision:row.revision,trainingProfileId:row.trainingProfileId,trainingProfile:row.trainingProfile};clients.difficulties=clients.difficulties.filter(d=>d.gameId!==setting.gameId||d.variant!==setting.variant||d.protocolVersion!==setting.protocolVersion);clients.difficulties.push(setting);form.dataset.revision=String(setting.revision);}
      acknowledgeForm(form);if(!currentView(view))return false;notify(uiText('تنظیم سطح برای جلسهٔ بعد ذخیره شد.'));
      try{if(!await refreshClients(view))return;syncPolicyControls(false);await loadProfileAssignmentSummary();}catch(error){if(currentUser?.id===view.userId)refreshFailure(error);}
    }catch(error){if(form.isConnected&&currentView(view))document.querySelector('#policy-profile-error').textContent=error.message;throw error;}return;
  }
  if(form.id==='invitation-form'){const data=await request('/invitations',{method:'POST',body:values});return showInvitation(data);}
  if(form.id!=='profile-form')return false;
  const validation=validateProfile(values);if(validation.error){document.querySelector('#profile-error').textContent=validation.error;return false;}
  const data=await request(editingProfile?`/children/${editingProfile}`:'/children',{method:editingProfile?'PATCH':'POST',body:{...validation.profile,expectedRevision:Number(form.dataset.revision||1),...(values.ownerUserId?{ownerUserId:values.ownerUserId}:{})}});
  acknowledgeForm(form,data);clients.activeId=data.profile.id;notify(uiText('مشخصات ذخیره شد.'));
  try{
   await refreshClients();if(pendingStart)return continueAfterProfile();
   if(inspectedUserId){await inspectUser(inspectedUserId);return notify(uiText('مشخصات کاربر ذخیره شد.'));}return profiles(null,uiText('مشخصات ذخیره شد.'));
  }catch(error){refreshFailure(error);}
}
app.addEventListener('change',event=>{void changeInput(event).catch(showError);});
modal.addEventListener('change',event=>{void changeInput(event).catch(showError);});
const reportExportLocks=new WeakMap();
async function refreshFilteredReport(){
 const buttons=[...document.querySelectorAll('[data-action="export-profile"],[data-action="export-trials"]')];
 for(const button of buttons){
  const lock=reportExportLocks.get(button)||{pending:0,disabled:button.disabled};
  lock.pending++;reportExportLocks.set(button,lock);button.disabled=true;
 }
 try{await dashboard();}
 finally{
  for(const button of buttons){
   const lock=reportExportLocks.get(button);if(--lock.pending===0){if(button.isConnected)button.disabled=lock.disabled;reportExportLocks.delete(button);}
  }
 }
}
async function changeInput(event){
  if(event.target.matches('[data-locale-select]'))return changeLanguage(event.target);
  if(event.target.id==='policy-level'){syncProfileChoice(true);return;}
  if(event.target.matches('[data-birth-part]'))return syncBirthDate(event.target.closest('[data-birth-date]'));
  if(event.target.matches('[data-audit-date-part]'))return syncAuditDate(event.target.closest('[data-audit-date]'));
  if(['new-user-role','new-user-method','new-user-child'].includes(event.target.id))return syncCreateControls();
  if(['policy-game','policy-variant'].includes(event.target.id))return changePolicySelection(event.target);
  if(event.target.id==='import-file'){const file=event.target.files?.[0];if(file)return previewLegacy(async()=>JSON.parse(await file.text()));}
  if(event.target.id==='report-profile') {
    if(!await navigationGuard.allow(submitForm)){event.target.value=clients.activeId;return;}
    const profile=(clients.selectorProfiles||clients.profiles).find(p=>p.id===event.target.value);if(!profile)return;
    clients.activeId=profile.id;reportState.recordId=null;reportState.variant='';reportState.page=1;
    if(currentUser.role==='admin'&&inspectedUserId){inspectedUserId=profile.ownerUserId||null;if(inspectedUserId)return inspectUser(inspectedUserId);}
    await dashboard();
  }
  const filter=event.target.dataset.reportFilter;
  if(['game','level','variant','kind'].includes(filter)) {reportState[filter]=event.target.value;reportState.recordId=null;reportState.page=1;await refreshFilteredReport();}
}
async function handleAction(event) {
  const fromReactionPointer=event.type==='click'&&event.detail>0&&reactionPointerInput;if(event.type==='click')reactionPointerInput=false;
  const button = event.target.closest('[data-action]'); if(!button||button.disabled) return;
  const action=button.dataset.action;
  if(button.tagName==='A')event.preventDefault();
  if(action==='clear-audit-date'){
    const field=button.closest('[data-audit-date]');field.querySelectorAll('select').forEach(select=>select.value='');syncAuditDate(field);field.querySelector('select').focus();return;
  }
  const leaving=['home','admin','admin-users','admin-game-settings','admin-invitations','admin-audit','account','profiles','assessment','assessment-next','assess-game','assessment-train','open','inspect-user','review-profile','select-profile','logout','new-user','new-registration','create-mode','close-modal','games','refresh-panel','dashboard','report-links','edit-profile','unresolved-page'];
  if(leaving.includes(action)&&!await navigationGuard.allow(submitForm)){if(button.tagName==='A')event.preventDefault();return;}
  if(action==='toggle-password'){const input=button.closest('.input-shell')?.querySelector('input');if(input){const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?uiText('پنهان‌کردن رمز'):uiText('نمایش رمز'));button.innerHTML=icon(show?'eye-off':'eye');}return;}
  if(action==='listen-guide'){
    const key=button.dataset.guide==='current'?guidanceKey({...engine,targetCount:engine?.targets?.length||engine?.targetCount,phase:engine?.current?.phase}):button.dataset.guide;
    if(route==='play'&&!modal.open&&(playPhase==='countdown'||playPhase==='playing'&&(!engine?.paused||engine?.transitionClock&&!engine.transitionClock.paused))){pause();if(engine?.done)return;}
    progress.sound=true;writeProgress(progress);syncSoundControls();return guidance.play(key);
  }
  if(['new-training-profile','edit-training-profile','copy-training-profile','archive-training-profile','close-training-profile','reload-training-profiles'].includes(action)){
    if(!await navigationGuard.allow(submitForm))return;
    if(action==='close-training-profile'){document.querySelector('#training-profile-editor')?.replaceChildren();return;}
    if(action==='reload-training-profiles')return loadTrainingProfiles();
    if(action==='archive-training-profile')return archiveTrainingProfile(button);
    const id=action==='new-training-profile'?document.querySelector('#training-profile-template').value:button.dataset.id;
    return openTrainingProfile(id,action!=='edit-training-profile');
  }
  if(['lesson-memory-next','lesson-memory-help','lesson-memory-replay'].includes(action))return changeMemoryLesson(action);
  if(button.tagName==='A')event.preventDefault();
  if(action==='admin-menu')return toggleAdminMenu();
  if(action==='admin-users')return adminUsers();
  if(action==='admin-game-settings')return gameSettings();
  if(action==='admin-invitations')return adminInvitations();
  if(action==='admin-audit')return showAudit(false);
  if(action==='audit-page'){auditState.page=Number(button.dataset.page);return showAudit();}
  if(action==='report-page'){reportState.page=Number(button.dataset.page);return dashboard();}
  if(action==='selector-page'){clients.selectorPage=Number(button.dataset.page);return dashboard();}
  if(action==='import-target-page')return loadImportTargets(previewImport?.targetSearch||'',Number(button.dataset.page));
  if(action==='unresolved-page'){unresolvedPage=Number(button.dataset.page);return account();}
  if(action==='refresh-panel')return retryPanelRefresh();
  if(action==='new-report-link'){const form=document.querySelector('#report-link-form');form.hidden=false;delete form.dataset.acknowledged;form.reset?.();formTracker.saved(form,formTracker.capture(form));document.querySelector('#invitation-result').innerHTML='';return;}
  if(action==='reload-conflict'){if(await navigationGuard.allow(submitForm))return inspectUser(inspectedUserId);return;}
  if(action==='retry-details')return loadSessionDetails(button.closest('.outcome-details'));
  if(action==='dashboard-range'){dashboardDays=Number(button.dataset.days);return adminPanel();}
  if(action==='users-page'){adminState.page=Number(button.dataset.page);return adminUsers();}
  if(action==='new-user'||action==='new-registration'){createContext={};return openCreate(action==='new-registration'?'link':'direct');}
  if(action==='create-mode')return openCreate(button.dataset.mode);
  if(action==='import-create-user'){const source=previewImport?.profiles.find(p=>p.sourceId===button.dataset.source);if(source){const legacy=clients.profiles.find(p=>p.id===source.targetId&&!p.ownerUserId);createContext={profile:source.profile,source:source.sourceId,childId:legacy?.id||''};return openCreate('direct');}return;}
  if(action==='resolve-user'){const legacy=unresolvedProfiles.find(p=>p.id===button.dataset.id&&!p.ownerUserId);if(legacy){createContext={profile:legacy,childId:legacy.id};return openCreate('direct');}return;}
  if(action==='revoke-registration'){const view={version:viewVersion,userId:currentUser.id,role:currentUser.role};await viewRequest(view,`/registration-links/${button.dataset.id}`,{method:'DELETE'});if(currentView(view))return adminInvitations();return;}
  if(action==='user-tab'){activateUserTab(button.dataset.tab);return loadUserTab();}
  if(fromReactionPointer&&['respond','stimulus-response'].includes(action)){event.preventDefault();return;}
  if(starting&&!['sound','about'].includes(action))return;
  if(route==='play'&&['account','profiles','dashboard','home','assessment','open'].includes(action))engine?.clock.pause();
  if(pendingSave&&!['retry-save','reauth','sound','close-modal','about'].includes(action)){notify(uiText('ابتدا ثبت نتیجهٔ این جلسه را کامل کنید.'));return;}
  if(action==='admin')return adminPanel();
  if(action==='inspect-user')return inspectUser(button.dataset.user);
  if(action==='review-profile'){clients.activeId=button.dataset.id;inspectedUserId=button.dataset.user||null;return inspectedUserId?inspectUser(inspectedUserId):dashboard();}
  if(action==='report-links')return reportLinks();
  if(action==='revoke-report-link'){const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},childId=clients.activeId;await viewRequest(view,`/children/${childId}/report-links/${button.dataset.link}`,{method:'DELETE'});if(currentView(view))return reportLinks();return;}
  if(action==='account')return account();
  if(action==='logout'){await request('/auth/logout',{method:'POST'});return prepareLogin();}
  if(action==='retry-save')return persistPending();
  if(action==='reauth'){await request('/auth/session');return openModal(loginView({reauth:true}),'reauth');}
  if(action==='invite-login')return showLogin(null);
  if(action==='retry-connect')return initialize();
  if(action==='copy-invitation'){
    const card=button.closest('.invitation-card'),field=card?.querySelector('#invitation-url');if(!field)return;
    button.disabled=true;
    try{
      const copied=await copyTextField(field);if(!card.isConnected)return;
      button.textContent=copied?uiText('لینک کپی شد'):uiText('کپی لینک');
      card.querySelector('[data-copy-status]').textContent=copied?uiText('لینک با موفقیت کپی شد.'):uiText('لینک انتخاب شده، ولی کپی نشد. از گزینهٔ «کپی» مرورگر یا کلیدهای Ctrl+C استفاده کنید.');
    }finally{button.disabled=false;}
    return;
  }
  if(action==='reset-link'){const version=viewVersion,data=await request('/invitations',{method:'POST',body:{userId:button.dataset.user,purpose:button.dataset.purpose||'reset'}});if(version===viewVersion)return showInvitation(data);return;}
  if(action==='toggle-user'){const view={version:viewVersion,userId:currentUser.id,role:currentUser.role};await viewRequest(view,`/users/${button.dataset.user}`,{method:'PATCH',body:{active:button.dataset.active==='true',expectedRevision:Number(button.dataset.revision||inspectedRevision)}});if(!currentView(view))return;if(button.dataset.user===currentUser.id&&button.dataset.active==='false')return prepareLogin(uiText('حساب شما غیرفعال شد.'));return inspectUser(button.dataset.user);}
  if(action==='import-browser')return previewLegacy(()=>readClients());
  if(action==='commit-import')return commitLegacy();
  if(action==='adaptive-level'){await request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'adaptive',level:selectedLevel}});await refreshClients();return detail(selectedGame,false);}
  if(action==='home') return home();
  if(action==='profiles') return profiles();
  if(action==='assessment') return assessment();
  if(action==='assessment-next') return beginAssessment(nextAssessmentGame(clients));
  if(action==='assess-game') return beginAssessment(button.dataset.game);
  if(action==='assessment-train') return trainFromAssessment(button.dataset.game);
  if((action==='lesson-hide'||action==='lesson-show')&&route==='detail'&&lessonState?.steps[lessonState.index]?.memorize){lessonState.memoryHidden=action==='lesson-hide';document.querySelector('#lesson-box').innerHTML=lessonContent();document.querySelector('#lesson-box button')?.focus({preventScroll:true});return;}
  if(action==='lesson-choice')return answerLessonChoice(Number(button.dataset.index));
  if(action==='lesson-answer') return answerLesson(button.dataset.response==='true');
  if(action==='lesson-next') return nextLesson();
  if(action==='assessment-reports'){Object.assign(reportState,{kind:'baseline',game:'',level:'',variant:'standard',recordId:null});return dashboard();}
  if(action==='dashboard') {
    if(route==='result' && sessionRecordId) {
      const record=completedRecord?.id===sessionRecordId?completedRecord:profileRecords(clients).find(record=>record.id===sessionRecordId);
      if(record)Object.assign(reportState,{kind:record.kind,game:record.result.gameId,level:record.result.level,variant:variantOf(record.result),recordId:record.id,page:1});
    }
    return dashboard();
  }
  if(action==='select-profile') { if(!clients.profiles.some(p=>p.id===button.dataset.id))return; clients.activeId=button.dataset.id; await refreshClients(); return continueAfterProfile(); }
  if(action==='edit-profile') return profiles(button.dataset.id);
  if(action==='report-tab') { reportState.tab=button.dataset.tab; return dashboard(); }
  if(action==='select-record') { reportState.recordId=button.dataset.id; return dashboard(); }
  if(action==='print-report') return printReport();
  if(action==='export-profile') return exportProfile();
  if(action==='export-trials') return exportTrials();
  if(action==='recommended-level') { if(currentUser.role!=='admin')return;guideState=null;selectedLevel=button.dataset.level;await request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'fixed',level:selectedLevel}});return detail(selectedGame); }
  if(action==='baseline') return start(true,true);
  if(action==='games') { if(route!=='home') home(); requestAnimationFrame(()=>document.querySelector('#games')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})); return; }
  if(action==='about') return about();
  if(action==='close-modal'||action==='resume') return closeModal();
  if(action==='sound') {guidance.stop();progress.sound=!progress.sound;writeProgress(progress);syncSoundControls();tone(true);return;}
  if(action==='open') return detail(button.dataset.game);
  if(action==='detail') return detail(selectedGame);
  if(action==='filter') { filter=button.dataset.filter; document.querySelectorAll('.filter').forEach(node=>{ const selected=node.dataset.filter===filter; node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); document.querySelector('#game-grid').innerHTML=gameCards(); platformMotion.sync(app); return; }
  if(action==='level'&&LEVELS[button.dataset.level]) { if(guideState||currentUser.role!=='admin')return;selectedLevel=button.dataset.level;if(clients.activeId){await request(`/children/${clients.activeId}/difficulty`,{method:'PATCH',body:{...gameOptions(),mode:'fixed',level:selectedLevel}});}return detail(selectedGame,false); }
  if(action==='theme'&&THEMES[button.dataset.theme]) { selectedTheme=button.dataset.theme; document.querySelectorAll('[data-action="theme"]').forEach(node=>{ const selected=node.dataset.theme===selectedTheme;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected)); }); return detail(selectedGame,false); }
  if(action==='hunt-mode'&&['standard','divided'].includes(button.dataset.mode)) { selectedHuntMode=button.dataset.mode;document.querySelectorAll('.hunt-mode').forEach(node=>{const selected=node.dataset.mode===selectedHuntMode;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='traffic-mode') { selectedTrafficMode=button.dataset.mode==='signs'?'signs':'circles'; return detail(selectedGame,false); }
  if(action==='material' && ['shapes','letters','numbers','toys'].includes(button.dataset.material)) { selectedMaterial=button.dataset.material; return detail(selectedGame,false); }
  if(action==='search-mode'&&['single','dual'].includes(button.dataset.mode)){ selectedSearchMode=button.dataset.mode;return detail(selectedGame,false); }
  if(action==='search-layout'&&['grid','scattered'].includes(button.dataset.layout)) { selectedLayout=button.dataset.layout;document.querySelectorAll('.layout-button').forEach(node=>{const selected=node.dataset.layout===selectedLayout;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});return detail(selectedGame,false); }
  if(action==='practice') return start(true);
  if(action==='repeat-practice'&&route==='result'&&engine?.practice)return start(true,false,sessionOptions);
  if(action==='main-game'||action==='replay') return start(false);
  if(action==='pause') return pause();
  if(action==='restart') return start(engine?.practice ?? false,false,repeatingPractice?sessionOptions:null);
  if(route!=='play'||!engine||modal.open) return;
  if(action==='begin-game')return beginGame();
  if(playPhase!=='playing')return;
  if(action==='next-round'){engine.continueRound();arenaKey='';updatePlay();return;}
  if(action==='continue-review'){guidance.stop();engine.continueReview();arenaKey='';updatePlay();return;}
  if(action==='respond') answer(engine.respond());
  if(action==='stimulus-response') answer(engine.respondToStimulus(Number(button.dataset.trial),button.dataset.choice===undefined?null:Number(button.dataset.choice)),{choiceIndex:button.dataset.choice});
  if(action==='search-choice') answer(engine.choose(Number(button.dataset.index)),{searchIndex:Number(button.dataset.index)});
  if(action==='item') answer(engine.choose(Number(button.dataset.index)),{itemId:Number(button.dataset.index)});
  if(action==='reject-item') answer(engine.reject());
  if(action==='depart') { tone(engine.depart()); updatePlay(); }
  if(action==='acknowledge') { guidance.stop();engine.acknowledge(); arenaKey=''; updatePlay(); }
}
app.addEventListener('click',event=>{void handleAction(event).catch(showError);});
document.addEventListener('pointerdown',()=>{keyboardPlay=false;},{capture:true});
app.addEventListener('pointerdown',event=>{
  if(route!=='play'||playPhase!=='playing'||!engine||modal.open||event.isPrimary===false||event.button!==0)return;
  const button=event.target.closest('[data-action="stimulus-response"],[data-action="respond"]');
  if(button&&!button.disabled) {reactionPointerInput=true;event.preventDefault();answer(button.dataset.action==='respond'?engine.respond():engine.respondToStimulus(Number(button.dataset.trial),button.dataset.choice===undefined?null:Number(button.dataset.choice)),{choiceIndex:button.dataset.choice});}
});
modal.addEventListener('click',event=>{void handleAction(event).catch(showError);});
modal.addEventListener('submit',event=>{event.preventDefault();void submitForm(event.target).catch(showError);});
modal.addEventListener('cancel',event=>{event.preventDefault();void navigationGuard.allow(submitForm).then(allowed=>{if(allowed)closeModal();}).catch(showError);});
document.addEventListener('keydown', event=>{
  if(handleTabKey(event))return;
  if(event.target.matches?.('[data-theme-select]'))return;
  // Native Enter activation repeats on a held key, even after focus moves to
  // the next trial or its review. Require a fresh press for each activation.
  if(route==='play'&&event.key==='Enter'&&event.repeat&&event.target.closest?.('button[data-action]')){event.preventDefault();return;}
  if(route==='play'&&!modal.open){keyboardPlay=true;if(playPhase==='playing'&&moveFieldFocus(event.target,event.key)){event.preventDefault();return;}}
  if(event.key==='Escape'&&document.body.classList.contains('admin-menu-open')&&!document.querySelector('.navigation-confirm[open]')){event.preventDefault();return toggleAdminMenu(false);}
  if(event.key==='Tab'&&document.body.classList.contains('admin-menu-open')){const controls=[...document.querySelectorAll('.admin-sidebar a,.admin-sidebar button')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  if(event.key==='Escape'&&route==='play'&&!modal.open) { event.preventDefault(); pause(); }
  if(event.code==='Space'&&route==='play'&&!modal.open) {
    const control=event.target.closest?.('input,textarea,select,a,button');
    if(control&&!control.matches('[data-action="respond"],[data-action="stimulus-response"],[data-action="begin-game"],[data-action="continue-review"],[data-action="acknowledge"],[data-action="next-round"]'))return;
    if(playPhase==='playing'&&!engine.review&&!engine.roundBreak&&!engine.gate&&GAME_MAP[selectedGame].kind!=='reaction')return;
    event.preventDefault();if(event.repeat)return;
    if(playPhase==='ready')return beginGame();
    if(playPhase!=='playing')return;
    if(engine.roundBreak){engine.continueRound();arenaKey='';return updatePlay();}
    if(engine.review){guidance.stop();engine.continueReview();arenaKey='';return updatePlay();}
    if(engine.gate){if(engine.transitionClock)return;guidance.stop();engine.acknowledge();arenaKey='';return updatePlay();}
    if(control?.matches('[data-action="stimulus-response"]'))return answer(engine.respondToStimulus(Number(control.dataset.trial),control.dataset.choice===undefined?null:Number(control.dataset.choice)),{choiceIndex:control.dataset.choice});
    if(GAME_MAP[selectedGame].kind==='reaction')answer(engine.respond());
  }
});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden&&route==='play'&&engine&&(!engine.paused||engine.transitionClock||playPhase==='countdown')) { if(modal.open) { engine.pause();preparationClock?.pause(); } else pause(); } });
window.addEventListener('orientationchange',()=>{if(route==='play'&&engine&&(!engine.paused||engine.transitionClock||playPhase==='countdown')&&!modal.open)pause();});
function gameOptions(){
 const options={gameId:selectedGame,locale:getLocale(),experienceVersion:EXPERIENCE_VERSION,clientExperienceVersion:EXPERIENCE_VERSION,view:'panel',level:selectedLevel,theme:selectedTheme,material:selectedMaterial,layout:selectedLayout,trafficMode:selectedTrafficMode,targetCount:selectedGame==='search'?(selectedSearchMode==='dual'?2:1):(selectedHuntMode==='divided'?2:1)};
 const key=timingIdentity({...options,variant:currentVariant()}),cached=clients.gameTimings;
 if(cached?.childId===clients.activeId&&['gameId','variant','timingFamily'].every(field=>cached.identity[field]===key[field])){options.timing={...cached.levels.find(row=>row.level===selectedLevel).timing};if(cached.trainingProfile)options.trainingProfile={...cached.trainingProfile};}
 return options;
}
async function refreshClients(view=null){
 const viewerId=currentUser?.id,viewerRole=currentUser?.role;
 const valid=()=>currentUser?.id===viewerId&&currentUser?.role===viewerRole&&(!view||currentView(view));let data;
 try{data=await request(`/bootstrap?view=panel${clients.activeId?'&childId='+encodeURIComponent(clients.activeId):''}`);}catch(error){if(!valid())return false;throw error;}
 if(!valid())return false;
 if(data.user.id!==viewerId||data.user.role!==viewerRole)throw new ApiError(uiText('حساب این مرورگر تغییر کرده است؛ دوباره وارد شوید.'),401,'ACCOUNT_CHANGED');
 currentUser=data.user;Object.assign(clients,data,{locale:getLocale()});delete clients.reportPage;return true;
}
function showLogin(invite=null){
  route=invite?'invitation':'auth';engine=null;cancelAnimationFrame(frame);if(modal.open)modal.close();
  page(loginView({invite}), 'auth-main');
}
function clearPrivateData(){
 if(modal.open)modal.close();modal.replaceChildren();modalKind='';
 pendingLocale=null;localeChangeAttempt=null;
 navigationGuard.clear();completedRecord=null;delete clients.panelSummary;delete clients.reportPage;delete clients.selectorProfiles;delete clients.trainingProfiles;delete clients.gameTimings;unresolvedProfiles=[];
 members=[];inspectedUserId=null;publicReportData=null;previewImport=null;importAttempt=null;remoteRun=null;pendingAdminRefresh=null;pendingPanelRefresh=null;
 pendingStart=null;guideState=null;lessonState=null;editingProfile=null;sessionRecordId=null;sessionOptions=null;repeatingPractice=false;engine=null;launchAttempt=null;starting=false;userTab='overview';
 Object.assign(clients,{activeId:null,profiles:[],records:[],difficulties:[]});Object.assign(reportState,{tab:'admin',game:'',level:'',variant:'',kind:'training',recordId:null});
}
function connectionError(error){
 route='connection-error';engine=null;if(modal.open)modal.close();document.title=uiText('تلاش دوباره برای اتصال — حواس');
 page(lt`<section class="surface empty-state"><h1>ارتباط با مرکز برقرار نشد</h1><p>${esc(error.message||uiText('اطلاعات حساب دریافت نشد.'))}</p><p>وقتی اتصال برقرار شد، از همین‌جا ادامه بده. لازم نیست دوباره ثبت‌نام کنی یا رمز بسازی.</p><button class="button primary" data-action="retry-connect">تلاش دوباره</button></section>`,'auth-main');
}
async function openSignedInHome(auth){
 currentUser=auth.user;clearPrivateData();inviteToken=null;inviteInfo=null;registrationToken=null;
 if(currentUser.passwordChangeRequired)return forcedPassword();
 route='connecting';document.title=uiText('ورود به حواس');page(uiText('<section class="surface empty-state"><h1>در حال دریافت اطلاعات حساب…</h1></section>'),'auth-main');
 if(currentUser.role==='admin')return adminPanel();
 const view={version:viewVersion,userId:currentUser.id,role:currentUser.role};
 try{if(await refreshClients(view))return home();}catch(error){if(currentView(view))showError(error);}
}
async function prepareLogin(message=''){
 currentUser=null;clearPrivateData();inviteToken=null;inviteInfo=null;registrationToken=null;api.csrfToken=null;showLogin();
 const form=document.querySelector('#login-form');form.querySelector('#account-error').textContent=message;
 form.dataset.waiting='true';form.querySelectorAll('input,button').forEach(control=>control.disabled=true);
 try{await request('/auth/session');}finally{delete form.dataset.waiting;form.querySelectorAll('input,button').forEach(control=>control.disabled=false);}
}
function publicReportMessage(title,message,retry=false){
 publicReportData={};route='public-report-message';engine=null;if(modal.open)modal.close();document.title=uiText('گزارش خانواده — حواس');
 page(`<section class="surface empty-state"><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry?uiText('<button class="button primary" data-action="retry-connect">تلاش دوباره</button>'):''}</section>`,'auth-main');
}
async function changeLanguage(select){
 const desired=select.value;
 if(!['fa','en'].includes(desired))return;
 if(route==='play'&&engine&&!engine.done){
  pendingLocale=desired===getLocale()?null:desired;
  const message=pendingLocale?uiText('زبان انتخاب‌شده پس از پایان بازی اعمال می‌شود.'):engine.feedback;
  if(pendingLocale)select.setAttribute('aria-description',message);else select.removeAttribute('aria-description');
  setText('feedback',message);announcer.textContent=message;
  const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',desired);history.replaceState?.({},'',url);}return;
 }
 if(desired===getLocale())return;
 const previous=localeChangeAttempt?.previous||{locale:getLocale(),title:document.title,url:location.href};
 const url=new URL(location.href),attempt={view:beginView(),hash:location.hash,previous};localeChangeAttempt=attempt;
 const current=()=>localeChangeAttempt===attempt&&getLocale()===desired&&location.hash===attempt.hash&&currentUser?.id===attempt.view.userId&&currentUser?.role===attempt.view.role;
 // Retain the original controls so edits made while requests are pending survive rendering.
 const forms=[...document.querySelectorAll('form')],files=[...document.querySelectorAll('input[type=file]')];
 setLocale(desired);clients.locale=desired;guidance.stop();
 if(url.searchParams.has('lang')){url.searchParams.set('lang',desired);history.replaceState?.({},'',url);}
 try{
  if(currentUser&&clients.activeId&&!publicReportData&&!await refreshClients(attempt.view))return;
  if(!current()||!currentView(attempt.view))return;
  if(route==='public-report')await refreshPublicReport();else if(route==='result')finish({renderOnly:true});else await navigate();
  if(!current())return;
  for(const saved of forms){const form=document.getElementById(saved.id);if(!form)continue;for(const field of saved.querySelectorAll('[name]')){if(field.type==='file')continue;const input=[...form.querySelectorAll('[name]')].find(input=>input.name===field.name&&(field.type!=='radio'||input.value===field.value));if(input){if(field.name==='birthDate'&&input.closest('[data-birth-date]')){input.closest('[data-birth-date]').outerHTML=birthDateField(field.value);continue;}if(['from','to'].includes(field.name)&&input.closest('.audit-date-field')){input.closest('.audit-date-field').outerHTML=auditDateField(field.name,uiText(field.name==='from'?'از تاریخ':'تا تاریخ'),field.value);continue;}input.value=field.value;if(['checkbox','radio'].includes(input.type))input.checked=field.checked;}}}
  for(const input of files)if(input.files?.length)document.getElementById(input.id)?.replaceWith(input);
  navigationGuard.sync();
 }catch(error){
  if(!current())return;
  setLocale(previous.locale);clients.locale=previous.locale;document.title=previous.title;
  if(select.isConnected)select.value=previous.locale;
  history.replaceState?.({},'',previous.url);
  if(error.code==='NETWORK_ERROR')error.message=uiText('اتصال به مرکز برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.');
  throw error;
 }finally{if(localeChangeAttempt===attempt)localeChangeAttempt=null;}
}
async function navigate(){
 const id=location.hash.slice(1),shared=id.match(/^report\/([a-f0-9]{64})$/);
 if(id.startsWith('invite/'))return showAccountInvitation(id.slice(7));
 inviteToken=null;inviteInfo=null;
 if(id.startsWith('register/'))return showRegistration(id.slice(9));
 registrationToken=null;
 if(id.startsWith('report/')){
  publicReportMessage(uiText('در حال دریافت گزارش'),uiText('لطفاً کمی صبر کنید.'));
  if(!shared)throw Error(uiText('لینک گزارش معتبر نیست؛ لینک کامل را از فرستنده دریافت کنید.'));
  const view=beginView();Object.assign(reportState,{tab:'parents',game:'',level:'',variant:'',kind:'',recordId:null});const data=await viewRequest(view,'/public/report',{method:'POST',body:{token:shared[1],view:'panel',kind:''}});if(!currentView(view))return;publicReportData=data;return renderPublicReport();
 }
 publicReportData=null;
 if(!currentUser)return showLogin();if(currentUser.passwordChangeRequired)return forcedPassword();
 if(currentUser.role==='admin'){const member=id.match(/^admin\/users?\/([a-f0-9-]{36})$/);if(member)return inspectUser(member[1]);if(['profiles','admin/users'].includes(id))return adminUsers();if(id==='admin/invitations')return adminInvitations();if(id==='admin/game-settings')return gameSettings();if(['account','admin/settings'].includes(id))return account();if(id==='report-links')return reportLinks();if(id==='reports')return dashboard();if(id==='admin/audit')return showAudit(false);return adminPanel();}
 if(!clients.activeId){const view=beginView();if(!await refreshClients(view))return;}
 inspectedUserId=null;
 if(id==='assessment')return assessment();if(id==='reports')return dashboard();if(id==='account')return account();if(id==='report-links')return reportLinks();if(Object.hasOwn(GAME_MAP,id))return detail(id,false);return home();
}
async function initialize(){
 try {const auth=await request('/auth/session');if(currentUser?.id!==auth.user?.id||currentUser?.role!==auth.user?.role)clearPrivateData();currentUser=auth.user;
  if(/^#(?:register|invite)\//.test(location.hash))return await navigate();
  if(currentUser?.role==='user'&&!currentUser.passwordChangeRequired&&!location.hash.startsWith('#report/'))await refreshClients();
  return await navigate();
 }catch(error){if(location.hash.startsWith('#report/'))return publicReportMessage(uiText('گزارش در دسترس نیست'),error.message,true);connectionError(error);}
}
function notify(message){
  let node=document.querySelector('#account-status')||document.querySelector('#app-status');
  if(!node){document.querySelector('main')?.insertAdjacentHTML('afterbegin','<p class="status-message" id="app-status" role="status"></p>');node=document.querySelector('#app-status');}
  if(node){node.hidden=false;node.textContent=message;}
}
function showError(error){
  if(error.code==='STALE_RESPONSE')return;
  if(error.code==='EDIT_CONFLICT'){
    const form=document.querySelector('#edit-user-form')||document.querySelector('form#profile-form');
    let node=form&&!form.closest('[hidden]')?form.querySelector('#profile-error,#account-error'):null;
    if(node)node.textContent=error.message;else{notify(error.message);node=document.querySelector('#account-status')||document.querySelector('#app-status');}
    node?.insertAdjacentHTML('beforeend',uiText('<button type="button" class="button subtle" data-action="reload-conflict">دیدن آخرین اطلاعات</button>'));return;
  }
  if(location.hash.startsWith('#report/'))return publicReportMessage(uiText('گزارش در دسترس نیست'),error.message,true);
  if(error.code==='PASSWORD_CHANGE_REQUIRED'&&currentUser){currentUser.passwordChangeRequired=true;return forcedPassword();}
  if(error.status===401&&!pendingSave&&currentUser){void prepareLogin(error.message).catch(showError);return;}
  if(['connecting','connection-error'].includes(route))return connectionError(error);
  const candidates=[...(modal.open?modal.querySelectorAll('#account-error,#profile-error'):[]),...app.querySelectorAll('#account-error,#profile-error')];
  const node=candidates.find(field=>!field.closest('[hidden]'));
  if(node)node.textContent=error.message||uiText('درخواست انجام نشد. دوباره تلاش کنید.');else notify(error.message||uiText('درخواست انجام نشد. دوباره تلاش کنید.'));
}
function renderSaveStatus(){
 const note=document.querySelector('.local-note');if(!note)return;
 if(pendingSave?.error){
  const message=pendingSave.error.code==='NETWORK_ERROR'?uiText('اتصال به مرکز برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.'):uiText(pendingSave.error.message);
  note.innerHTML=lt`<span>${icon('info')} نتیجه هنوز ذخیره نشده: ${esc(message)} تا وقتی این صفحه باز است، نتیجه نگه داشته می‌شود.</span><button class="button subtle" data-action="retry-save">تلاش دوباره برای ثبت</button><button class="text-button" data-action="reauth">ورود با حسابی که بازی را انجام داده</button>`;
 }else if(pendingSave)note.innerHTML=lt`${icon('clock')} در حال ثبت نتیجه در سرور مرکز…`;
 else if(completedRecord)note.innerHTML=lt`${icon('check')} نتیجه ذخیره شد.`;
}
async function persistPending(){
  const pending=pendingSave;if(!pending||pending.saving)return;
  pending.saving=true;pending.error=null;renderSaveStatus();let data;
  try {
    data=await request(`/children/${pending.childId}/sessions/${pending.run.id}/complete`,{method:'POST',body:{result:pending.result,view:'panel'}});
  }catch(error){
    pending.saving=false;pending.error=error;if(pendingSave===pending)renderSaveStatus();
    return;
  }
  // The completion acknowledgement is authoritative even if the following refresh fails.
  sessionRecordId=data.record.id;completedRecord=data.record;pendingSave=null;if(data.panelSummary)clients.panelSummary=data.panelSummary;
  const index=clients.records.findIndex(record=>record.id===data.record.id);if(index<0)clients.records.push(data.record);else clients.records[index]=data.record;
  renderSaveStatus();const note=document.querySelector('.local-note');
  renderResultActions();
  if(data.record.kind==='training'){
    const content=lt`بهترین امتیاز این سطح: <b>${fa(data.bestScore??Math.max(...comparableRecords(profileRecords(clients),data.record).map(r=>r.result.score)))} از ${fa(data.record.result.maxScore)}</b>`,best=document.querySelector('.best-score');
    if(best)best.innerHTML=content;else document.querySelector('.result-main-score')?.insertAdjacentHTML('afterend',`<p class="best-score">${content}</p>`);
  }
  const view={version:viewVersion,userId:currentUser?.id,role:currentUser?.role};
  try{await refreshClients(view);}catch(error){
    if(!currentView(view))return;
    if(error.status===401||error.code==='PASSWORD_CHANGE_REQUIRED')return showError(error);
    if(note?.isConnected)note.insertAdjacentHTML('beforeend',uiText('<span>نتیجهٔ شما ثبت شده؛ تنظیمات تازه پس از برقراری ارتباط دریافت می‌شود.</span>'));
  }
}
async function account(){
 if(!currentUser)return showLogin();if(currentUser.passwordChangeRequired)return forcedPassword();const view=beginView();if(!await refreshClients(view))return;
 if(currentUser.role==='admin'){const data=await viewRequest(view,`/children?view=panel&owner=unassigned&page=${unresolvedPage}`);if(!currentView(view))return;unresolvedProfiles=data.profiles;unresolvedPage=data.pagination.page;unresolvedPages=data.pagination.pages;}
 guideState=null;engine=null;route='account';setHash(currentUser.role==='admin'?'#admin/settings':'#account');if(modal.open)modal.close();page(accountView(currentUser,unresolvedProfiles),'content-main account-main');if(unresolvedPages>1)document.querySelector('.import-section')?.insertAdjacentHTML('beforeend',lt`<div class="pagination"><button class="button subtle" data-action="unresolved-page" data-page="${unresolvedPage-1}" ${unresolvedPage<=1?'disabled':''}>قبلی</button><button class="button subtle" data-action="unresolved-page" data-page="${unresolvedPage+1}" ${unresolvedPage>=unresolvedPages?'disabled':''}>بعدی</button></div>`);
 if(currentUser.role==='admin')await loadTrainingProfiles();
}
async function gameSettings(){
 if(currentUser?.role!=='admin')return home();if(currentUser.passwordChangeRequired)return forcedPassword();
 beginView();inspectedUserId=null;guideState=null;engine=null;route='game-settings';setHash('#admin/game-settings');if(modal.open)modal.close();document.title=uiText('تنظیمات بازی‌ها — حواس');
 page(gameSettingsView(),'content-main admin-main');await loadTrainingProfiles();
}
async function adminUsers(){
 if(currentUser?.role!=='admin')return home();const view=beginView(),query=new URLSearchParams({...adminState,pageSize:20});const data=await viewRequest(view,`/users?${query}`);if(!currentView(view))return;
 members=data.users;adminState.page=data.pagination.page;inspectedUserId=null;engine=null;route='admin-users';if(modal.open)modal.close();setHash('#admin/users');document.title=uiText('کاربران — حواس');page(adminUsersView(data.users,adminState,data.pagination),'content-main admin-main');
}
async function refreshCreatedUsers(){
 if(currentUser?.role!=='admin')return;const view=beginView();
 try{
  const query=new URLSearchParams({...adminState,pageSize:20}),data=await viewRequest(view,`/users?${query}`);if(!currentView(view))return;
  pendingPanelRefresh=null;members=data.users;adminState.page=data.pagination.page;inspectedUserId=null;engine=null;route='admin-users';setHash('#admin/users');document.title=uiText('کاربران — حواس');page(adminUsersView(data.users,adminState,data.pagination),'content-main admin-main');notify(uiText('کاربر با موفقیت ساخته شد.'));
 }catch(error){if(currentView(view))refreshFailure(error,refreshCreatedUsers);}
}
async function adminInvitations(){
 if(currentUser?.role!=='admin')return home();const view=beginView(),data=await viewRequest(view,'/registration-links');if(!currentView(view))return;
 inspectedUserId=null;engine=null;route='invitations';if(modal.open)modal.close();setHash('#admin/invitations');document.title=uiText('دعوت‌ها — حواس');page(invitationsView(data.links),'content-main admin-main');
}
function scheduleAdminRefresh(view){
 if(!currentView(view)||!['admin','admin-users','invitations'].includes(route))return;
 pendingAdminRefresh={view,route};if(!modal.open)refreshAdminAfterDialog();
}
function refreshAdminAfterDialog(){
 const pending=pendingAdminRefresh;pendingAdminRefresh=null;
 if(!pending||!currentView(pending.view)||route!==pending.route||currentUser?.role!=='admin')return;
 const refresh=route==='invitations'?adminInvitations():route==='admin-users'?adminUsers():adminPanel();void refresh.catch(refreshFailure);
}
function openCreate(mode='direct'){
 if(currentUser?.role!=='admin')return;openModal(createUserView({...createContext,mode}),'create-user');syncCreateControls();
}
function toggleAdminMenu(force){
 const open=force??!document.body.classList.contains('admin-menu-open');document.body.classList.toggle('admin-menu-open',open);document.querySelector('.menu-toggle')?.setAttribute('aria-expanded',String(open));const shade=document.querySelector('.sidebar-shade');if(shade)shade.hidden=!open;
 syncSidebarAccess();if(open)document.querySelector('.admin-sidebar .sidebar-link')?.focus();else document.querySelector('.menu-toggle')?.focus();
}
function syncSidebarAccess(){const sidebar=document.querySelector('.admin-sidebar');if(sidebar){const small=matchMedia('(max-width:1023px)').matches;if(!small){document.body.classList.remove('admin-menu-open');document.querySelector('.sidebar-shade')?.setAttribute('hidden','');document.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');}const hidden=small&&!document.body.classList.contains('admin-menu-open');sidebar.inert=hidden;sidebar.setAttribute('aria-hidden',String(hidden));}}
window.addEventListener('resize',syncSidebarAccess);
async function showAccountInvitation(raw){
 inviteToken=raw;inviteInfo=null;registrationToken=null;publicReportData=null;route='invitation';engine=null;if(modal.open)modal.close();document.title=uiText('پذیرش دعوت — حواس');page(uiText('<section class="surface empty-state"><h1>در حال بررسی لینک…</h1></section>'),'auth-main');const view=beginView();
 try{if(!/^[a-f0-9]{64}$/.test(raw))throw Error(uiText('لینک دعوت یا بازیابی کامل نیست.'));const data=await viewRequest(view,'/invitations/inspect',{method:'POST',body:{token:raw}});if(!currentView(view))return;inviteInfo=data;showLogin(data);}
 catch(error){if(currentView(view))page(lt`<section class="surface empty-state"><h1>دعوت در دسترس نیست</h1><p>${esc(error.message)}</p><p>از مدیر مرکز بخواهید لینک کامل یا یک لینک تازه برایتان بفرستد.</p></section>`,'auth-main');}
}
async function showRegistration(raw){
 registrationToken=raw;publicReportData=null;route='registration';engine=null;if(modal.open)modal.close();document.title=uiText('ثبت‌نام در حواس');page(uiText('<section class="surface dashboard-empty"><h1>در حال بررسی دعوت…</h1></section>'),'auth-main');const view=beginView();
 try{if(!/^[a-f0-9]{64}$/.test(raw))throw Error(uiText('لینک ثبت‌نام معتبر نیست.'));await viewRequest(view,'/public/registration/inspect',{method:'POST',body:{token:raw}});if(currentView(view))page(registrationView(),'auth-main registration-main');}
 catch(error){if(currentView(view))page(lt`<section class="surface dashboard-empty"><h1>ثبت‌نام در دسترس نیست</h1><p>${esc(error.message)}</p><p>از مدیر مرکز یک لینک تازه بگیرید.</p></section>`,'auth-main');}
}
function showInvitation(data){
 const target=modal.open?modal.querySelector('#invitation-result'):document.querySelector('#invitation-result');if(!target)return;
 target.innerHTML=lt`<section class="surface invitation-card"><h2>لینک آماده است</h2><label>${data.expiresAt?uiText('لینک یک‌بارمصرف'):uiText('لینک گزارش (فعال تا زمان لغو)')}<input id="invitation-url" readonly dir="ltr" value="${esc(data.url)}"></label><button type="button" class="button subtle" data-action="copy-invitation">کپی لینک</button><p data-copy-status role="status" aria-live="polite" aria-atomic="true"></p><p>${data.expiresAt?uiText('اعتبار تا ')+new Intl.DateTimeFormat(numberLocale(),{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.expiresAt)):uiText('این لینک فقط همین بار نمایش داده می‌شود. آن را کپی کنید و نگه دارید.')}</p></section>`;
}
function forcedPassword(){route='password';engine=null;setHash('#change-password');page(lt`<div class="page-title"><h1>خوش آمدید، ${esc(currentUser.name)}</h1><p>نام کاربری: <b dir="ltr">${esc(currentUser.username)}</b></p></div>${passwordView(currentUser,true)}`,'content-main auth-main');}
async function adminPanel(){
 if(currentUser?.role!=='admin')return home();const view=beginView(),data=await viewRequest(view,`/admin/dashboard?days=${dashboardDays}`);if(!currentView(view))return;
 inspectedUserId=null;reportState.tab='admin';engine=null;route='admin';if(modal.open)modal.close();setHash('#admin');document.title=uiText('نمای کلی مرکز — حواس');page(adminOverview(data,currentUser),'content-main admin-main');
}
async function inspectUser(id){
 if(currentUser?.role!=='admin')return home();const view=beginView(),data=await viewRequest(view,`/users/${id}`);if(!currentView(view))return;
 if(inspectedUserId!==id){userTab='overview';reportState.recordId=null;reportState.variant='';reportState.page=1;clients.selectorSearch='';clients.selectorPage=1;}
 inspectedUserId=id;inspectedRevision=data.user.revision||1;clients.activeId=data.profile?.id||null;
 if(data.profile){if(!await refreshClients(view))return;}else{delete clients.panelSummary;delete clients.reportPage;clients.profiles=[];clients.records=[];clients.difficulties=[];}
 const evaluation=clients.panelSummary?{steps:clients.panelSummary.assessmentSteps}:data.profile?await viewRequest(view,`/children/${data.profile.id}/assessment`):null;if(!currentView(view))return;
 const catalog=await viewRequest(view,'/admin/training-profiles');if(!currentView(view))return;clients.trainingProfiles=catalog.profiles;
 route='admin-user';engine=null;editingProfile=data.profile?.id||null;if(modal.open)modal.close();setHash(`#admin/user/${id}`);document.title=lt`بررسی ${data.user.name} — حواس`;
 page(userDetailsView(data.user,data.profile,evaluation,userTab,''),'content-main admin-main');syncPolicyControls();navigationGuard.sync();
 return loadUserTab();
}

async function reportLinks(){
 if(!currentUser)return showLogin();const view=beginView();if(!await refreshClients(view))return;const profile=activeProfile(clients);if(!profile)return home();const data=await viewRequest(view,`/children/${profile.id}/report-links`);if(!currentView(view))return;
 route='report-links';engine=null;if(modal.open)modal.close();setHash('#report-links');page(reportLinksView(data.links,profile),'content-main account-main');
}
function renderPublicReport(){
 route='public-report';engine=null;const id='shared-report',adapt=r=>r?{id:r.ref,profileId:id,kind:r.kind,result:r.result}:null;
 const data={activeId:id,profiles:[{id,firstName:publicReportData.displayName,lastName:''}],records:publicReportData.pagination?[]:publicReportData.sessions.map(r=>({id:String(r.number),profileId:id,kind:r.kind,result:r.result}))};
 if(publicReportData.pagination)data.reportPage={...publicReportData,records:publicReportData.records.map(adapt),selected:adapt(publicReportData.selected),trend:publicReportData.trend.map(adapt)};
 page(reportsView(data,reportState,{role:'public'}),'content-main reports-main public-report');document.title=uiText('گزارش خانواده — حواس');
}

function syncCreateControls(){
 const form=document.querySelector('#create-user-form');if(!form)return;const user=form.elements.role.value==='user',direct=form.elements.method.value==='direct',existing=Boolean(form.elements.childId.value);
 form.elements.childId.disabled=!user;if(user)form.elements.method.value='direct';
 const nameLabel=document.querySelector('#admin-name-label');nameLabel.hidden=user;form.elements.name.disabled=user;form.elements.name.required=!user;document.querySelector('#admin-method-label').hidden=user;
 const fields=document.querySelector('#new-profile-fields');fields.hidden=!user||existing;fields.disabled=!user||existing;
 const needsPassword=user||direct,label=document.querySelector('#temporary-password-label');label.hidden=!needsPassword;form.elements.password.disabled=!needsPassword;form.elements.password.required=needsPassword;
}
const policyVariants=TIMING_VARIANTS;
function policyOptions(gameId,variant){return {gameId,targetCount:variant.includes('dual')||variant==='divided'?2:1,material:variant.includes('letters')?'letters':['numbers','toys'].includes(variant)?variant:'shapes',layout:variant.includes('scattered')?'scattered':'grid',trafficMode:variant==='signs'?'signs':'circles'};}
function syncPolicyControls(reset=true){
 const form=document.querySelector('#admin-difficulty-form');if(!form)return;const game=form.elements.gameId.value;
 if(reset)form.elements.variant.innerHTML=(policyVariants[game]||['standard']).map(v=>`<option value="${v}">${variantLabel(v)}</option>`).join('');
 const setting=clients.difficulties.find(d=>d.gameId===game&&d.variant===form.elements.variant.value&&d.protocolVersion===GAME_PROTOCOLS[game]);
 form.elements.level.innerHTML=profileAssignmentOptions(clients.trainingProfiles||[],setting?.trainingProfile);
 form.elements.mode.value=setting?.mode||'adaptive';form.elements.level.value=setting?.trainingProfileId?`profile:${setting.trainingProfileId}`:setting?.level||'easy';form.dataset.revision=String(setting?.revision||0);
 form.policySelection={gameId:game,variant:form.elements.variant.value};form.policyValues={level:form.elements.level.value,mode:form.elements.mode.value};
 syncProfileChoice();void loadProfileAssignmentSummary().catch(showError);
}
function syncProfileChoice(preview=false){
 const form=document.querySelector('#admin-difficulty-form');if(!form)return;const custom=form.elements.level.value.startsWith('profile:');
 form.elements.mode.disabled=custom;if(custom)form.elements.mode.value='fixed';
 if(preview)void previewProfileChoice(form).catch(showError);
 const summary=document.querySelector('#policy-profile-summary');if(!custom&&preview)summary.textContent=lt`سطح پیش‌فرض ${LEVELS[form.elements.level.value].label}؛ با زمان‌بندی عمومی همین سطح اجرا می‌شود.`;if(custom){const profile=(clients.trainingProfiles||[]).find(profile=>profile.id===form.elements.level.value.slice(8));summary.textContent=lt`پروفایل ${profile?.name||uiText('انتخاب‌شده')} با سطح ثابت اجرا می‌شود. اگر پروفایل را در تنظیمات بازی‌ها تغییر دهید، از جلسهٔ بعد اعمال می‌شود.`;}
}
async function changePolicySelection(select){
 const form=select.form,previous=form.policySelection;if(!previous)return syncPolicyControls(select.id==='policy-game');
 const desired=select.value,gameChanged=select.id==='policy-game';select.value=gameChanged?previous.gameId:previous.variant;
 const changed=form.policyValues&&(form.elements.level.value!==form.policyValues.level||form.elements.mode.value!==form.policyValues.mode);
 if(changed&&!await navigationGuard.allow(submitForm)||!form.isConnected)return;
 select.value=desired;syncPolicyControls(gameChanged);
}
async function previewProfileChoice(form){
 const value=form.elements.level.value;if(!value.startsWith('profile:'))return;
 const id=value.slice(8),key={gameId:form.elements.gameId.value,variant:form.elements.variant.value},viewer=currentUser.id,attempt={};form.previewAttempt=attempt;
 const data=await request(`/admin/training-profiles/${encodeURIComponent(id)}`);
 if(currentUser?.id!==viewer||!form.isConnected||form.previewAttempt!==attempt||form.elements.level.value!==value||form.elements.gameId.value!==key.gameId||form.elements.variant.value!==key.variant)return;
 const entry=profileEntry(data.profile.settings,key.gameId,key.variant);
 document.querySelector('#policy-profile-summary').innerHTML=lt`پروفایل «${esc(data.profile.name)}» · سطح پایهٔ ${LEVELS[entry.level].label} · ثابت<br>`+profileFamilies(key.gameId).map(family=>`${family==='moving'?uiText('متحرک: '):family==='static'?uiText('ثابت: '):''}${timingFields(key.gameId).map(field=>lt`${field==='visibleMs'?uiText('نمایش'):field==='intervalMs'?uiText('هر نوبت'):field==='previewMs'?uiText('حفظ نمونه'):field==='searchMs'?uiText('جست‌وجو'):uiText('مهلت مأموریت')}: ${(entry.timings[family][field]/1000).toLocaleString(numberLocale())} ثانیه`).join(' · ')}`).join('<br>');
}
async function loadProfileAssignmentSummary(){
 const form=document.querySelector('#admin-difficulty-form');if(!form||currentUser?.role!=='admin')return;
 const attempt={};form.summaryAttempt=attempt;
 const key={gameId:form.elements.gameId.value,variant:form.elements.variant.value},childId=clients.activeId,viewer=currentUser.id;
 const data=await request(`${timingPath(childId)}?${new URLSearchParams(key)}`);
 if(!form.isConnected||form.summaryAttempt!==attempt||currentUser?.id!==viewer||clients.activeId!==childId)return;
 const setting=clients.difficulties.find(setting=>setting.gameId===key.gameId&&setting.variant===key.variant&&setting.protocolVersion===GAME_PROTOCOLS[key.gameId]);
 if(form.elements.level.value===(setting?.trainingProfileId?`profile:${setting.trainingProfileId}`:setting?.level||'easy'))document.querySelector('#policy-profile-summary').innerHTML=profileAssignmentSummary(setting,data);
}
async function loadTrainingProfiles(){
 const holder=document.querySelector('#training-profiles');if(!holder||currentUser?.role!=='admin')return;
 const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},attempt={};holder.listAttempt=attempt;
 try{const data=await viewRequest(view,'/admin/training-profiles');if(!currentView(view)||!holder.isConnected||holder.listAttempt!==attempt||!data)return;clients.trainingProfiles=data.profiles;holder.querySelector('#training-profile-list').innerHTML=trainingProfilesList(data.profiles);holder.querySelector('#training-profile-list-error').textContent='';}
 catch(error){if(holder.isConnected&&currentView(view))holder.querySelector('#training-profile-list-error').textContent=error.message;throw error;}
}
async function openTrainingProfile(id,creating=false){
 const holder=document.querySelector('#training-profiles');if(!holder)return;const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},attempt={};holder.editorAttempt=attempt;
 const data=await viewRequest(view,`/admin/training-profiles/${encodeURIComponent(id)}`);if(!currentView(view)||!holder.isConnected||holder.editorAttempt!==attempt||!data)return;
 holder.querySelector('#training-profile-editor').innerHTML=trainingProfileEditor(data.profile,{creating});navigationGuard.sync();holder.querySelector('#training-profile-editor').scrollIntoView({block:'start',behavior:'instant'});
}
async function saveTrainingProfile(form,values){
 const holder=form.closest('#training-profiles'),viewer=currentUser.id,view={version:viewVersion,userId:currentUser.id,role:currentUser.role};
 try{
  const settings=validateProfileSettings([...form.querySelectorAll('[data-profile-entry]')].map(node=>{
   const key=node.dataset.profileEntry;return {gameId:node.dataset.game,variant:node.dataset.variant,protocolVersion:Number(node.dataset.protocol),level:values[`${key}:level`],timings:Object.fromEntries(profileFamilies(node.dataset.game).map(family=>[family,Object.fromEntries(timingFields(node.dataset.game).map(field=>[field,Math.round(Number(values[`${key}:${family}:${field}`])*1000)]))]))};
  }));
  const id=form.dataset.profile,data=await request(`/admin/training-profiles${id?'/'+encodeURIComponent(id):''}`,{method:id?'PATCH':'POST',body:{name:values.name,description:values.description,settings,...(id?{expectedRevision:Number(form.dataset.revision)}:{})}});
  form.dataset.profile=data.profile.id;form.dataset.revision=String(data.profile.revision);acknowledgeForm(form);
  if(currentUser?.id!==viewer||!form.isConnected||!holder.isConnected)return;
  const {settings:ignored,...metadata}=data.profile;clients.trainingProfiles=(clients.trainingProfiles||[]).filter(profile=>profile.id!==metadata.id);clients.trainingProfiles.push(metadata);
  holder.querySelector('#training-profile-list').innerHTML=trainingProfilesList(clients.trainingProfiles);form.outerHTML=trainingProfileEditor(data.profile);navigationGuard.sync();if(currentView(view))notify(uiText('پروفایل تمرین ذخیره شد.'));
 }catch(error){if(form.isConnected&&currentUser?.id===viewer)form.querySelector('#training-profile-error').textContent=error.message;throw error;}
}
async function archiveTrainingProfile(button){
 const holder=button.closest('#training-profiles'),view={version:viewVersion,userId:currentUser.id,role:currentUser.role};
 const data=await viewRequest(view,`/admin/training-profiles/${encodeURIComponent(button.dataset.id)}`,{method:'PATCH',body:{archived:button.dataset.archived==='true',expectedRevision:Number(button.dataset.revision)}});
 if(!currentView(view)||!holder.isConnected||!data)return;
 const editor=holder.querySelector('#training-profile-form');if(editor?.dataset.profile===data.profile.id)editor.outerHTML=trainingProfileEditor(data.profile);
 await loadTrainingProfiles();navigationGuard.sync();notify(data.profile.archived?uiText('پروفایل بایگانی شد. کاربرانی که از قبل این پروفایل را دارند، همچنان از آن استفاده می‌کنند.'):uiText('پروفایل دوباره قابل انتخاب است.'));
}

async function previewLegacy(readDocument){
  const container=document.querySelector('#import-preview');if(currentUser?.role!=='admin'||!container)return;
  const attempt={},view={version:viewVersion,userId:currentUser.id,role:currentUser.role};importAttempt=attempt;previewImport=null;
  const valid=()=>importAttempt===attempt&&currentView(view)&&container.isConnected;
  container.innerHTML=uiText('<p class="status-message" role="status">در حال بررسی فایل…</p>');
  try{
    const documentData=await readDocument();if(!valid())return;
    const preview=await request('/imports/preview',{method:'POST',body:{document:documentData}});if(!valid())return;
    previewImport=preview;if(preview.id)await loadImportTargets('',1,view);else container.innerHTML=importPreviewView(preview,clients.profiles,members,currentUser);
  }catch(error){
    if(!valid())return;
    if(error.status===401||error.code==='PASSWORD_CHANGE_REQUIRED')return showError(error);
    container.innerHTML=`<div class="form-error" role="alert">${esc(error instanceof SyntaxError?uiText('فایل JSON درست خوانده نشد. قالب فایل را بررسی کنید.'):error.message||uiText('فایل خوانده نشد. دوباره تلاش کنید.'))}</div>`;
  }finally{if(importAttempt===attempt)importAttempt=null;}
}
async function loadImportTargets(search='',pageNumber=1,existingView=null){
 const preview=previewImport;if(!preview?.id)return;const view=existingView||{version:viewVersion,userId:currentUser.id,role:currentUser.role};
 const attempt={};preview.targetAttempt=attempt;const valid=()=>currentView(view)&&preview===previewImport&&preview.targetAttempt===attempt;
 const read=async path=>{try{return await viewRequest(view,path);}catch(error){if(valid())throw error;return null;}};
 for(const row of document.querySelectorAll('.import-mapping')){const profile=preview.profiles.find(p=>p.sourceId===row.dataset.source);if(profile)profile.targetId=row.querySelector('[name=targetId]').value||null;}
 const data=await read(`/users?role=user&page=${pageNumber}&pageSize=20&search=${encodeURIComponent(search)}`);if(!valid()||!data)return;
 const choices=data.users.filter(u=>u.childId).map(u=>({id:u.childId,ownerUserId:u.id,firstName:u.name,lastName:''}));
 for(const profile of preview.profiles.filter(p=>p.targetId&&!choices.some(c=>c.id===p.targetId))){const known=clients.profiles.find(p=>p.id===profile.targetId);if(known)choices.push(known);else{const found=await read(`/children/${profile.targetId}`);if(!valid())return;if(found?.profile)choices.push(found.profile);}}
 clients.profiles=[...clients.profiles.filter(p=>p.id===clients.activeId),...choices.filter(p=>p.id!==clients.activeId)];preview.targetSearch=search;
 const filter=lt`<form id="import-target-filter" class="admin-filters"><label>جست‌وجوی کاربر برای انتقال سوابق<input name="search" value="${esc(search)}"></label><button class="button subtle">جست‌وجو</button><button type="button" class="button subtle" data-action="import-target-page" data-page="${data.pagination.page-1}" ${data.pagination.page<=1?'disabled':''}>قبلی</button><button type="button" class="button subtle" data-action="import-target-page" data-page="${data.pagination.page+1}" ${data.pagination.page>=data.pagination.pages?'disabled':''}>بعدی</button></form>`;
 const container=document.querySelector('#import-preview');if(container)container.innerHTML=filter+importPreviewView(preview,clients.profiles);
}

async function commitLegacy(){
  if(!previewImport?.id)return;
  const view={version:viewVersion,userId:currentUser.id,role:currentUser.role},preview=previewImport;
  const mapping=[...document.querySelectorAll('.import-mapping')].map(row=>({sourceId:row.dataset.source,targetId:row.querySelector('[name="targetId"]').value||null,ownerUserId:null}));
  if(mapping.some(m=>!m.targetId)){notify(uiText('کاربری را برای انتقال سوابق انتخاب کنید یا با این مشخصات یک حساب تازه بسازید.'));return;}
  const data=await viewRequest(view,'/imports/commit',{method:'POST',body:{previewId:preview.id,mapping,requireUser:true}});if(!currentView(view)||preview!==previewImport)return;previewImport=null;document.querySelector('#import-preview').innerHTML=lt`<p class="status-message">${fa(data.importedRecords)} نتیجه منتقل شد.</p>`;try{if(!await refreshClients(view))return;await account();if(route==='account')notify(lt`${fa(data.importedRecords)} نتیجه منتقل شد.`);}catch(error){refreshFailure(error);}
}
window.addEventListener('beforeunload',event=>{if(pendingSave||navigationGuard.hasChanges()){event.preventDefault();event.returnValue='';}});
const pwa=setupPwa({formTracker,canUpdate:()=>route!=='play'&&!pendingSave&&!starting&&!navigationGuard.hasChanges()});
await initialize();
