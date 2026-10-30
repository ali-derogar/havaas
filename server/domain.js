import { GAME_MAP, GAME_PROTOCOLS, LEVELS, PROTOCOL } from '../src/config.js';
import { FACTORIES } from '../src/games/index.js';
import { generateSearch } from '../src/games/search.js';
import { seededRandom } from '../src/core/random.js';
import { Session } from '../src/core/session.js';
import { requireValue as check } from './security.js';

export function normalizeSettings(input={}) {
  check(input&&typeof input.gameId==='string'&&Object.hasOwn(GAME_MAP,input.gameId),'بازی معتبر نیست.');
  const options={gameId:input.gameId,level:'easy',theme:['star','shape','fish','butterfly','bird'].includes(input.theme)?input.theme:'star',material:['shapes','letters','numbers','toys'].includes(input.material)?input.material:'shapes',layout:input.layout==='scattered'?'scattered':'grid',trafficMode:input.trafficMode==='signs'?'signs':'circles',targetCount:input.targetCount===2?2:1};
  if(options.gameId==='search')options.pacedRounds=true;
  const sample=FACTORIES[options.gameId]({...options,practice:true,now:()=>0,random:seededRandom(0)});
  return {...options,variant:sample.variant,protocolVersion:GAME_PROTOCOLS[options.gameId],stimulusVersion:sample.stimulusVersion||1};
}
const same=(a,b)=>a&&b&&['shape','color','detail','word'].every(k=>(a[k]??(k==='detail'?0:undefined))===(b[k]??(k==='detail'?0:undefined)));
export function canonicalResult(run,payload) {
  const settings=run.settings, game=GAME_MAP[settings.gameId],practice=run.kind==='baseline';
  check(payload&&Array.isArray(payload.outcomes)&&payload.outcomes.length<=1000,'پاسخ‌های جلسه معتبر نیستند.');
  check(Number.isFinite(payload.durationMs)&&payload.durationMs>=0&&payload.durationMs<=86400000,'زمان جلسه معتبر نیست.');
  const engine=FACTORIES[game.id]({...settings,practice,now:()=>0,random:seededRandom(settings.seed)});
  const records=[],chosen=new Map(),found=new Map();let previous=0,searchRound=1,roundStartedAt=0,wrongItems=0;
  // Engine timestamps are rounded to milliseconds; allow only rounding error.
  const tolerance=2;
  const boards=game.kind==='search'?Array(engine.total):null;
  if(boards){const random=seededRandom(settings.seed);for(let i=0;i<engine.total;i++)boards[i]=generateSearch(settings.level,random,settings.layout,settings.material,settings.targetCount);}
  const trials=game.kind==='reaction'?engine.trials.filter(t=>t.scored!==false):null;
  if(trials){check(payload.outcomes.length===trials.length,'تعداد پاسخ‌ها با پروتکل جلسه یکسان نیست.');check(payload.durationMs+tolerance>=engine.trials.length*PROTOCOL.intervalMs,'زمان جلسه از زمان پروتکل کوتاه‌تر است.');}
  const clearEvents=Array.isArray(payload.events)?payload.events:[];const cleared=new Map();let departedAt=null;
  if(game.kind==='adventure'){
    let lastEventAt=0;
    for(const event of clearEvents){
      check(event&&['clear','depart'].includes(event.kind)&&Number.isFinite(event.atMs)&&event.atMs>=0&&event.atMs<=payload.durationMs,'رویداد مأموریت معتبر نیست.');
      check(event.atMs>=lastEventAt&&departedAt===null,'ترتیب رویدادهای مأموریت معتبر نیست.');lastEventAt=event.atMs;
      if(event.kind==='depart'){check(!practice&&departedAt===null,'خروج تکراری است.');departedAt=event.atMs;}
      else {const item=engine.items.find(i=>i.id===event.itemId);check(item?.blocked&&!cleared.has(item.id),'رویداد مانع معتبر نیست.');cleared.set(item.id,event.atMs);}
    }
  }
  for(const [i,o] of payload.outcomes.entries()){
    check(o&&typeof o.response==='boolean'&&Number.isFinite(o.atMs)&&o.atMs>=previous&&o.atMs<=payload.durationMs,'ترتیب یا زمان پاسخ معتبر نیست.');previous=o.atMs;
    let target,stimulus,selectedTarget,selectedStimulus,context={};
    if(trials){
      const earliest=i?payload.outcomes[i-1].atMs+PROTOCOL.intervalMs:(engine.trials.length-trials.length+1)*PROTOCOL.intervalMs;
      check(o.atMs+tolerance>=earliest,'فاصلهٔ پاسخ‌ها با نوبت‌های بازی یکسان نیست.');
      const trial=trials[i];target=trial.target;stimulus=trial.stimulus;context.phase=trial.phase;
      if(o.response){
        if(game.id==='hunt') {const choice=trial.choices.find(c=>same(c.stimulus,o.selectedStimulus));check(choice,'محرک انتخاب‌شده در این نوبت وجود ندارد.');selectedTarget=choice.target;selectedStimulus=choice.stimulus;}
        else {selectedTarget=target;selectedStimulus=stimulus;}
      }
    } else if(boards){
      check(Number.isInteger(o.round)&&o.round>=1&&o.round<=boards.length&&(i===0||o.round>=payload.outcomes[i-1].round),'دور جست‌وجو معتبر نیست.');
      if(o.round!==searchRound){check(o.round===searchRound+1&&found.get(searchRound)===settings.targetCount,'دور قبلی جست‌وجو کامل نشده است.');searchRound=o.round;roundStartedAt=records.at(-1).atMs;}
      check((found.get(searchRound)||0)<settings.targetCount,'دور جست‌وجو قبلاً پایان یافته است.');
      const revealAt=roundStartedAt+PROTOCOL.previewMs,deadline=revealAt+LEVELS[settings.level].searchSeconds*1000;
      check(o.atMs+tolerance>=revealAt,'پاسخ قبل از پایان نمایش نمونه ثبت شده است.');
      if(o.response)check(o.atMs<deadline+tolerance,'پاسخ پس از پایان زمان جست‌وجو ثبت شده است.');
      else check(o.atMs+tolerance>=deadline,'خطای حذف قبل از پایان زمان جست‌وجو معتبر نیست.');
      const board=boards[o.round-1];check(Number.isInteger(o.choiceIndex)&&o.choiceIndex>=0&&o.choiceIndex<board.choices.length,'گزینهٔ جست‌وجو معتبر نیست.');const choice=board.choices[o.choiceIndex];
      const key=`${o.round}:${o.choiceIndex}`;check(!chosen.has(key),'گزینه تکراری است.');chosen.set(key,true);
      check(o.response||choice.target,'حذف فقط برای هدف ثبت می‌شود.');target=choice.target;stimulus=choice;context={round:o.round,choiceIndex:o.choiceIndex};
      if(target)found.set(o.round,(found.get(o.round)||0)+1);
    } else {
      const item=engine.items.find(item=>item.id===o.itemId);check(item&&!chosen.has(item.id),'وسیلهٔ مأموریت معتبر یا یکتا نیست.');chosen.set(item.id,true);
      if(practice)check(item===engine.items[i],'ترتیب آموزش معتبر نیست.');
      check(!item.blocked||(!practice&&!o.response)||cleared.get(item.id)<=o.atMs,'مانع وسیله کنار نرفته است.');
      if(!practice){
        const effectiveTime=o.atMs+wrongItems*PROTOCOL.penaltyMs,limit=LEVELS[settings.level].seconds*1000;
        if(o.response)check(effectiveTime<limit+tolerance,'انتخاب پس از پایان زمان مأموریت ثبت شده است.');
        else check(item.required&&effectiveTime+tolerance>=limit,'حذف وسیله فقط پس از پایان زمان مأموریت ثبت می‌شود.');
      }
      target=item.required;context={item:item.name,itemId:item.id};
    }
    const correct=target?o.response&&selectedTarget!==false:!o.response;
    let rt=o.response?o.reactionMs:null;
    if(o.response)check((rt===null&&!correct)||Number.isFinite(rt)&&rt>=0&&rt<=payload.durationMs,'زمان پاسخ معتبر نیست.');
    if(trials&&o.response)check(rt!==null&&rt<1000,'پاسخ خارج از پنجرهٔ نوبت است.');
    if(boards&&o.response&&target)check(rt!==null&&rt<=LEVELS[settings.level].searchSeconds*1000&&Math.abs(o.atMs-roundStartedAt-PROTOCOL.previewMs-rt)<=tolerance,'زمان واکنش با آغاز جست‌وجو یکسان نیست.');
    if(game.kind==='adventure'&&o.response&&target){const onset=Math.max(records.at(-1)?.atMs||0,...[...cleared.values()].filter(at=>at<=o.atMs));rt=Math.max(0,o.atMs-onset);}
    if(game.kind==='adventure'&&!target&&o.response)wrongItems++;
    records.push({number:i+1,target,response:o.response,correct,reactionMs:rt,atMs:o.atMs,...context,...(stimulus?{stimulus}:{}),...(o.response&&trials?{selectedTarget,selectedStimulus}:{})});
  }
  if(boards)for(let round=1;round<=boards.length;round++)check(found.get(round)===settings.targetCount,'همهٔ هدف‌های دور تعیین تکلیف نشده‌اند.');
  let completed=true;
  if(game.kind==='adventure'){
    if(practice)check(records.length===5,'آموزش باید پنج تصمیم داشته باشد.');
    else {
      const deadline=LEVELS[settings.level].seconds*1000;
      for(const atMs of cleared.values()){
        const priorWrong=records.filter(o=>!o.target&&o.response&&o.atMs<atMs-tolerance).length;
        check(atMs+priorWrong*PROTOCOL.penaltyMs<deadline+tolerance,'مانع پس از پایان زمان مأموریت کنار زده شده است.');
      }
      for(const item of engine.items.filter(i=>i.required))check(chosen.has(item.id),'همهٔ وسایل ضروری تعیین تکلیف نشده‌اند.');
      const hits=records.filter(o=>o.target&&o.response).length,wrong=records.filter(o=>!o.target&&o.response).length,limit=LEVELS[settings.level].seconds*1000;
      completed=departedAt!==null;
      if(completed)check(hits===engine.required.length&&departedAt+wrong*PROTOCOL.penaltyMs<limit+tolerance&&departedAt>=records.at(-1).atMs,'شرایط خروج به‌موقع برقرار نیست.');
      else check(payload.durationMs+wrong*2000>=limit,'مأموریت هنوز پایان نیافته است.');
    }
  }
  const aggregate=new Session({gameId:game.id,level:settings.level,now:()=>0});
  for(const o of records)aggregate.record(o.target,o.response,o.reactionMs,{selectedTarget:o.selectedTarget});
  const m=aggregate.metrics,times=m.reactionTimes;
  const score=game.kind==='reaction'?Math.max(0,m.hits-m.falseAlarms):m.hits;
  return {version:1,...(game.id==='hunt'?{stimulusFamily:settings.theme||'star'}:{}),feedbackMode:practice&&settings.reviewEnabled?'guided':'continuous',stimulusVersion:settings.stimulusVersion??engine.stimulusVersion??1,protocolVersion:settings.protocolVersion,gameId:game.id,level:settings.level,variant:settings.variant,score,maxScore:engine.maxScore,hits:m.hits,correctResponses:m.hits+m.correctRejects,correctRejections:m.correctRejects,omissions:m.misses,falseSelections:m.falseAlarms,meanReactionMs:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null,reactionMeasure:engine.reactionMeasure,longestStreak:m.maxStreak,durationMs:Math.round(payload.durationMs),completed,finishedAt:new Date().toISOString(),outcomes:records,sessionId:run.id,settingsSnapshot:settings,...(game.kind==='search'?{targetsPerRound:settings.targetCount,rounds:engine.total,roundFlow:!practice&&settings.pacedRounds?'ready':'continuous'}:{}),...(game.kind==='adventure'?{events:clearEvents.map(event=>({...event})),mission:engine.mission.title,departed:!practice&&completed,obstaclesCleared:cleared.size,inventory:records.filter(o=>o.target&&o.response).map(o=>o.item)}:{})};
}
export function summaryResult(result){if(!result)return result;const source={...result,...(result.gameId==='hunt'&&result.settingsSnapshot?.theme?{stimulusFamily:result.stimulusFamily||result.settingsSnapshot.theme}:{})};return Object.fromEntries(['version','stimulusFamily','feedbackMode','stimulusVersion','protocolVersion','gameId','level','variant','score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','meanReactionMs','reactionMeasure','longestStreak','durationMs','completed','finishedAt','sessionId','targetsPerRound','rounds','roundFlow','mission','departed','obstaclesCleared','inventory','legacyId','source'].filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]));}
