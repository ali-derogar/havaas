import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { requireValue as check, HttpError, token, digest, passwordHash, verifyPassword, emailOf, usernameOf, uuid, publicUser, isValidText, textOf } from './security.js';
import { validateProfile } from '../src/core/clients.js';
import {registerPublicRegistration,registerRegistrationAdmin} from './registration.js';
import {registerDashboard} from './dashboard.js';

const save=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
async function signIn(req,user){await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=user.id;req.session.authVersion=user.auth_version;req.session.csrf=token();await save(req);return {user:publicUser(user),csrfToken:req.session.csrf};}
const origin=req=>process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`;
const nameOf=value=>{const message='نام باید بین ۲ تا ۱۲۰ نویسهٔ معتبر باشد.',name=textOf(value,message);check(name.length>=2&&name.length<=120,message);return name;};
const userStats=`SELECT u.*,c.id AS "childId",(SELECT count(*)::int FROM game_sessions s WHERE s.child_id=c.id AND s.result IS NOT NULL) AS "sessionCount",(SELECT max(finished_at) FROM game_sessions s WHERE s.child_id=c.id) AS "lastPlayedAt" FROM users u LEFT JOIN children c ON c.owner_user_id=u.id`;
const memberDTO=u=>({...publicUser(u),childId:u.childId,sessionCount:u.sessionCount,lastPlayedAt:u.lastPlayedAt});
async function creatorActive(db,id){check((await db.query("SELECT 1 FROM users WHERE id=$1 AND role='admin' AND active=true AND pending=false FOR SHARE",[id])).rowCount,'حساب مدیر دیگر فعال نیست.',403);}
// Keep account status and invitation locks in one order across all administrators.
export const accountTransaction=(pool,fn)=>transaction(pool,async db=>{await db.query('SELECT pg_advisory_xact_lock(82004174)');return fn(db);});
async function issue(db,req,user,purpose){
 const raw=token(),expiresAt=new Date(Date.now()+(purpose==='reset'?30*60*1000:48*60*60*1000));
 await db.query('UPDATE invitations SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);
 await db.query('INSERT INTO invitations(id,token_hash,role,purpose,created_by,user_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),digest(raw),user.role,purpose,req.user.id,user.id,expiresAt]);
 return {url:`${origin(req)}/#invite/${raw}`,expiresAt};
}
export function registerAccounts(app,pool,{authLimit,role,profileDTO}){
 registerPublicRegistration(app,pool,{authLimit,accountTransaction,creatorActive,signIn});
 app.get('/api/auth/session',async(req,res)=>{await save(req);res.json({user:req.user?publicUser(req.user):null,csrfToken:req.session.csrf});});
 app.post('/api/auth/login',authLimit,async(req,res)=>{
  const value=req.body.identifier||req.body.username||req.body.email||'';check(typeof value==='string'&&isValidText(value)&&value.length<=254,'نام کاربری یا رمز درست نیست.',401,'INVALID_CREDENTIALS');
  const identifier=value.trim().toLowerCase();
  const user=(await pool.query('SELECT * FROM users WHERE lower(username)=$1 OR (legacy_email_login AND lower(email)=$1)',[identifier])).rows[0];
  const verified=await verifyPassword(req.body.password,user?.password_hash||'scrypt$131072$8$1$00000000000000000000000000000000$'+'00'.repeat(64));
  check(user?.active&&!user.pending&&verified,'نام کاربری یا رمز درست نیست.',401,'INVALID_CREDENTIALS');
  const fresh=(await pool.query('UPDATE users SET last_login_at=now() WHERE id=$1 AND active=true AND auth_version=$2 RETURNING *',[user.id,user.auth_version])).rows[0];check(fresh,'حساب تغییر کرده است؛ دوباره وارد شوید.',401);
  res.json(await signIn(req,fresh));
 });
 app.post('/api/auth/logout',async(req,res)=>{await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie('havaas.sid',{path:'/'});res.json({ok:true});});
 const inspect=async(db,raw,lock=false)=>{check(typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw),'لینک معتبر نیست.',400,'INVITATION_INVALID');const invitation=(await db.query(`SELECT * FROM invitations WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() ${lock?'FOR UPDATE':''}`,[digest(raw)])).rows[0];check(invitation?.user_id,'لینک نامعتبر، استفاده‌شده یا منقضی است.',400,'INVITATION_INVALID');return invitation;};
 app.post('/api/invitations/inspect',authLimit,async(req,res)=>{const i=await inspect(pool,req.body.token),u=(await pool.query('SELECT * FROM users WHERE id=$1',[i.user_id])).rows[0];res.json({username:u.username,name:u.name,role:u.role,purpose:i.purpose});});
 app.post('/api/invitations/accept',authLimit,async(req,res)=>{
  await inspect(pool,req.body.token);const hash=await passwordHash(req.body.password);
  const user=await accountTransaction(pool,async db=>{const i=await inspect(db,req.body.token,true);await creatorActive(db,i.created_by);const u=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[i.user_id])).rows[0];
   check(u&&u.role===i.role&&(i.purpose==='invite'?u.pending:u.active&&!u.pending),'این حساب امکان پذیرش لینک را ندارد.',403);
   const updated=(await db.query('UPDATE users SET password_hash=$1,pending=false,active=true,password_change_required=false,auth_version=auth_version+1,last_login_at=now() WHERE id=$2 RETURNING *',[hash,u.id])).rows[0];
   await db.query('UPDATE invitations SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[u.id]);return updated;
  });res.json(await signIn(req,user));
 });
 app.use('/api',(req,_res,next)=>req.user?next():next(new HttpError(401,'ابتدا وارد حساب شوید.','AUTH_REQUIRED')));
 app.post('/api/auth/change-password',authLimit,async(req,res)=>{
  check(await verifyPassword(req.body.currentPassword,req.user.password_hash),'رمز فعلی درست نیست.');check(req.body.password!==req.body.currentPassword,'رمز جدید باید با رمز فعلی متفاوت باشد.');
  const hash=await passwordHash(req.body.password),u=await accountTransaction(pool,async db=>{
   const updated=(await db.query('UPDATE users SET password_hash=$1,password_change_required=false,auth_version=auth_version+1 WHERE id=$2 AND auth_version=$3 AND active=true RETURNING *',[hash,req.user.id,req.user.auth_version])).rows[0];check(updated,'حساب تغییر کرده است؛ دوباره وارد شوید.',401);
   await db.query('UPDATE invitations SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[updated.id]);return updated;
  });req.session.authVersion=u.auth_version;await save(req);res.json({ok:true,user:publicUser(u)});
 });
 app.use('/api',(req,_res,next)=>req.user.password_change_required?next(new HttpError(403,'ابتدا رمز موقت را تغییر دهید.','PASSWORD_CHANGE_REQUIRED')):next());
 registerRegistrationAdmin(app,pool,{role,accountTransaction,creatorActive});registerDashboard(app,pool,role);
 app.get('/api/users',async(req,res)=>{
  role(req,['admin']);if(!Object.keys(req.query).length)return res.json({users:(await pool.query(userStats+' ORDER BY u.created_at,u.id')).rows.map(memberDTO)});
  const page=Number(req.query.page||1),pageSize=Number(req.query.pageSize||20),search=String(req.query.search||'').trim().toLowerCase(),status=req.query.status||'',accountRole=req.query.role||'',sort=req.query.sort||'newest';
  check(Number.isInteger(page)&&page>=1&&Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=100&&search.length<=150&&isValidText(search)&&['','active','disabled','pending'].includes(status)&&['','user','admin'].includes(accountRole)&&['newest','name','activity'].includes(sort),'فیلتر کاربران معتبر نیست.');
  const filter="WHERE ($1='' OR strpos(lower(name||' '||username),$1)>0) AND ($2='' OR role=$2) AND ($3='' OR CASE WHEN pending THEN 'pending' WHEN active THEN 'active' ELSE 'disabled' END=$3)",params=[search,accountRole,status],order={newest:'created_at DESC,id',name:'name,id',activity:'"lastPlayedAt" DESC NULLS LAST,id'}[sort];
  const total=Number((await pool.query(`WITH members AS (${userStats}) SELECT count(*) FROM members ${filter}`,params)).rows[0].count),pages=Math.max(1,Math.ceil(total/pageSize)),effectivePage=Math.min(page,pages);
  const rows=(await pool.query(`WITH members AS (${userStats}) SELECT * FROM members ${filter} ORDER BY ${order} LIMIT $4 OFFSET $5`,[...params,pageSize,(effectivePage-1)*pageSize])).rows;
  res.json({users:rows.map(memberDTO),pagination:{page:effectivePage,pageSize,total,pages}});
 });
 app.get('/api/users/:id',async(req,res)=>{role(req,['admin']);uuid(req.params.id);const u=(await pool.query(userStats+' WHERE u.id=$1',[req.params.id])).rows[0];check(u,'حساب پیدا نشد.',404);const child=u.childId?(await pool.query('SELECT * FROM children WHERE id=$1',[u.childId])).rows[0]:null;res.json({user:memberDTO(u),profile:child?profileDTO(child,req.user):null});});
 app.post('/api/users',async(req,res)=>{
  role(req,['admin']);const username=usernameOf(req.body.username),name=nameOf(req.body.name||`${req.body.profile?.firstName||''} ${req.body.profile?.lastName||''}`),accountRole=req.body.role;check(['admin','user'].includes(accountRole),'نقش معتبر نیست.');const invite=req.body.method==='invite';check(invite||req.body.method==='direct','روش ایجاد حساب معتبر نیست.');
  const hash=invite?null:await passwordHash(req.body.password),email=req.body.email?emailOf(req.body.email):null;
  const result=await accountTransaction(pool,async db=>{await creatorActive(db,req.user.id);const id=randomUUID();
   const u=(await db.query('INSERT INTO users(id,username,email,name,role,password_hash,active,pending,password_change_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[id,username,email,name,accountRole,hash,!invite,invite,!invite])).rows[0];let child=null;
   if(accountRole==='user'){
    if(req.body.childId){uuid(req.body.childId);child=(await db.query('SELECT * FROM children WHERE id=$1 FOR UPDATE',[req.body.childId])).rows[0];check(child&&!child.owner_user_id,'اطلاعات بدون مالک انتخاب کنید.',409);child=(await db.query('UPDATE children SET owner_user_id=$1 WHERE id=$2 RETURNING *',[id,child.id])).rows[0];}
    else {const validation=validateProfile(req.body.profile||{});check(!validation.error,validation.error);child=(await db.query('INSERT INTO children(id,owner_user_id,profile) VALUES($1,$2,$3) RETURNING *',[randomUUID(),id,validation.profile])).rows[0];}
   }
   if(child){u.name=nameOf(`${child.profile.firstName} ${child.profile.lastName}`);await db.query('UPDATE users SET name=$1 WHERE id=$2',[u.name,u.id]);}
   return {user:publicUser(u),profile:child?profileDTO(child,req.user):null,...(invite?await issue(db,req,u,'invite'):{})};
  });res.status(201).json(result);
 });
 app.patch('/api/users/:id',async(req,res)=>{
  role(req,['admin']);uuid(req.params.id);const changes={};if(req.body.name!==undefined)changes.name=nameOf(req.body.name);if(req.body.username!==undefined)changes.username=usernameOf(req.body.username);if(req.body.active!==undefined){check(typeof req.body.active==='boolean','وضعیت معتبر نیست.');changes.active=req.body.active;}
  const u=await accountTransaction(pool,async db=>{await creatorActive(db,req.user.id);const current=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];check(current,'حساب پیدا نشد.',404);check(req.body.role===undefined||req.body.role===current.role,'نقش حساب پس از ایجاد تغییر نمی‌کند.');check(!(current.pending&&changes.active===true),'حساب در انتظار دعوت باید لینک را بپذیرد.');
   if(current.role==='user'&&changes.active===true)check((await db.query('SELECT 1 FROM children WHERE owner_user_id=$1',[current.id])).rowCount,'پیش از فعال‌کردن کاربر، اطلاعات اختصاصی او را متصل کنید.',409);
   if(current.role==='admin'&&current.active&&changes.active===false)check((await db.query("SELECT 1 FROM users WHERE role='admin' AND active=true AND id<>$1",[current.id])).rowCount,'آخرین ادمین فعال را نمی‌توان غیرفعال کرد.',409,'LAST_ADMIN');
   if(req.body.profile!==undefined){
    check(current.role==='user'&&req.body.profile&&typeof req.body.profile==='object'&&!Array.isArray(req.body.profile),'مشخصات مراجعه‌کننده معتبر نیست.');
    const existing=(await db.query('SELECT * FROM children WHERE owner_user_id=$1 FOR UPDATE',[current.id])).rows[0],validation=validateProfile({...existing?.profile,...req.body.profile});check(!validation.error,validation.error);changes.name=nameOf(`${validation.profile.firstName} ${validation.profile.lastName}`);
    if(existing)await db.query('UPDATE children SET profile=$1 WHERE id=$2',[validation.profile,existing.id]);else await db.query('INSERT INTO children(id,owner_user_id,profile) VALUES($1,$2,$3)',[randomUUID(),current.id,validation.profile]);
   }
   return (await db.query('UPDATE users SET name=COALESCE($1,name),username=COALESCE($2,username),active=COALESCE($3,active),auth_version=auth_version+1 WHERE id=$4 RETURNING *',[changes.name??null,changes.username??null,changes.active??null,current.id])).rows[0];
  });if(u.id===req.user.id&&u.active){req.session.authVersion=u.auth_version;await save(req);}res.json({user:publicUser(u)});
 });
 app.post('/api/invitations',async(req,res)=>{role(req,['admin']);uuid(req.body.userId);const result=await accountTransaction(pool,async db=>{await creatorActive(db,req.user.id);const u=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.body.userId])).rows[0];check(u,'حساب پیدا نشد.',404);const purpose=req.body.purpose==='invite'?'invite':'reset';check(purpose==='invite'?u.pending:u.active&&!u.pending,'وضعیت حساب با نوع لینک همخوان نیست.');return issue(db,req,u,purpose);});res.status(201).json(result);});
}
