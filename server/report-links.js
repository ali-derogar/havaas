import {managedTransaction} from './management.js';
import {panelReport} from './panel.js';
import { randomUUID } from 'node:crypto';
import { token,digest,uuid,requireValue as check,textOf } from './security.js';
import {appOrigin} from './origin.js';

// Deliberately independent of the staff/session DTO, including legacy imports.
export {reportResult} from './report-data.js';
import {reportResult} from './report-data.js';

export function publicReportDTO(child,rows){
 return {displayName:`${child.profile.firstName} ${child.profile.lastName}`,generatedAt:new Date().toISOString(),sessions:rows.map((row,index)=>{
  const result=reportResult(row.result);
  return {number:index+1,kind:row.kind,result};
 })};
}
export function registerPublicReport(app,pool,limit){
 app.post('/api/public/report',limit,async(req,res)=>{check(typeof req.body.token==='string'&&/^[a-f0-9]{64}$/.test(req.body.token),'لینک گزارش معتبر نیست.',404);const child=(await pool.query('SELECT c.* FROM children c JOIN report_links l ON l.child_id=c.id WHERE l.token_hash=$1 AND l.revoked_at IS NULL',[digest(req.body.token)])).rows[0];check(child,'این لینک گزارش درست نیست یا لغو شده است. از فرستنده یک لینک تازه بگیرید.',404);if(req.body.view==='panel'||req.body.view==='print')return res.json(await panelReport(pool,child,{role:'public'},{...req.body,locale:req.get('X-App-Locale')==='en'?'en':'fa'}));const rows=(await pool.query('SELECT kind,result FROM game_sessions WHERE child_id=$1 AND result IS NOT NULL ORDER BY finished_at,id',[child.id])).rows;res.json(publicReportDTO(child,rows));});
}
export function registerReportLinks(app,pool,childAccess){
 app.get('/api/children/:id/report-links',async(req,res)=>{await childAccess(pool,req.user,req.params.id);res.json({links:(await pool.query('SELECT id,label,created_at AS "createdAt",revoked_at AS "revokedAt" FROM report_links WHERE child_id=$1 ORDER BY created_at DESC,id',[req.params.id])).rows});});
 app.post('/api/children/:id/report-links',async(req,res)=>{await childAccess(pool,req.user,req.params.id);const message='عنوان لینک باید بین ۱ تا ۱۰۰ کاراکتر داشته باشد.',label=textOf(req.body.label??'گزارش خانواده',message);check(label.length>=1&&label.length<=100,message);const raw=token(),id=randomUUID();await managedTransaction(pool,req,db=>db.query('INSERT INTO report_links(id,child_id,token_hash,label,created_by) VALUES($1,$2,$3,$4,$5)',[id,req.params.id,digest(raw),label,req.user.id]));res.status(201).json({id,url:`${appOrigin(req)}/#report/${raw}`});});
 app.delete('/api/children/:id/report-links/:linkId',async(req,res)=>{await childAccess(pool,req.user,req.params.id);uuid(req.params.linkId);check((await managedTransaction(pool,req,db=>db.query('UPDATE report_links SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND child_id=$2',[req.params.linkId,req.params.id]))).rowCount,'لینک پیدا نشد.',404);res.json({ok:true});});
}
