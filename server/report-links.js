import { randomUUID } from 'node:crypto';
import { token,digest,uuid,requireValue as check } from './security.js';

// Deliberately independent of the staff/session DTO, including legacy imports.
export function reportResult(source){
 if(!source)return null;const result={};
 for(const key of ['version','stimulusVersion','protocolVersion','score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','longestStreak','durationMs','targetsPerRound','rounds','obstaclesCleared'])if(Number.isFinite(source[key])&&source[key]>=0)result[key]=source[key];
 const choices={gameId:['hunt','ark','space','traffic','search','nback','stroop'],level:['easy','medium','hard'],variant:['standard','divided','signs','scattered','letters','letters-scattered','dual','letters-dual','scattered-dual','letters-scattered-dual','numbers','toys'],feedbackMode:['guided','continuous'],roundFlow:['ready','continuous'],reactionMeasure:['stimulus-onset','search-onset','decision-interval'],stimulusFamily:['star','shape','fish','butterfly','bird']};
 for(const [key,values] of Object.entries(choices)){const value=key==='stimulusFamily'?source[key]||source.settingsSnapshot?.theme:source[key];if(values.includes(value))result[key]=value;}
 result.meanReactionMs=Number.isFinite(source.meanReactionMs)&&source.meanReactionMs>=0?source.meanReactionMs:null;
 for(const key of ['completed','departed'])if(typeof source[key]==='boolean')result[key]=source[key];
 if(Number.isFinite(Date.parse(source.finishedAt)))result.finishedAt=new Date(source.finishedAt).toISOString();
 return result;
}

export function publicReportDTO(child,rows){
 return {displayName:`${child.profile.firstName} ${child.profile.lastName}`,generatedAt:new Date().toISOString(),sessions:rows.map((row,index)=>{
  const result=reportResult(row.result);
  return {number:index+1,kind:row.kind,result};
 })};
}
export function registerPublicReport(app,pool,limit){
 app.post('/api/public/report',limit,async(req,res)=>{check(typeof req.body.token==='string'&&/^[a-f0-9]{64}$/.test(req.body.token),'لینک گزارش معتبر نیست.',404);const child=(await pool.query('SELECT c.* FROM children c JOIN report_links l ON l.child_id=c.id WHERE l.token_hash=$1 AND l.revoked_at IS NULL',[digest(req.body.token)])).rows[0];check(child,'لینک گزارش نامعتبر یا لغو شده است.',404);const rows=(await pool.query('SELECT kind,result FROM game_sessions WHERE child_id=$1 AND result IS NOT NULL ORDER BY finished_at,id',[child.id])).rows;res.json(publicReportDTO(child,rows));});
}
export function registerReportLinks(app,pool,childAccess){
 app.get('/api/children/:id/report-links',async(req,res)=>{await childAccess(pool,req.user,req.params.id);res.json({links:(await pool.query('SELECT id,label,created_at AS "createdAt",revoked_at AS "revokedAt" FROM report_links WHERE child_id=$1 ORDER BY created_at DESC,id',[req.params.id])).rows});});
 app.post('/api/children/:id/report-links',async(req,res)=>{await childAccess(pool,req.user,req.params.id);const label=String(req.body.label||'گزارش والد').trim();check(label.length>=1&&label.length<=100,'عنوان لینک باید بین ۱ تا ۱۰۰ نویسه باشد.');const raw=token(),id=randomUUID();await pool.query('INSERT INTO report_links(id,child_id,token_hash,label,created_by) VALUES($1,$2,$3,$4,$5)',[id,req.params.id,digest(raw),label,req.user.id]);res.status(201).json({id,url:`${process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`}/#report/${raw}`});});
 app.delete('/api/children/:id/report-links/:linkId',async(req,res)=>{await childAccess(pool,req.user,req.params.id);uuid(req.params.linkId);check((await pool.query('UPDATE report_links SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND child_id=$2',[req.params.linkId,req.params.id])).rowCount,'لینک پیدا نشد.',404);res.json({ok:true});});
}
