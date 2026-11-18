import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {LEVELS} from '../src/config.js';
import {defaultTiming,timingKey} from '../src/game-timing.js';
import {createProfileSettings,validateProfileSettings,profileEntry,profileFamilies} from '../src/training-profiles.js';
import {managedTransaction,guardRevision} from './management.js';
import {requireValue as check,textOf,uuid} from './security.js';

export const trainingProfileSummary=row=>({id:row.id,name:row.name,revision:row.revision,archived:row.archived});
const profileDTO=row=>({...trainingProfileSummary(row),description:row.description,builtin:false,settings:row.settings});
export async function readBuiltinProfile(db,level){
 check(Object.hasOwn(LEVELS,level),'پروفایل پیدا نشد.',404);
 const rows=(await db.query('SELECT game_id,variant,timing_family,protocol,timing,revision FROM game_timing_defaults WHERE level=$1',[level])).rows;
 const settings=createProfileSettings(level);
 for(const entry of settings)for(const family of profileFamilies(entry.gameId)){
  const row=rows.find(row=>row.game_id===entry.gameId&&row.variant===entry.variant&&row.protocol===entry.protocolVersion&&row.timing_family===family);
  if(row?.timing)entry.timings[family]=row.timing;
 }
 return {id:`builtin:${level}`,name:LEVELS[level].label,description:'سطح پیش‌فرض؛ قابل استفاده به روش ثابت یا تطبیقی',builtin:true,builtinLevel:level,archived:false,revision:1+rows.reduce((sum,row)=>sum+row.revision,0),settings};
}
export async function readTrainingProfile(db,id){
 if(typeof id==='string'&&id.startsWith('builtin:'))return readBuiltinProfile(db,id.slice(8));
 uuid(id);const row=(await db.query('SELECT * FROM training_profiles WHERE id=$1',[id])).rows[0];check(row,'پروفایل پیدا نشد.',404);return profileDTO(row);
}
export async function listTrainingProfiles(db){
 const builtins=[];for(const level of Object.keys(LEVELS)){const {settings,...profile}=await readBuiltinProfile(db,level);builtins.push(profile);}
 const rows=(await db.query('SELECT id,name,description,archived,revision FROM training_profiles ORDER BY archived,created_at,id')).rows;
 return [...builtins,...rows.map(row=>({...row,builtin:false}))];
}
async function auditProfile(db,req,id,fields,created=false){
 await db.query('INSERT INTO audit_events(actor_id,action,changed_fields,metadata) VALUES($1,$2,$3,$4)',[req.user.id,`training_profiles.${created?'created':'updated'}`,JSON.stringify(fields),{trainingProfileId:id}]);
}
export function registerTrainingProfiles(app,pool,{role}){
 app.get('/api/admin/training-profiles',async(req,res)=>{role(req,['admin']);res.json({profiles:await listTrainingProfiles(pool)});});
 app.get('/api/admin/training-profiles/:id',async(req,res)=>{role(req,['admin']);res.json({profile:await readTrainingProfile(pool,req.params.id)});});
 const save=creating=>async(req,res)=>{
  role(req,['admin']);const profile=await managedTransaction(pool,req,async db=>{
   const previous=creating?null:await readTrainingProfile(db,req.params.id);
   if(previous)guardRevision(req.body.expectedRevision,previous.revision,previous);
   if(previous?.builtin){
    let settings;try{settings=validateProfileSettings(req.body.settings);}catch(error){check(false,error.message);}
    check(settings.every(entry=>entry.level===previous.builtinLevel),'سطح پایهٔ پروفایل پیش‌فرض قابل تغییر نیست.');
    check((req.body.name===undefined||req.body.name===previous.name)&&!req.body.archived,'نام و وضعیت پروفایل پیش‌فرض قابل تغییر نیست.');
    if(isDeepStrictEqual(settings,previous.settings))return previous;
    for(const entry of settings)for(const family of profileFamilies(entry.gameId)){
     const prior=profileEntry(previous.settings,entry.gameId,entry.variant).timings[family],timing=entry.timings[family];if(timingKey(prior)===timingKey(timing))continue;
     const defaults=defaultTiming({...entry,theme:family==='moving'?'fish':'star',experienceVersion:3}),value=timingKey(defaults)===timingKey(timing)?null:timing;
     await db.query(`INSERT INTO game_timing_defaults(game_id,variant,timing_family,protocol,level,timing,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(game_id,variant,timing_family,protocol,level) DO UPDATE SET timing=EXCLUDED.timing,revision=game_timing_defaults.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now()`,[entry.gameId,entry.variant,family,entry.protocolVersion,entry.level,value,req.user.id]);
    }
    await auditProfile(db,req,previous.id,['settings']);return readBuiltinProfile(db,previous.builtinLevel);
   }
   const name=textOf(req.body.name??previous?.name,'نام پروفایل معتبر وارد کنید.'),description=textOf(req.body.description??previous?.description??'','توضیحات معتبر وارد کنید.');
   check(name.length>=2&&name.length<=120&&description.length<=500,'نام باید ۲ تا ۱۲۰ نویسه و توضیحات حداکثر ۵۰۰ نویسه باشد.');
   check(!Object.values(LEVELS).some(level=>level.label===name),'این نام برای سطح پیش‌فرض رزرو شده است.');
   check(req.body.archived===undefined||typeof req.body.archived==='boolean','وضعیت بایگانی معتبر نیست.');
   const archived=req.body.archived??previous?.archived??false;let settings;
   try{settings=validateProfileSettings(req.body.settings??previous?.settings);}catch(error){check(false,error.message);}
   if(!archived)check(!(await db.query('SELECT 1 FROM training_profiles WHERE lower(name)=lower($1) AND NOT archived AND id IS DISTINCT FROM $2::uuid',[name,previous?.id||null])).rowCount,'پروفایل فعالی با این نام وجود دارد.',409,'PROFILE_NAME_EXISTS');
   const fields=['name','description','settings','archived'].filter(field=>!isDeepStrictEqual(previous?.[field],{name,description,settings,archived}[field]));
   if(previous&&!fields.length)return previous;
   const id=previous?.id||randomUUID();
   const row=previous?(await db.query('UPDATE training_profiles SET name=$1,description=$2,settings=$3,archived=$4,revision=revision+1,updated_by=$5,updated_at=now() WHERE id=$6 RETURNING *',[name,description,JSON.stringify(settings),archived,req.user.id,id])).rows[0]:(await db.query('INSERT INTO training_profiles(id,name,description,settings,archived,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING *',[id,name,description,JSON.stringify(settings),archived,req.user.id])).rows[0];
   // Keep existing readers and adaptive guards coherent with a live profile edit.
   if(previous)for(const entry of settings)await db.query("UPDATE difficulty SET level=$1,mode='fixed',revision=revision+1,updated_at=now() WHERE training_profile_id=$2 AND game_id=$3 AND variant=$4 AND protocol=$5 AND (level IS DISTINCT FROM $1 OR mode<>'fixed')",[entry.level,id,entry.gameId,entry.variant,entry.protocolVersion]);
   await auditProfile(db,req,id,fields,creating);return profileDTO(row);
  });res.status(creating?201:200).json({profile});
 };
 app.post('/api/admin/training-profiles',save(true));app.patch('/api/admin/training-profiles/:id',save(false));
}
export async function difficultySettings(db,childId){
 return (await db.query(`SELECT d.game_id AS "gameId",d.variant,d.protocol AS "protocolVersion",d.mode,d.level,d.revision,d.training_profile_id AS "trainingProfileId",
 CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'name',p.name,'revision',p.revision,'archived',p.archived) END AS "trainingProfile"
 FROM difficulty d LEFT JOIN training_profiles p ON p.id=d.training_profile_id WHERE d.child_id=$1`,[childId])).rows;
}
export async function assignedTrainingProfile(db,childId,key){
 const row=(await db.query('SELECT p.* FROM difficulty d JOIN training_profiles p ON p.id=d.training_profile_id WHERE d.child_id=$1 AND d.game_id=$2 AND d.variant=$3 AND d.protocol=$4',[childId,key.gameId,key.variant,key.protocolVersion])).rows[0];
 if(!row)return null;
 const entry=profileEntry(row.settings,key.gameId,key.variant);check(entry,'تنظیم این بازی در پروفایل کامل نیست.',409,'PROFILE_INCOMPLETE');return {profile:trainingProfileSummary(row),entry};
}
export async function prepareProfileAssignment(db,req,key,current){
 const explicit=Object.hasOwn(req.body,'trainingProfileId');
 if(!explicit){check(!current?.training_profile_id,'برای تغییر پروفایل، پنل را به‌روزرسانی کنید.',409,'CLIENT_UPDATE_REQUIRED');return {mode:req.body.mode,level:req.body.level,id:null};}
 guardRevision(req.body.expectedRevision,current?.revision||0,current||{},true);
 let selection={mode:req.body.mode,level:req.body.level,id:null};
 if(req.body.trainingProfileId!==null){
  const profile=await readTrainingProfile(db,uuid(req.body.trainingProfileId));check(!profile.archived||current?.training_profile_id===profile.id,'پروفایل بایگانی‌شده قابل تخصیص جدید نیست.',409,'PROFILE_ARCHIVED');
  selection={mode:'fixed',level:profileEntry(profile.settings,key.gameId,key.variant).level,id:profile.id};
 }
 check(['fixed','adaptive'].includes(selection.mode)&&Object.hasOwn(LEVELS,selection.level),'سطح و روش معتبر انتخاب کنید.');
 let cleared=0;
 if(!selection.id)cleared=(await db.query('UPDATE child_game_timing_overrides SET timing=NULL,revision=revision+1,updated_by=$5,updated_at=now() WHERE child_id=$1 AND game_id=$2 AND variant=$3 AND protocol=$4 AND timing IS NOT NULL',[req.params.id,key.gameId,key.variant,key.protocolVersion,req.user.id])).rowCount;
 if(current?.training_profile_id!==selection.id&&(current?.training_profile_id||selection.id)||cleared){
  const owner=(await db.query('SELECT owner_user_id FROM children WHERE id=$1',[req.params.id])).rows[0].owner_user_id;
  await db.query("INSERT INTO audit_events(actor_id,target_user_id,child_id,action,changed_fields,metadata) VALUES($1,$2,$3,'difficulty.updated',$4,$5)",[req.user.id,owner,req.params.id,JSON.stringify(['trainingProfile']),{gameId:key.gameId,variant:key.variant,trainingProfileId:selection.id}]);
 }
 return {...selection,cleared};
}
