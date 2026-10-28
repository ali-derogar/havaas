import {randomUUID} from 'node:crypto';
import {requireValue as check,token,digest,passwordHash,usernameOf,emailOf,uuid,isValidText} from './security.js';
import {validateProfile} from '../src/core/clients.js';

async function inspect(db,raw,lock=false){
 check(typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw),'لینک ثبت‌نام معتبر نیست.',404,'REGISTRATION_INVALID');
 const link=(await db.query(`SELECT l.* FROM registration_links l JOIN users u ON u.id=l.created_by WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() AND u.active AND u.role='admin' ${lock?'FOR UPDATE OF l':''}`,[digest(raw)])).rows[0];
 check(link,'لینک ثبت‌نام منقضی، لغو یا استفاده شده است.',404,'REGISTRATION_INVALID');return link;
}
export function registerPublicRegistration(app,pool,{authLimit,accountTransaction,creatorActive,signIn}){
 app.post('/api/public/registration/inspect',authLimit,async(req,res)=>{const link=await inspect(pool,req.body.token);res.json({expiresAt:link.expires_at});});
 app.post('/api/public/registration/complete',authLimit,async(req,res)=>{
  await inspect(pool,req.body.token);check(req.body.role===undefined||req.body.role==='user','لینک ثبت‌نام فقط برای مراجعه‌کننده است.',400);
  const username=usernameOf(req.body.username),validation=validateProfile({...req.body.profile,concerns:''});check(!validation.error,validation.error);
  const name=`${validation.profile.firstName} ${validation.profile.lastName}`;check(name.length<=120,'مجموع نام و نام خانوادگی باید حداکثر ۱۲۰ نویسه باشد.');
  const email=req.body.email?emailOf(req.body.email):null,hash=await passwordHash(req.body.password);
  const user=await accountTransaction(pool,async db=>{
   const link=await inspect(db,req.body.token,true);await creatorActive(db,link.created_by);const id=randomUUID();
   const u=(await db.query("INSERT INTO users(id,username,email,name,role,password_hash,last_login_at) VALUES($1,$2,$3,$4,'user',$5,now()) RETURNING *",[id,username,email,name,hash])).rows[0];
   await db.query('INSERT INTO children(id,owner_user_id,profile) VALUES($1,$2,$3)',[randomUUID(),id,validation.profile]);
   await db.query('UPDATE registration_links SET used_at=now(),user_id=$1 WHERE id=$2',[id,link.id]);return u;
  });res.status(201).json(await signIn(req,user));
 });
}
export function registerRegistrationAdmin(app,pool,{role,accountTransaction,creatorActive}){
 app.get('/api/registration-links',async(req,res)=>{role(req,['admin']);res.json({links:(await pool.query("SELECT l.id,l.label,l.created_at AS \"createdAt\",l.expires_at AS \"expiresAt\",l.used_at AS \"usedAt\",l.revoked_at AS \"revokedAt\",l.user_id AS \"userId\",u.name AS \"userName\",CASE WHEN l.used_at IS NOT NULL THEN 'used' WHEN l.revoked_at IS NOT NULL OR NOT c.active THEN 'revoked' WHEN l.expires_at<=now() THEN 'expired' ELSE 'open' END AS status FROM registration_links l LEFT JOIN users u ON u.id=l.user_id JOIN users c ON c.id=l.created_by ORDER BY l.created_at DESC,l.id")).rows});});
 app.post('/api/registration-links',async(req,res)=>{
  role(req,['admin']);const label=String(req.body.label||'دعوت مراجعه‌کننده').trim();check(isValidText(label)&&label.length>=1&&label.length<=100,'عنوان دعوت باید ۱ تا ۱۰۰ نویسه باشد.');
  const raw=token(),id=randomUUID(),expiresAt=new Date(Date.now()+48*60*60*1000);
  await accountTransaction(pool,async db=>{await creatorActive(db,req.user.id);await db.query('INSERT INTO registration_links(id,token_hash,label,created_by,expires_at) VALUES($1,$2,$3,$4,$5)',[id,digest(raw),label,req.user.id,expiresAt]);});
  res.status(201).json({id,expiresAt,url:`${process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`}/#register/${raw}`});
 });
 app.delete('/api/registration-links/:id',async(req,res)=>{
  role(req,['admin']);uuid(req.params.id);await accountTransaction(pool,async db=>{await creatorActive(db,req.user.id);check((await db.query('UPDATE registration_links SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND used_at IS NULL',[req.params.id])).rowCount,'دعوت قابل لغو پیدا نشد.',404);});res.json({ok:true});
 });
}
