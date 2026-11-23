import {t as uiText,lt} from '../src/i18n.js';
import {validateTiming,timingKey} from '../src/game-timing.js';
import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { requireValue as check, digest, uuid } from './security.js';
import { validateProfile,isValidText } from '../src/core/clients.js';
import { GAME_MAP, GAME_PROTOCOLS, LEVELS } from '../src/config.js';
import { recommendLevel } from '../src/core/reports.js';
import {validStimulusPlan} from '../src/stimulus-plan.js';

function validDocumentText(input){
  const stack=[[input,0]];
  while(stack.length){
    const [value,depth]=stack.pop();if(depth>64)return false;
    if(typeof value==='string'&&!isValidText(value)||typeof value==='number'&&!Number.isFinite(value))return false;
    if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(!isValidText(key))return false;stack.push([child,depth+1]);}
  }
  return true;
}
function validTimestamp(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:[0-5]\d)$/i.test(value)||!Number.isFinite(Date.parse(value)))return false;
  const day=new Date(value.slice(0,10)+'T12:00:00Z'),time=new Date(value);
  return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value.slice(0,10)&&time.getUTCFullYear()>=1&&time.getUTCFullYear()<=9999;
}
function validLegacyStimulus(value){
 if(value===undefined||value===null)return true;
 return typeof value==='object'&&!Array.isArray(value)&&['shape','color','word'].every(key=>value[key]===undefined||value[key]===null||typeof value[key]==='string')&&(value.detail===undefined||value.detail===null||Number.isInteger(value.detail)&&value.detail>=0);
}
function validLegacyOutcome(outcome){
 return outcome&&typeof outcome==='object'&&!Array.isArray(outcome)&&['target','response','correct'].every(key=>typeof outcome[key]==='boolean')&&Number.isFinite(outcome.atMs)&&outcome.atMs>=0&&(outcome.reactionMs===null||Number.isFinite(outcome.reactionMs)&&outcome.reactionMs>=0)&&['number','round','phase'].every(key=>outcome[key]===undefined||outcome[key]===null||Number.isInteger(outcome[key])&&outcome[key]>=0)&&(outcome.item===undefined||outcome.item===null||typeof outcome.item==='string')&&(outcome.selectedTarget===undefined||outcome.selectedTarget===null||typeof outcome.selectedTarget==='boolean')&&validLegacyStimulus(outcome.stimulus)&&validLegacyStimulus(outcome.selectedStimulus);
}
export function inspectLegacy(input){
  const errors=[],profiles=Array.isArray(input?.profiles)?input.profiles:input?.profile?[input.profile]:[],records=input?.records;
  if(input?.version!==1||!profiles.length||!Array.isArray(records)||profiles.length>500||records.length>20000)return {errors:[uiText('فایل باید خروجی نسخهٔ ۱ و شامل مشخصات کاربران و سوابق بازی‌ها باشد. سوابق بدون مشخصات کاربر قابل انتقال نیستند.')]};
  if(!validDocumentText(input))return {errors:[uiText('بخشی از فایل قابل خواندن نیست یا ساختار آن بیش از حد تو‌در‌تو است.')]};
  const ids=new Set();
  for(const [i,p] of profiles.entries()){
    if(!p||typeof p.id!=='string'||p.id.length>150||ids.has(p.id)||validateProfile(p).error)errors.push(lt`مشخصات نفر ${i+1} ناقص یا تکراری است.`);else ids.add(p.id);
    if(p?.createdAt!==undefined&&!validTimestamp(p.createdAt))errors.push(lt`تاریخ و ساعت ثبت مشخصات نفر ${i+1} باید با قالب ISO و همراه منطقهٔ زمانی باشد.`);
  }
  const seen=new Set();
  for(const [i,r] of records.entries()){
    const result=r?.result,id=r?.id||digest(JSON.stringify(result)),profileId=r?.profileId||input.profile?.id;
    if(!r||typeof id!=='string'||id.length>150||!ids.has(profileId)||!['baseline','training'].includes(r.kind)||!result||typeof result.gameId!=='string'||!Object.hasOwn(GAME_MAP,result.gameId)||typeof result.level!=='string'||!Object.hasOwn(LEVELS,result.level)||!Number.isInteger(result.protocolVersion)||result.protocolVersion<1||result.protocolVersion>100||!validTimestamp(result.finishedAt)||typeof result.completed!=='boolean'||['score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','longestStreak','durationMs'].some(k=>!Number.isFinite(result[k])||result[k]<0)||result.score>result.maxScore||result.hits>result.maxScore||!(result.meanReactionMs===null||Number.isFinite(result.meanReactionMs)&&result.meanReactionMs>=0)||result.outcomes!==undefined&&!Array.isArray(result.outcomes)||seen.has(`${profileId}:${id}`))errors.push(lt`نتیجهٔ شمارهٔ ${i+1} درست نیست یا در فایل تکرار شده است.`);
    if(result&&(typeof (result.variant||'standard')!=='string'||String(result.variant||'standard').length>100||result.inventory!==undefined&&(!Array.isArray(result.inventory)||result.inventory.some(v=>typeof v!=='string'))||result.mission!==undefined&&typeof result.mission!=='string'))errors.push(lt`اطلاعات تکمیلی نتیجهٔ ${i+1} معتبر نیستند.`);
    if(result&&result.experienceVersion!==undefined&&![1,2,3,4].includes(result.experienceVersion))errors.push(lt`نسخهٔ تجربهٔ نتیجهٔ ${i+1} معتبر نیست.`);
    if(result?.experienceVersion>=3){try{validateTiming(result.gameId,result.timing);}catch{errors.push(lt`زمان‌بندی نتیجهٔ ${i+1} معتبر نیست.`);}}
    if(result?.experienceVersion===4){
      if(!['fa','en'].includes(result.locale))errors.push(uiText('زبان اجرای نتیجه معتبر نیست.'));
      const phases={hunt:r.kind==='baseline'?1:3,stroop:4,nback:1,search:r.kind==='baseline'?5:10}[result.gameId];
      if(phases&&(!validStimulusPlan(result.stimulusPlan)||result.stimulusPlan.colorsByPhase.length!==phases||result.stimulusPlan.colorsByPhase.some(colors=>colors.length!==(result.gameId==='hunt'&&result.variant==='divided'?2:1))))errors.push(uiText('برنامهٔ رنگ‌های نتیجه معتبر نیست.'));
    }
    if(result&&[result.stimulusFamily,result.settingsSnapshot?.theme].some(value=>value!==undefined&&value!==null&&(typeof value!=='string'||value.length>100)))errors.push(lt`خانوادهٔ محرک نتیجهٔ ${i+1} باید متن معتبر باشد.`);
    if(typeof profileId==='string'&&typeof id==='string')seen.add(`${profileId}:${id}`);
    if(Array.isArray(result?.outcomes)&&!result.outcomes.every(validLegacyOutcome))errors.push(lt`پاسخ‌های نتیجهٔ ${i+1} معتبر نیستند.`);
  }
  return {errors,document:errors.length?null:{version:1,profiles,records:records.map(r=>({...r,id:r.id||digest(JSON.stringify(r.result)),profileId:r.profileId||input.profile.id}))}};
}
export function registerImports(app,pool,{role,childAccess}){
  app.post('/api/imports/preview',async(req,res)=>{
    role(req,['admin']);const inspected=inspectLegacy(req.body.document);if(inspected.errors.length)return res.json({id:null,errors:inspected.errors});
    const id=randomUUID(),stored=(await pool.query('INSERT INTO import_previews(id,user_id,document,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\') RETURNING document',[id,req.user.id,inspected.document])).rows[0].document;
    const profiles=[];
    // Hash the same JSONB representation read during commit, including existing mappings.
    for(const p of stored.profiles){const key=digest(JSON.stringify(p)),known=(await pool.query('SELECT child_id FROM legacy_profiles WHERE source_key=$1',[key])).rows[0];let targetId=null;if(known){await childAccess(pool,req.user,known.child_id,true);targetId=known.child_id;}profiles.push({sourceId:p.id,profile:p,targetId,recordCount:stored.records.filter(r=>r.profileId===p.id).length});}
    res.json({id,errors:[],profiles,totalRecords:stored.records.length});
  });
  app.post('/api/imports/commit',async(req,res)=>{
    role(req,['admin']);uuid(req.body.previewId);check(Array.isArray(req.body.mapping)&&req.body.mapping.every(m=>m&&typeof m==='object'&&!Array.isArray(m)&&typeof m.sourceId==='string'&&(m.targetId===undefined||m.targetId===null||typeof m.targetId==='string')),uiText('برای انتقال سوابق، باید مشخصات قبلی و حساب مقصد هر نفر مشخص باشند.'));
    const response=await transaction(pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(82004175)');await db.query("SELECT set_config('havaas.actor_id',$1,true)",[req.user.id]);
      const preview=(await db.query('SELECT * FROM import_previews WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.body.previewId,req.user.id])).rows[0];check(preview&&new Date(preview.expires_at)>new Date(),uiText('این پیش‌نمایش دیگر قابل استفاده نیست. فایل را دوباره انتخاب کنید.'));if(preview.committed_at)return preview.response;
      const document=preview.document,targets=new Map();let createdProfiles=0,importedRecords=0;
      check(req.body.mapping.length===document.profiles.length,uiText('برای سوابق هر نفر، یک حساب مقصد انتخاب کنید.'));
      for(const p of document.profiles){
        const choices=req.body.mapping.filter(m=>m.sourceId===p.id);check(choices.length===1,uiText('برای هر نفر فقط یک حساب مقصد انتخاب کنید و هیچ موردی را خالی نگذارید.'));const m=choices[0],sourceKey=digest(JSON.stringify(p)),known=(await db.query('SELECT child_id FROM legacy_profiles WHERE source_key=$1',[sourceKey])).rows[0];let id=known?.child_id||m.targetId;
        if(known&&m.targetId)check(m.targetId===known.child_id,uiText('این سوابق قبلاً به حساب دیگری منتقل شده‌اند.'),409);
        if(id){const child=await childAccess(db,req.user,id,true);if(req.body.requireUser)check(child.owner_user_id,uiText('ابتدا کاربر مقصد را بسازید.'),400);}
        else {
          check(!req.body.requireUser,uiText('انتخاب کاربر مقصد الزامی است.'));
          check(!m.ownerUserId,uiText('اول برای این مشخصات حساب بسازید، سپس آن حساب را برای انتقال سوابق انتخاب کنید.'));id=randomUUID();
          await db.query('INSERT INTO children(id,profile,created_at) VALUES($1,$2,$3)',[id,validateProfile(p).profile,p.createdAt?new Date(p.createdAt).toISOString():new Date()]);createdProfiles++;
        }
        await db.query('INSERT INTO legacy_profiles(source_key,child_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sourceKey,id]);targets.set(p.id,id);
      }
      for(const r of document.records){
        const id=targets.get(r.profileId),result={...r.result,source:'legacy',legacyId:r.id},settings={...(result.experienceVersion>=3?{experienceVersion:result.experienceVersion,locale:result.locale||'fa',stimulusPlan:result.stimulusPlan,timing:validateTiming(result.gameId,result.timing),timingKey:timingKey(result.timing)}:{}),gameId:result.gameId,variant:result.variant||'standard',level:result.level,protocolVersion:result.protocolVersion,imported:true};
        if(result.experienceVersion>=3)result.timingKey=timingKey(result.timing);
        const added=await db.query('INSERT INTO game_sessions(id,child_id,actor_id,kind,settings,difficulty_revision,result,started_at,finished_at,legacy_id,import_key) VALUES($1,$2,$3,$4,$5,0,$6,$7,$7,$8,$9) ON CONFLICT DO NOTHING',[randomUUID(),id,req.user.id,r.kind,settings,result,new Date(result.finishedAt).toISOString(),r.id,digest(`${r.profileId}:${r.id}`)]);importedRecords+=added.rowCount;
      }
      for(const id of new Set(targets.values())){
        const baselines=(await db.query("SELECT DISTINCT ON (result->>'gameId',COALESCE(result->>'variant','standard'),result->>'protocolVersion') result FROM game_sessions WHERE child_id=$1 AND kind='baseline' AND result IS NOT NULL ORDER BY result->>'gameId',COALESCE(result->>'variant','standard'),result->>'protocolVersion',finished_at DESC,id DESC",[id])).rows;
        for(const {result} of baselines)if(result.protocolVersion===GAME_PROTOCOLS[result.gameId])await db.query('INSERT INTO difficulty(child_id,game_id,variant,protocol,level) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,result.gameId,result.variant||'standard',result.protocolVersion,recommendLevel(result).level]);
      }
      await db.query("INSERT INTO audit_events(actor_id,action,changed_fields,metadata) VALUES($1,'imports.completed','[]',$2)",[req.user.id,{createdProfiles,importedRecords}]);
      const response={createdProfiles,importedRecords,childIds:[...targets.values()]};await db.query('UPDATE import_previews SET committed_at=now(),response=$1 WHERE id=$2',[response,preview.id]);return response;
    });res.json(response);
  });
}
