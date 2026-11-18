import {LEVELS} from '../src/config.js';
import {timingIdentity,defaultTiming,validateTiming,timingKey,TIMING_FIELDS,TIMING_VARIANTS} from '../src/game-timing.js';
import {managedTransaction,guardRevision} from './management.js';
import {requireValue as check} from './security.js';

function identity(input){try{return timingIdentity(input);}catch(error){check(false,error.message);}}
export async function readGameTimings(db,childId,input){
 const key=identity(input),params=[key.gameId,key.variant,key.timingFamily,key.protocolVersion,childId||null];
 // One statement gives session creation a consistent view of both policy layers.
 const rows=(await db.query(`SELECT level,timing,revision,'global' AS scope FROM game_timing_defaults WHERE game_id=$1 AND variant=$2 AND timing_family=$3 AND protocol=$4
 UNION ALL SELECT level,timing,revision,'child' AS scope FROM child_game_timing_overrides WHERE game_id=$1 AND variant=$2 AND timing_family=$3 AND protocol=$4 AND child_id=$5`,params)).rows;
 return {identity:key,fields:TIMING_FIELDS,variants:TIMING_VARIANTS[key.gameId]||['standard'],levels:Object.keys(LEVELS).map(level=>{
  const defaults=defaultTiming({...key,level,theme:key.timingFamily==='moving'?'fish':'star',experienceVersion:3}),global=rows.find(row=>row.level===level&&row.scope==='global'),child=rows.find(row=>row.level===level&&row.scope==='child');
  return {level,defaults,global:global?.timing||null,override:child?.timing||null,timing:child?.timing||global?.timing||defaults,source:child?.timing?'child':global?.timing?'global':'default',revision:(childId?child:global)?.revision||0};
 })};
}
export async function sessionTiming(db,childId,settings,kind){
 const key=identity(settings);
 const timing=kind==='baseline'?defaultTiming(settings):(await readGameTimings(db,childId,key)).levels.find(row=>row.level===settings.level).timing;
 return {timing:validateTiming(settings.gameId,timing),timingKey:timingKey(timing)};
}
export function registerGameTimings(app,pool,{role,childAccess}){
 for(const scoped of [false,true]){
  const path=scoped?'/api/children/:id/game-timings':'/api/admin/game-timings';
  const access=async(req,write=false)=>scoped?childAccess(pool,req.user,req.params.id,write):role(req,['admin']);
  app.get(path,async(req,res)=>{
   await access(req);const data=await readGameTimings(pool,scoped?req.params.id:null,{...req.query,...(req.query.protocolVersion?{protocolVersion:Number(req.query.protocolVersion)}:{})});
   if(scoped&&req.user.role!=='admin')return res.json({identity:data.identity,levels:data.levels.map(({level,timing})=>({level,timing}))});
   res.json(data);
  });
  app.patch(path,async(req,res)=>{
   await access(req,true);const key=identity(req.body);let timing=null;
   if(req.body.timing!==null){try{timing=validateTiming(key.gameId,req.body.timing);}catch(error){check(false,error.message);}}
   const data=await managedTransaction(pool,req,async db=>{
    const table=scoped?'child_game_timing_overrides':'game_timing_defaults',columns=scoped?'child_id,game_id,variant,timing_family,protocol,level':'game_id,variant,timing_family,protocol,level',values=[...(scoped?[req.params.id]:[]),key.gameId,key.variant,key.timingFamily,key.protocolVersion,key.level];
    const where=columns.split(',').map((column,i)=>`${column}=$${i+1}`).join(' AND ');
    const current=(await db.query(`SELECT timing,revision FROM ${table} WHERE ${where} FOR UPDATE`,values)).rows[0];
    guardRevision(req.body.expectedRevision,current?.revision||0,current||{timing:null,revision:0},true);
    if(!current||timingKey(current.timing||{})!==timingKey(timing||{})){
     const placeholders=values.map((_,i)=>`$${i+1}`).join(',');
     await db.query(`INSERT INTO ${table}(${columns},timing,updated_by) VALUES(${placeholders},$${values.length+1},$${values.length+2}) ON CONFLICT(${columns}) DO UPDATE SET timing=EXCLUDED.timing,revision=${table}.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now()`,[...values,timing,req.user.id]);
     const owner=scoped?(await db.query('SELECT owner_user_id FROM children WHERE id=$1',[req.params.id])).rows[0].owner_user_id:null;
     await db.query('INSERT INTO audit_events(actor_id,target_user_id,child_id,action,changed_fields,metadata) VALUES($1,$2,$3,$4,$5,$6)',[req.user.id,owner,scoped?req.params.id:null,`${table}.${current?'updated':'created'}`,JSON.stringify(['timing']),key]);
    }
    return readGameTimings(db,scoped?req.params.id:null,key);
   });res.json(data);
  });
 }
}
