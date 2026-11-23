import {t as uiText} from '../src/i18n.js';
import {transaction} from './db.js';
import {HttpError,requireValue as check,uuid} from './security.js';

export function guardRevision(expected,actual,current,allowZero=false){
 if(!Number.isSafeInteger(expected)||expected<(allowZero?0:1))throw new HttpError(428,uiText('نسخهٔ فرم قدیمی است؛ برنامه را به‌روزرسانی کنید.'),'CLIENT_UPDATE_REQUIRED');
 if(expected!==actual){const error=new HttpError(409,uiText('این اطلاعات در جای دیگری تغییر کرده است. پیش‌نویس شما حفظ شد.'),'EDIT_CONFLICT');error.details={current};throw error;}
}
export async function managedTransaction(pool,req,fn){
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(82004174)');
  if(req.user?.id)await db.query("SELECT set_config('havaas.actor_id',$1,true)",[req.user.id]);
  return fn(db);
 });
}
export function pagination(input={}){
 const page=Number(input.page||1),pageSize=Number(input.pageSize||20);
 check(Number.isSafeInteger(page)&&page>0&&Number.isSafeInteger(pageSize)&&pageSize>0&&pageSize<=100,uiText('صفحه و تعداد ردیف معتبر انتخاب کنید.'));
 return {page,pageSize};
}
export function registerAudit(app,pool,role){
 app.get('/api/admin/audit-events',async(req,res)=>{
  role(req,['admin']);const {page,pageSize}=pagination(req.query),params=[];
  const where=[];
  for(const [key,column] of [['userId','target_user_id'],['actorId','actor_id'],['childId','child_id']])if(req.query[key]){params.push(uuid(req.query[key]));where.push(`a.${column}=$${params.length}`);}
  if(req.query.action){check(/^[a-z_]+\.(created|updated|completed)$/.test(req.query.action),uiText('نوع رویداد معتبر نیست.'));params.push(req.query.action);where.push(`a.action=$${params.length}`);}
  for(const [key,operator] of [['from','>='],['to','<']])if(req.query[key]){
   const value=req.query[key];check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>=1&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value,uiText('تاریخ معتبر انتخاب کنید.'));
   params.push(value);where.push(`a.created_at ${operator} (($${params.length}::date${key==='to'?"+1":''})::timestamp AT TIME ZONE 'Asia/Tehran')`);
  }
  const filter=where.length?'WHERE '+where.join(' AND '):'',total=Number((await pool.query(`SELECT count(*) FROM audit_events a ${filter}`,params)).rows[0].count),pages=Math.max(1,Math.ceil(total/pageSize)),effective=Math.min(page,pages);
  const rows=(await pool.query(`SELECT a.id,a.actor_id AS "actorId",u.name AS "actorName",a.target_user_id AS "userId",t.name AS "targetName",a.action,a.changed_fields AS "changedFields",a.metadata,a.created_at AS "createdAt" FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN users t ON t.id=a.target_user_id ${filter} ORDER BY a.created_at DESC,a.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,pageSize,(effective-1)*pageSize])).rows;
  res.json({events:rows,pagination:{page:effective,pageSize,total,pages}});
 });
}
