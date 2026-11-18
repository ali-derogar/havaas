import {GAMES,GAME_PROTOCOLS} from '../src/config.js';
import {assessmentSteps} from '../src/core/assessment.js';
import {variantOf} from '../src/core/clients.js';
import {comparableRecords,parentNarrative,progressText} from '../src/core/reports.js';
import {reportResult} from './report-data.js';
import {pagination} from './management.js';
import {requireValue as check,uuid} from './security.js';

// Never transfer outcomes or arbitrary imported metadata from PostgreSQL to a panel.
const keys=['version','experienceVersion','stimulusVersion','protocolVersion','gameId','level','variant','feedbackMode','roundFlow','reactionMeasure','stimulusFamily','score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','meanReactionMs','longestStreak','durationMs','completed','finishedAt','targetsPerRound','rounds','obstaclesCleared','departed'];
const projection=`jsonb_build_object(${keys.map(key=>`'${key}',result->'${key}'`).join(',')},'settingsSnapshot',jsonb_build_object('theme',result->'settingsSnapshot'->'theme'))`;
export async function summaryRows(pool,childId){
 return (await pool.query(`SELECT id,child_id,report_ref,kind,${projection} AS result FROM game_sessions WHERE child_id=$1 AND result IS NOT NULL ORDER BY finished_at,id`,[childId])).rows.map(row=>({...row,result:reportResult(row.result)}));
}
const record=row=>({id:row.id,profileId:row.child_id,kind:row.kind,result:row.result});
const publicRecord=row=>({ref:row.report_ref,kind:row.kind,result:row.result});
export async function panelSummary(pool,childId){
 const rows=childId?await summaryRows(pool,childId):[],records=rows.map(record),baselines=new Map(),latest=new Map();
 for(const r of records){
  if((r.result.protocolVersion||2)!==GAME_PROTOCOLS[r.result.gameId])continue;
  const key=r.result.gameId+':'+variantOf(r.result);latest.set(key,r);
  if(r.kind==='baseline')baselines.set(key,r);
 }
 return {trainingTotal:records.filter(r=>r.kind==='training').length,lastActivityAt:records.at(-1)?.result.finishedAt||null,
  games:GAMES.map(game=>{const training=records.filter(r=>r.kind==='training'&&r.result.gameId===game.id);return {id:game.id,count:training.length,lastPlayedAt:training.at(-1)?.result.finishedAt||null};}),
  baselines:[...baselines.values()],latestResults:[...latest.values()],
  assessmentSteps:assessmentSteps({activeId:childId,records}).map(s=>({gameId:s.game.id,baseline:s.baseline,recommendation:s.recommendation})),
 };
}
export async function bestScoreFor(pool,childId,result,kind='training'){
 const rows=(await summaryRows(pool,childId)).map(record),group=comparableRecords(rows,{kind,result});
 return group.length?Math.max(...group.map(r=>r.result.score)):null;
}
export async function panelReport(pool,child,user,input={}){
 const {page,pageSize}=pagination(input),rows=await summaryRows(pool,child.id),publicView=user.role==='public';
 const filters={game:input.game||'',level:input.level||'',variant:input.variant||'',kind:input.kind??'training'};
 check(!filters.game||GAMES.some(g=>g.id===filters.game),'بازی معتبر انتخاب کنید.');
 check(['','easy','medium','hard'].includes(filters.level)&&['','baseline','training'].includes(filters.kind),'فیلتر گزارش معتبر نیست.');
 const variants=[...new Set(rows.map(r=>variantOf(r.result)))];check(typeof filters.variant==='string'&&(!filters.variant||variants.includes(filters.variant)),'حالت معتبر انتخاب کنید.');
 const reference=input.recordRef||input.recordId;
 if(reference){uuid(reference);check(rows.some(row=>(publicView?row.report_ref:row.id)===reference),'جلسه پیدا نشد.',404);}
 const filtered=rows.filter(r=>(!filters.game||r.result.gameId===filters.game)&&(!filters.level||r.result.level===filters.level)&&(!filters.variant||variantOf(r.result)===filters.variant)&&(!filters.kind||r.kind===filters.kind));
 const selected=filtered.find(row=>(publicView?row.report_ref:row.id)===reference)||filtered.at(-1),all=filtered.map(record),selectedRecord=selected&&record(selected);
 const cohort=selected?comparableRecords(all,selectedRecord):[],ids=new Set(cohort.slice(-20).map(r=>r.id));
 if(selected&&user.role==='admin'){const extra=(await pool.query("SELECT result->'mission' AS mission,result->'inventory' AS inventory FROM game_sessions WHERE id=$1 AND child_id=$2",[selected.id,child.id])).rows[0];if(typeof extra?.mission==='string')selected.result.mission=extra.mission;if(Array.isArray(extra?.inventory))selected.result.inventory=extra.inventory.filter(value=>typeof value==='string');}
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),effective=Math.min(page,pages),print=input.view==='print';
 const visible=print?filtered:[...filtered].reverse().slice((effective-1)*pageSize,effective*pageSize).reverse(),dto=publicView?publicRecord:user.role==='admin'?record:row=>({...record(row),result:reportResult(row.result)});
 const common={records:visible.map(dto),selected:selected?dto(selected):null,trend:rows.filter(r=>ids.has(r.id)).map(dto),progress:selected?progressText(all,selectedRecord):'',narrative:selected?parentNarrative(selectedRecord,all):'',variants,trainingTotal:rows.filter(r=>r.kind==='training').length,pagination:{page:effective,pageSize,total:filtered.length,pages}};
 return publicView?{...common,displayName:`${child.profile.firstName} ${child.profile.lastName}`,generatedAt:new Date().toISOString()}:{...common,profileId:child.id};
}
