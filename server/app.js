import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit,ipKeyGenerator } from 'express-rate-limit';
import { randomUUID, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { transaction } from './db.js';
import { HttpError, requireValue as check, token, uuid, publicUser } from './security.js';
import { canonicalResult, normalizeSettings } from './domain.js';
import { validateProfile } from '../src/core/clients.js';
import { recommendLevel } from '../src/core/reports.js';
import { assessmentSteps } from '../src/core/assessment.js';
import { registerImports } from './imports.js';
import { registerAccounts } from './accounts.js';
import { registerPublicReport,registerReportLinks,reportResult } from './report-links.js';

const PgStore=connectPg(session);
const role=(req,roles)=>check(roles.includes(req.user.role),'اجازهٔ این عملیات را ندارید.',403,'FORBIDDEN');
export async function childAccess(db,user,id,write=false){
  uuid(id);if(write)check(user.role==='admin','این عملیات مخصوص ادمین است.',403,'FORBIDDEN');
  const child=(await db.query("SELECT * FROM children WHERE id=$1 AND ($2='admin' OR owner_user_id=$3)",[id,user.role,user.id])).rows[0];
  check(child,'پرونده یافت نشد یا دسترسی ندارید.',404,'NOT_FOUND');return child;
}
export function profileDTO(child,user){const profile=user.role==='admin'?{...child.profile}:Object.fromEntries(['firstName','lastName','birthDate','grade','school'].map(key=>[key,child.profile[key]]));return {...profile,id:child.id,ownerUserId:child.owner_user_id,createdAt:child.created_at};}
export function recordDTO(row,user){return {id:row.id,profileId:row.child_id,kind:row.kind,result:user.role==='admin'?row.result:reportResult(row.result),...(user.role==='admin'?{actorId:row.actor_id,legacyId:row.legacy_id}:{}),startedAt:row.started_at};}
async function listChildren(db,user){return (await db.query("SELECT * FROM children WHERE $1='admin' OR owner_user_id=$2 ORDER BY created_at,id",[user.role,user.id])).rows;}
export function createApp({pool,secret=process.env.SESSION_SECRET,production=process.env.NODE_ENV==='production',trustProxy=process.env.TRUST_PROXY==='1',staticRoot=resolve('dist'),loginLimit=15}={}){
  check(typeof secret==='string'&&secret.length>=32&&!secret.includes('replace-with'),'SESSION_SECRET must contain at least 32 characters',500);
  const app=express();app.disable('x-powered-by');if(trustProxy)app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],fontSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:production?[]:null}},strictTransportSecurity:production?undefined:false}));
  app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true});}catch{res.status(503).json({ok:false});}});
  app.use('/api',express.json({limit:'20mb'}));
  app.use('/api',(req,_res,next)=>{req.body ||= {};next();});
  app.use('/api',session({name:'havaas.sid',secret,resave:false,saveUninitialized:false,store:new PgStore({pool,tableName:'auth_sessions',createTableIfMissing:false}),cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:8*60*60*1000}}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');req.session.csrf ||= token();if(!['GET','HEAD','OPTIONS'].includes(req.method)){
    const origin=req.get('Origin');const expected=process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`;
    if((origin&&origin!==expected)||req.get('X-CSRF-Token')!==req.session.csrf)return next(new HttpError(403,'درخواست معتبر نیست؛ صفحه را تازه کنید.','CSRF'));
  }next();});
  app.use('/api',async(req,_res,next)=>{
    if(req.session.userId){const user=(await pool.query('SELECT * FROM users WHERE id=$1',[req.session.userId])).rows[0];if(user?.active&&user.auth_version===req.session.authVersion)req.user=user;else {delete req.session.userId;delete req.session.authVersion;}}
    next();
  });
  const authLimit=rateLimit({windowMs:15*60*1000,limit:loginLimit,skipSuccessfulRequests:true,keyGenerator:req=>`${req.route.path}:${ipKeyGenerator(req.ip)}`,standardHeaders:true,legacyHeaders:false,message:{error:'تلاش‌های زیادی انجام شده؛ کمی بعد دوباره امتحان کنید.',code:'RATE_LIMITED'}});
  registerPublicReport(app,pool,rateLimit({windowMs:60*1000,limit:120,standardHeaders:true,legacyHeaders:false,message:{error:'کمی بعد دوباره تلاش کنید.'}}));
  registerAccounts(app,pool,{authLimit,role,profileDTO});
  registerReportLinks(app,pool,childAccess);
  app.get('/api/children',async(req,res)=>res.json({profiles:(await listChildren(pool,req.user)).map(c=>profileDTO(c,req.user))}));
  app.post('/api/children',async(req,res)=>{
    role(req,['admin']);const validation=validateProfile(req.body);check(!validation.error,validation.error);
    const ownerId=req.body.ownerUserId?uuid(req.body.ownerUserId):null;
    if(ownerId)check((await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='user'",[ownerId])).rowCount,'کاربر معتبر انتخاب کنید.');
    const child=(await pool.query('INSERT INTO children(id,owner_user_id,profile) VALUES($1,$2,$3) RETURNING *',[randomUUID(),ownerId,validation.profile])).rows[0];res.status(201).json({profile:profileDTO(child,req.user)});
  });
  app.get('/api/children/:id',async(req,res)=>res.json({profile:profileDTO(await childAccess(pool,req.user,req.params.id),req.user)}));
  app.patch('/api/children/:id',async(req,res)=>{
    const child=await childAccess(pool,req.user,req.params.id,true),validation=validateProfile({...child.profile,...req.body});check(!validation.error,validation.error);
    check(!Object.hasOwn(req.body,'ownerUserId')||req.body.ownerUserId===child.owner_user_id,'اتصال پرونده از مسیر ایجاد حساب انجام می‌شود.');
    const updated=(await pool.query('UPDATE children SET profile=$1 WHERE id=$2 RETURNING *',[validation.profile,child.id])).rows[0];res.json({profile:profileDTO(updated,req.user)});
  });
  app.delete('/api/children/:id',async(req,res)=>{await childAccess(pool,req.user,req.params.id,true);throw new HttpError(409,'برای حفظ سوابق، حساب کاربر را غیرفعال کنید.','ARCHIVE_REQUIRED');});
  app.get('/api/bootstrap',async(req,res)=>{
    const children=await listChildren(pool,req.user),activeId=children.some(c=>c.id===req.query.childId)?req.query.childId:children[0]?.id||null;
    const rows=activeId?(await pool.query('SELECT * FROM game_sessions WHERE child_id=$1 AND result IS NOT NULL ORDER BY finished_at,id',[activeId])).rows:[];
    const difficulties=activeId?(await pool.query('SELECT game_id AS "gameId",variant,protocol AS "protocolVersion",mode,level,revision FROM difficulty WHERE child_id=$1',[activeId])).rows:[];
    res.json({user:publicUser(req.user),version:1,activeId,profiles:children.map(c=>profileDTO(c,req.user)),records:rows.map(row=>recordDTO(row,req.user)),difficulties});
  });
  const recordsFor=async(req)=>{await childAccess(pool,req.user,req.params.id);return (await pool.query('SELECT * FROM game_sessions WHERE child_id=$1 AND result IS NOT NULL ORDER BY finished_at,id',[req.params.id])).rows;};
  app.get('/api/children/:id/sessions',async(req,res)=>res.json({records:(await recordsFor(req)).map(r=>recordDTO(r,req.user))}));
  app.get('/api/children/:id/reports',async(req,res)=>res.json({profile:profileDTO(await childAccess(pool,req.user,req.params.id),req.user),records:(await recordsFor(req)).map(r=>recordDTO(r,req.user))}));
  app.get('/api/children/:id/assessment',async(req,res)=>{const rows=await recordsFor(req);res.json({steps:assessmentSteps({activeId:req.params.id,records:rows.map(r=>recordDTO(r,req.user))}).map(s=>({gameId:s.game.id,baseline:s.baseline,recommendation:s.recommendation}))});});
  app.get('/api/children/:id/difficulty',async(req,res)=>{await childAccess(pool,req.user,req.params.id);res.json({settings:(await pool.query('SELECT game_id AS "gameId",variant,protocol AS "protocolVersion",mode,level,revision FROM difficulty WHERE child_id=$1',[req.params.id])).rows});});
  app.patch('/api/children/:id/difficulty',async(req,res)=>{
    await childAccess(pool,req.user,req.params.id,true);const s=normalizeSettings(req.body);check(['fixed','adaptive'].includes(req.body.mode)&&['easy','medium','hard'].includes(req.body.level),'سطح و روش معتبر انتخاب کنید.');
    const row=(await pool.query(`INSERT INTO difficulty(child_id,game_id,variant,protocol,mode,level,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(child_id,game_id,variant,protocol) DO UPDATE SET mode=EXCLUDED.mode,level=EXCLUDED.level,revision=difficulty.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *`,[req.params.id,s.gameId,s.variant,s.protocolVersion,req.body.mode,req.body.level,req.user.id])).rows[0];res.json({setting:row});
  });
  app.post('/api/children/:id/sessions',async(req,res)=>{
    await childAccess(pool,req.user,req.params.id);const s=normalizeSettings(req.body),kind=req.body.kind;check(['baseline','training'].includes(kind),'نوع جلسه معتبر نیست.');
    const run=await transaction(pool,async db=>{
      if(kind==='training')check((await db.query("SELECT 1 FROM game_sessions WHERE child_id=$1 AND kind='baseline' AND result->>'gameId'=$2 AND result->>'variant'=$3 AND (result->>'protocolVersion')::int=$4 AND result IS NOT NULL",[req.params.id,s.gameId,s.variant,s.protocolVersion])).rowCount,'اول ارزیابی پایه را انجام دهید.',409,'BASELINE_REQUIRED');
      await db.query('INSERT INTO difficulty(child_id,game_id,variant,protocol) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[req.params.id,s.gameId,s.variant,s.protocolVersion]);
      const difficulty=(await db.query('SELECT * FROM difficulty WHERE child_id=$1 AND game_id=$2 AND variant=$3 AND protocol=$4 FOR UPDATE',[req.params.id,s.gameId,s.variant,s.protocolVersion])).rows[0];
      const settings={...s,level:kind==='baseline'?'easy':difficulty.level,seed:randomBytes(4).readUInt32BE(),practice:kind==='baseline',reviewEnabled:kind==='baseline'};
      return (await db.query('INSERT INTO game_sessions(id,child_id,actor_id,kind,settings,difficulty_revision) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),req.params.id,req.user.id,kind,settings,difficulty.revision])).rows[0];
    });res.status(201).json({id:run.id,settings:run.settings,kind:run.kind});
  });
  app.get('/api/children/:id/sessions/:sessionId',async(req,res)=>{await childAccess(pool,req.user,req.params.id);uuid(req.params.sessionId);const row=(await pool.query('SELECT * FROM game_sessions WHERE id=$1 AND child_id=$2',[req.params.sessionId,req.params.id])).rows[0];check(row,'جلسه پیدا نشد.',404);res.json({record:recordDTO(row,req.user)});});
  app.post('/api/children/:id/sessions/:sessionId/complete',async(req,res)=>{
    await childAccess(pool,req.user,req.params.id);uuid(req.params.sessionId);
    const row=await transaction(pool,async db=>{
      const run=(await db.query('SELECT * FROM game_sessions WHERE id=$1 AND child_id=$2 FOR UPDATE',[req.params.sessionId,req.params.id])).rows[0];check(run&&run.actor_id===req.user.id,'جلسهٔ متعلق به این حساب پیدا نشد.',404);
      if(run.result)return run;
      const result=canonicalResult(run,req.body.result),s=run.settings;
      await db.query(`UPDATE difficulty SET level=$1,revision=revision+1,updated_at=now() WHERE child_id=$2 AND game_id=$3 AND variant=$4 AND protocol=$5 AND mode='adaptive' AND revision=$6`,[recommendLevel(result).level,run.child_id,s.gameId,s.variant,s.protocolVersion,run.difficulty_revision]);
      return (await db.query('UPDATE game_sessions SET result=$1,finished_at=now() WHERE id=$2 RETURNING *',[result,run.id])).rows[0];
    });res.json({record:recordDTO(row,req.user)});
  });
  app.get('/api/children/:id/export',async(req,res)=>{const child=await childAccess(pool,req.user,req.params.id,true),records=(await recordsFor(req)).map(r=>recordDTO(r,req.user));res.attachment('havaas-profile.json').json({version:1,exportedAt:new Date().toISOString(),profile:profileDTO(child,req.user),records});});
  app.get('/api/children/:id/sessions/:sessionId/export',async(req,res)=>{
    await childAccess(pool,req.user,req.params.id,true);uuid(req.params.sessionId);const row=(await pool.query('SELECT * FROM game_sessions WHERE id=$1 AND child_id=$2 AND result IS NOT NULL',[req.params.sessionId,req.params.id])).rows[0];check(row,'جلسه پیدا نشد.',404);
    const lines=[['ردیف','هدف','پاسخ','درست','زمان پاسخ','زمان فعال','وسیله','دور','مرحله'],...(row.result.outcomes||[]).map(o=>[o.number,o.target,o.response,o.correct,o.reactionMs??'',o.atMs,o.item||'',o.round||'',o.phase??''])];
    res.type('text/csv; charset=utf-8').attachment('havaas-responses.csv').send('\uFEFF'+lines.map(line=>line.map(v=>'"'+(/^[=+@\-\t\r]/.test(String(v))?"'"+String(v):String(v)).replaceAll('"','""')+'"').join(',')).join('\r\n'));
  });
  registerImports(app,pool,{role,childAccess,profileDTO});
  app.use('/api',(_req,res)=>res.status(404).json({error:'مسیر پیدا نشد.',code:'NOT_FOUND'}));
  app.use('/assets',express.static(resolve(staticRoot,'assets')));app.use('/src',express.static(resolve(staticRoot,'src')));app.get(['/', '/index.html'],(_req,res)=>res.sendFile(resolve(staticRoot,'index.html')));
  app.use((error,_req,res,_next)=>{const status=error.status||(error.code==='23505'?409:(error.type==='entity.too.large')?413:500);if(status>=500)console.error('Request failed:',error.code||error.name);res.status(status).json({error:status>=500?'خطای سرور؛ دوباره تلاش کنید.':error.code==='23505'?'نام کاربری، ایمیل یا اتصال پرونده تکراری است.':error.message,code:error.code||'SERVER_ERROR'});});
  return app;
}
