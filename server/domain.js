import {t as uiText} from '../src/i18n.js';
import {createStimulusPlan} from '../src/stimulus-plan.js';
import {trafficJourney} from '../src/games/traffic.js';
import { GAME_MAP, GAME_PROTOCOLS, PROTOCOL, EXPERIENCE_VERSION } from '../src/config.js';
import { FACTORIES } from '../src/games/index.js';
import { generateSearch } from '../src/games/search.js';
import { seededRandom } from '../src/core/random.js';
import { Session } from '../src/core/session.js';
import { requireValue as check } from './security.js';

export function normalizeSettings(input={}, {experienceVersion=EXPERIENCE_VERSION}={}) {
  check(input&&typeof input.gameId==='string'&&Object.hasOwn(GAME_MAP,input.gameId),uiText('بازی معتبر نیست.'));
  const options={gameId:input.gameId,level:'easy',theme:['star','shape','fish','butterfly','bird'].includes(input.theme)?input.theme:'star',material:['shapes','letters','numbers','toys'].includes(input.material)?input.material:'shapes',layout:input.layout==='scattered'?'scattered':'grid',trafficMode:input.trafficMode==='signs'?'signs':'circles',targetCount:input.targetCount===2?2:1};
  check(input.locale===undefined||['fa','en'].includes(input.locale),uiText('زبان معتبر نیست.'),400,'INVALID_LOCALE');
  options.locale=input.locale||'fa';options.experienceVersion=experienceVersion;options.stimulusVersion=experienceVersion>=4?9:8;
  if(options.gameId==='search')options.pacedRounds=experienceVersion===1;
  const sample=FACTORIES[options.gameId]({...options,practice:true,now:()=>0,random:seededRandom(0)});
  return {...options,variant:sample.variant,protocolVersion:GAME_PROTOCOLS[options.gameId],stimulusVersion:sample.stimulusVersion||1};
}
const same=(a,b)=>a&&b&&['shape','color','detail','word'].every(k=>(a[k]??(k==='detail'?0:undefined))===(b[k]??(k==='detail'?0:undefined)));
export function canonicalResult(run,payload) {
  const settings={...run.settings,experienceVersion:run.settings.experienceVersion??1}, game=GAME_MAP[settings.gameId],practice=run.kind==='baseline';
  check(payload&&Array.isArray(payload.outcomes)&&payload.outcomes.length<=1000,uiText('پاسخ‌های جلسه معتبر نیستند.'));
  check(Number.isFinite(payload.durationMs)&&payload.durationMs>=0&&payload.durationMs<=86400000,uiText('زمان جلسه معتبر نیست.'));
  const engine=FACTORIES[game.id]({...settings,practice,now:()=>0,random:seededRandom(settings.seed)});
  const records=[],chosen=new Map(),found=new Map();let previous=0,searchRound=1,roundStartedAt=0,wrongItems=0;
  // Engine timestamps are rounded to milliseconds; allow only rounding error.
  const tolerance=2;
  const boards=game.kind==='search'?Array(engine.total):null;
  if(boards){const random=seededRandom(settings.seed);for(let i=0;i<engine.total;i++)boards[i]=generateSearch(settings.level,random,settings.layout,settings.material,settings.targetCount,settings.stimulusVersion,engine.stimulusPlan?.colorsByPhase[i]?.[0]);}
  const trials=game.kind==='reaction'?engine.trials.filter(t=>t.scored!==false):null;
  if(trials){check(payload.outcomes.length===trials.length,uiText('تعداد پاسخ‌ها با پروتکل جلسه یکسان نیست.'));check(payload.durationMs+tolerance>=engine.trials.length*engine.intervalMs,uiText('زمان جلسه از زمان پروتکل کوتاه‌تر است.'));}
  const clearEvents=Array.isArray(payload.events)?payload.events:[];const cleared=new Map();let departedAt=null;
  if(game.kind==='adventure'){
    let lastEventAt=0;
    for(const event of clearEvents){
      check(event&&['clear','depart'].includes(event.kind)&&Number.isFinite(event.atMs)&&event.atMs>=0&&event.atMs<=payload.durationMs,uiText('رویداد مأموریت معتبر نیست.'));
      check(event.atMs>=lastEventAt&&departedAt===null,uiText('ترتیب رویدادهای مأموریت معتبر نیست.'));lastEventAt=event.atMs;
      if(event.kind==='depart'){check(!practice&&departedAt===null,uiText('خروج تکراری است.'));departedAt=event.atMs;}
      else {const item=engine.items.find(i=>i.id===event.itemId);check(item?.blocked&&!cleared.has(item.id),uiText('رویداد مانع معتبر نیست.'));cleared.set(item.id,event.atMs);}
    }
  }
  for(const [i,o] of payload.outcomes.entries()){
    check(o&&typeof o.response==='boolean'&&Number.isFinite(o.atMs)&&o.atMs>=previous&&o.atMs<=payload.durationMs,uiText('ترتیب یا زمان پاسخ معتبر نیست.'));previous=o.atMs;
    let target,stimulus,selectedTarget,selectedStimulus,context={};
    if(trials){
      const earliest=i?payload.outcomes[i-1].atMs+engine.intervalMs:(engine.trials.length-trials.length+1)*engine.intervalMs;
      check(o.atMs+tolerance>=earliest,uiText('فاصلهٔ پاسخ‌ها با نوبت‌های بازی یکسان نیست.'));
      const trial=trials[i];target=trial.target;stimulus=trial.stimulus;context.phase=trial.phase;
      if(o.response){
        if(game.id==='hunt') {const choice=trial.choices.find(c=>same(c.stimulus,o.selectedStimulus));check(choice,uiText('محرک انتخاب‌شده در این نوبت وجود ندارد.'));selectedTarget=choice.target;selectedStimulus=choice.stimulus;}
        else {selectedTarget=target;selectedStimulus=stimulus;}
      }
    } else if(boards){
      check(Number.isInteger(o.round)&&o.round>=1&&o.round<=boards.length&&(i===0||o.round>=payload.outcomes[i-1].round),uiText('دور جست‌وجو معتبر نیست.'));
      if(o.round!==searchRound){check(o.round===searchRound+1&&found.get(searchRound)===settings.targetCount,uiText('دور قبلی جست‌وجو کامل نشده است.'));searchRound=o.round;roundStartedAt=records.at(-1).atMs;}
      check((found.get(searchRound)||0)<settings.targetCount,uiText('دور جست‌وجو قبلاً پایان یافته است.'));
      const revealAt=roundStartedAt+engine.timing.previewMs,deadline=revealAt+engine.timing.searchMs;
      check(o.atMs+tolerance>=revealAt,uiText('پاسخ قبل از پایان نمایش نمونه ثبت شده است.'));
      if(o.response)check(o.atMs<deadline+tolerance,uiText('پاسخ پس از پایان زمان جست‌وجو ثبت شده است.'));
      else check(o.atMs+tolerance>=deadline,uiText('خطای حذف قبل از پایان زمان جست‌وجو معتبر نیست.'));
      const board=boards[o.round-1];check(Number.isInteger(o.choiceIndex)&&o.choiceIndex>=0&&o.choiceIndex<board.choices.length,uiText('گزینهٔ جست‌وجو معتبر نیست.'));const choice=board.choices[o.choiceIndex];
      const key=`${o.round}:${o.choiceIndex}`;check(!chosen.has(key),uiText('گزینه تکراری است.'));chosen.set(key,true);
      check(o.response||choice.target,uiText('حذف فقط برای هدف ثبت می‌شود.'));target=choice.target;stimulus=choice;context={round:o.round,choiceIndex:o.choiceIndex};
      if(target)found.set(o.round,(found.get(o.round)||0)+1);
    } else {
      const item=engine.items.find(item=>item.id===o.itemId);check(item&&!chosen.has(item.id),uiText('وسیلهٔ مأموریت معتبر یا یکتا نیست.'));chosen.set(item.id,true);
      if(practice)check(item===engine.items[i],uiText('ترتیب آموزش معتبر نیست.'));
      check(!item.blocked||(!practice&&!o.response)||cleared.get(item.id)<=o.atMs,uiText('مانع وسیله کنار نرفته است.'));
      if(!practice){
        const effectiveTime=o.atMs+wrongItems*PROTOCOL.penaltyMs,limit=engine.timing.limitMs;
        if(o.response)check(effectiveTime<limit+tolerance,uiText('انتخاب پس از پایان زمان مأموریت ثبت شده است.'));
        else check(item.required&&effectiveTime+tolerance>=limit,uiText('حذف وسیله فقط پس از پایان زمان مأموریت ثبت می‌شود.'));
      }
      target=item.required;context={item:item.name,itemId:item.id};
    }
    const correct=target?o.response&&selectedTarget!==false:!o.response;
    let rt=o.response?o.reactionMs:null;
    if(o.response)check((rt===null&&!correct)||Number.isFinite(rt)&&rt>=0&&rt<=payload.durationMs,uiText('زمان پاسخ معتبر نیست.'));
    if(trials&&o.response)check(rt!==null&&rt<engine.intervalMs,uiText('پاسخ خارج از پنجرهٔ نوبت است.'));
    if(boards&&o.response&&target)check(rt!==null&&rt<=engine.timing.searchMs&&Math.abs(o.atMs-roundStartedAt-engine.timing.previewMs-rt)<=tolerance,uiText('زمان واکنش با آغاز جست‌وجو یکسان نیست.'));
    if(game.kind==='adventure'&&o.response&&target){const onset=Math.max(records.at(-1)?.atMs||0,...[...cleared.values()].filter(at=>at<=o.atMs));rt=Math.max(0,o.atMs-onset);}
    if(game.kind==='adventure'&&!target&&o.response)wrongItems++;
    records.push({number:i+1,target,response:o.response,correct,reactionMs:rt,atMs:o.atMs,...context,...(stimulus?{stimulus}:{}),...(o.response&&trials?{selectedTarget,selectedStimulus}:{})});
  }
  if(boards)for(let round=1;round<=boards.length;round++)check(found.get(round)===settings.targetCount,uiText('همهٔ هدف‌های دور تعیین تکلیف نشده‌اند.'));
  let completed=true;
  if(game.kind==='adventure'){
    if(practice)check(records.length===5,uiText('آموزش باید پنج تصمیم داشته باشد.'));
    else {
      const deadline=engine.timing.limitMs;
      for(const atMs of cleared.values()){
        const priorWrong=records.filter(o=>!o.target&&o.response&&o.atMs<atMs-tolerance).length;
        check(atMs+priorWrong*PROTOCOL.penaltyMs<deadline+tolerance,uiText('مانع پس از پایان زمان مأموریت کنار زده شده است.'));
      }
      for(const item of engine.items.filter(i=>i.required))check(chosen.has(item.id),uiText('همهٔ وسایل ضروری تعیین تکلیف نشده‌اند.'));
      const hits=records.filter(o=>o.target&&o.response).length,wrong=records.filter(o=>!o.target&&o.response).length,limit=engine.timing.limitMs;
      completed=departedAt!==null;
      if(completed)check(hits===engine.required.length&&departedAt+wrong*PROTOCOL.penaltyMs<limit+tolerance&&departedAt>=records.at(-1).atMs,uiText('شرایط خروج به‌موقع برقرار نیست.'));
      else check(payload.durationMs+wrong*2000>=limit,uiText('مأموریت هنوز پایان نیافته است.'));
    }
  }
  const aggregate=new Session({gameId:game.id,level:settings.level,now:()=>0});
  for(const o of records)aggregate.record(o.target,o.response,o.reactionMs,{selectedTarget:o.selectedTarget});
  const m=aggregate.metrics,times=m.reactionTimes;
  const score=game.kind==='reaction'?Math.max(0,m.hits-m.falseAlarms):m.hits;
  return {version:1,experienceVersion:settings.experienceVersion,...(settings.experienceVersion>=4?{locale:engine.locale,stimulusPlan:engine.stimulusPlan,...(game.id==='traffic'?{trafficRouteVersion:1,journey:trafficJourney(records,{practice})}:{})}:{}),...(settings.trainingProfile?{trainingProfile:{...settings.trainingProfile}}:{}),...(settings.experienceVersion>=3?{timing:engine.result.timing,timingKey:engine.result.timingKey}:{}),...(game.id==='hunt'?{stimulusFamily:settings.theme||'star'}:{}),feedbackMode:practice&&settings.reviewEnabled?'guided':'continuous',stimulusVersion:settings.stimulusVersion??engine.stimulusVersion??1,protocolVersion:settings.protocolVersion,gameId:game.id,level:settings.level,variant:settings.variant,score,maxScore:engine.maxScore,hits:m.hits,correctResponses:m.hits+m.correctRejects,correctRejections:m.correctRejects,omissions:m.misses,falseSelections:m.falseAlarms,meanReactionMs:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null,reactionMeasure:engine.reactionMeasure,longestStreak:m.maxStreak,durationMs:Math.round(payload.durationMs),completed,finishedAt:new Date().toISOString(),outcomes:records,sessionId:run.id,settingsSnapshot:settings,...(game.kind==='search'?{targetsPerRound:settings.targetCount,rounds:engine.total,roundFlow:engine.result.roundFlow}:{}),...(game.kind==='adventure'?{events:clearEvents.map(event=>({...event})),mission:engine.mission.title,departed:!practice&&completed,obstaclesCleared:cleared.size,inventory:records.filter(o=>o.target&&o.response).map(o=>o.item)}:{})};
}
export function summaryResult(result){if(!result)return result;const source={...result,experienceVersion:result.experienceVersion??1,...(result.gameId==='hunt'&&result.settingsSnapshot?.theme?{stimulusFamily:result.stimulusFamily||result.settingsSnapshot.theme}:{})};return Object.fromEntries(['version','experienceVersion','locale','stimulusPlan','trafficRouteVersion','journey','trainingProfile','timing','timingKey','stimulusFamily','feedbackMode','stimulusVersion','protocolVersion','gameId','level','variant','score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','meanReactionMs','reactionMeasure','longestStreak','durationMs','completed','finishedAt','sessionId','targetsPerRound','rounds','roundFlow','mission','departed','obstaclesCleared','inventory','legacyId','source'].filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]));}
