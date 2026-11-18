import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.js';
import {migrate} from '../server/db.js';
import {testDatabase,seedAccounts} from './helpers/database.mjs';
import {normalizeSettings,canonicalResult} from '../server/domain.js';
import {playSession} from './helpers/play-session.mjs';
const source=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let db,seed,server,base,admin,user;
class Client{
 cookie='';csrf='';
 async call(path,{method='GET',body}={}){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:this.cookie,...(method!=='GET'?{'X-CSRF-Token':this.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];const text=await response.text(),data=JSON.parse(text);if(data.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data,bytes:Buffer.byteLength(text)};
 }
 async login(key){await this.call('/auth/session');assert.equal((await this.call('/auth/login',{method:'POST',body:{identifier:seed.users[key].username,password:seed.password}})).status,200);return this;}
}
const apiTest=(name,fn)=>test(name,{skip:!source},fn);
before(async()=>{if(!source)return;db=await testDatabase(source,`havaas_management_${process.pid}`);seed=await seedAccounts(db.pool);server=createApp({pool:db.pool,secret:'management-test-secret-at-least-thirty-two-characters',loginLimit:200}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;admin=await new Client().login('admin');user=await new Client().login('user');});
after(async()=>{if(!db)return;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.close();});
apiTest('management: both profile write routes reject stale and missing revisions without losing another editor’s note',async()=>{
 const path=`/users/${seed.users.user.id}`,original=(await admin.call(path)).data;
 assert.equal((await admin.call(path,{method:'PATCH',body:{profile:original.profile}})).status,428);
 const saved=await admin.call(path,{method:'PATCH',body:{expectedRevision:original.user.revision,expectedProfileRevision:original.profile.revision,profile:{...original.profile,concerns:'fresh confidential note'}}});assert.equal(saved.status,200);assert.ok(saved.data.profile.revision>original.profile.revision);
 const stale=await admin.call(path,{method:'PATCH',body:{expectedRevision:original.user.revision,expectedProfileRevision:original.profile.revision,profile:{...original.profile,school:'stale edit'}}});assert.equal(stale.status,409);assert.equal(stale.data.code,'EDIT_CONFLICT');assert.equal((await admin.call(path)).data.profile.concerns,'fresh confidential note');
 const childPath=`/children/${original.profile.id}`;
 assert.equal((await admin.call(childPath,{method:'PATCH',body:{school:'without revision'}})).status,428);
 assert.equal((await admin.call(childPath,{method:'PATCH',body:{expectedRevision:original.profile.revision,school:'old revision'}})).status,409);
 const partial=await admin.call(childPath,{method:'PATCH',body:{expectedRevision:saved.data.profile.revision,school:'safe partial edit'}});assert.equal(partial.status,200);assert.equal(partial.data.profile.concerns,'fresh confidential note');
 const newer=(await admin.call(path)).data;
 assert.equal((await admin.call(path,{method:'PATCH',body:{expectedRevision:newer.user.revision,expectedProfileRevision:saved.data.profile.revision,profile:saved.data.profile}})).status,409);
});
apiTest('management: no-op saves do not invalidate sessions, bump revisions, or add audit events; security changes do',async()=>{
 const path=`/users/${seed.users.user.id}`,current=(await admin.call(path)).data,count=Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count);
 const same=await admin.call(path,{method:'PATCH',body:{expectedRevision:current.user.revision,expectedProfileRevision:current.profile.revision,username:current.user.username,profile:current.profile}});assert.equal(same.status,200);assert.equal(same.data.user.revision,current.user.revision);assert.equal(same.data.profile.revision,current.profile.revision);assert.equal((await user.call('/bootstrap')).status,200);assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),count);
 const edit=await admin.call(path,{method:'PATCH',body:{expectedRevision:current.user.revision,expectedProfileRevision:current.profile.revision,profile:{...current.profile,school:'another safe school'}}});assert.equal(edit.status,200);assert.equal((await user.call('/bootstrap')).status,200);
 assert.equal((await admin.call(path,{method:'PATCH',body:{expectedRevision:edit.data.user.revision,active:false}})).status,200);assert.equal((await user.call('/bootstrap')).status,401);
 const disabled=(await admin.call(path)).data;assert.equal((await admin.call(path,{method:'PATCH',body:{expectedRevision:disabled.user.revision,active:true}})).status,200);await user.login('user');
});
apiTest('management: audit is atomic, no-op aware, filtered and admin-only, and contains names of fields without sensitive values',async()=>{
 const child=seed.children[0].id,events=await admin.call(`/admin/audit-events?userId=${seed.users.user.id}&pageSize=2`);assert.equal(events.status,200);assert.equal(events.data.events.length,2);assert.ok(events.data.pagination.total>=2);
 const all=await admin.call(`/admin/audit-events?userId=${seed.users.user.id}&pageSize=100`),text=JSON.stringify(all.data);for(const secret of ['fresh confidential note','safe partial edit','another safe school',seed.password,'scrypt$'])assert.ok(!text.includes(secret));assert.ok(all.data.events.some(e=>e.actorId===seed.users.admin.id&&e.changedFields.includes('profile.concerns')));
 assert.equal((await user.call('/admin/audit-events')).status,403);assert.equal((await new Client().call('/admin/audit-events')).status,401);
 const before=Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),c=(await admin.call(`/children/${child}`)).data.profile;
 assert.equal((await admin.call(`/children/${child}`,{method:'PATCH',body:{expectedRevision:c.revision,firstName:''}})).status,400);assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),before);
 assert.equal((await admin.call('/admin/audit-events?from=2026-02-31')).status,400);assert.equal((await admin.call('/admin/audit-events?pageSize=101')).status,400);
 const client=await db.pool.connect();try{await client.query('BEGIN');await client.query("UPDATE children SET profile=jsonb_set(profile,'{school}','\"rolled back\"') WHERE id=$1",[child]);await client.query('ROLLBACK');}finally{client.release();}assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),before);
});
apiTest('management: 5,000 full sessions produce bounded panels, independent selection, complete printing and private public references',async()=>{
 const childId=seed.children[1].id,settings={...normalizeSettings({gameId:'traffic'}),level:'easy',seed:42},result=canonicalResult({id:'perf',kind:'training',settings},playSession({kind:'training',settings})),ids=Array.from({length:5000},()=>randomUUID());
 await db.pool.query("INSERT INTO game_sessions(id,child_id,actor_id,kind,settings,difficulty_revision,result,finished_at) SELECT id,$2,$3,'training',$4,1,$5,now() FROM unnest($1::uuid[]) AS id",[ids,childId,seed.users.admin.id,settings,result]);
 const bootstrap=await admin.call(`/bootstrap?view=panel&childId=${childId}`);assert.equal(bootstrap.status,200);assert.equal(bootstrap.data.records.length,0);assert.equal(bootstrap.data.panelSummary.trainingTotal,5000);assert.ok(bootstrap.bytes<100*1024);assert.ok(!JSON.stringify(bootstrap.data).includes('outcomes'));
 const page=await admin.call(`/children/${childId}/reports?view=panel&page=2&recordId=${ids[0]}`);assert.equal(page.status,200);assert.equal(page.data.records.length,20);assert.equal(page.data.selected.id,ids[0]);assert.equal(page.data.pagination.total,5000);assert.equal(page.data.trend.length,20);assert.ok(page.bytes<100*1024);assert.ok(!JSON.stringify(page.data).includes('outcomes'));
 const full=await admin.call(`/children/${childId}/sessions/${ids[0]}`);assert.equal(full.data.record.result.outcomes.length,150);
 const print=await admin.call(`/children/${childId}/reports?view=print`);assert.equal(print.data.records.length,5000);assert.ok(!JSON.stringify(print.data).includes('outcomes'));
 const link=await admin.call(`/children/${childId}/report-links`,{method:'POST',body:{label:'bounded report'}}),guest=new Client();await guest.call('/auth/session');const token=link.data.url.split('/').at(-1);
 const family=await guest.call('/public/report',{method:'POST',body:{view:'panel',token,kind:'',page:3}});assert.equal(family.status,200);assert.equal(family.data.records.length,20);assert.ok(family.bytes<100*1024);const serialized=JSON.stringify(family.data);for(const secret of [childId,seed.users.otherUser.id,ids[0],'outcomes','settingsSnapshot','actorId','clinical-secret'])assert.ok(!serialized.includes(secret),secret);
 const ref=family.data.selected.ref;assert.equal((await guest.call('/public/report',{method:'POST',body:{view:'panel',token,recordRef:ref,page:1}})).data.selected.ref,ref);
 const foreign=(await db.pool.query('SELECT report_ref FROM game_sessions WHERE id=$1',[ids[0]])).rows[0].report_ref,otherLink=await user.call(`/children/${seed.children[0].id}/report-links`,{method:'POST',body:{label:'other child'}});
 assert.equal((await guest.call('/public/report',{method:'POST',body:{view:'panel',token:otherLink.data.url.split('/').at(-1),recordRef:foreign}})).status,404);
 await migrate(db.pool);assert.equal(Number((await db.pool.query('SELECT count(*) FROM game_sessions')).rows[0].count),5000);
});
apiTest('management: an absent profile uses revision zero and cannot overwrite a concurrently created profile',async()=>{
 const id=randomUUID(),name='مراجع قدیمی';await db.pool.query("INSERT INTO users(id,username,name,role,pending,active) VALUES($1,$2,$3,'user',true,false)",[id,'missing-'+id,name]);
 const initial=(await admin.call(`/users/${id}`)).data;assert.equal(initial.profile,null);
 const profile={firstName:'تازه',lastName:'ثبت‌شده',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسه',concerns:'concurrent profile note'};
 const created=await admin.call('/children',{method:'POST',body:{...profile,ownerUserId:id}});assert.equal(created.status,201);
 const stale=await admin.call(`/users/${id}`,{method:'PATCH',body:{expectedRevision:initial.user.revision,expectedProfileRevision:0,profile:{...profile,concerns:'stale absent form'}}});assert.equal(stale.status,409);assert.equal((await admin.call(`/users/${id}`)).data.profile.concerns,'concurrent profile note');
});
apiTest('management: accepting a token is attributed to its authenticated holder rather than the inviting administrator',async()=>{
 const invited=await admin.call('/users',{method:'POST',body:{username:'audit-invite-'+randomUUID(),name:'مدیر تازه',role:'admin',method:'invite'}});assert.equal(invited.status,201);
 const visitor=new Client();await visitor.call('/auth/session');const accepted=await visitor.call('/invitations/accept',{method:'POST',body:{token:invited.data.url.split('/').at(-1),password:seed.password}});assert.equal(accepted.status,200);
 const events=(await admin.call(`/admin/audit-events?userId=${invited.data.user.id}&pageSize=100`)).data.events;
 assert.ok(events.some(event=>event.action==='invitations.updated'&&event.actorId===invited.data.user.id));assert.ok(events.some(event=>event.action==='users.created'&&event.actorId===seed.users.admin.id));
 const link=await admin.call('/registration-links',{method:'POST',body:{label:'self-registration audit'}}),newcomer=new Client();await newcomer.call('/auth/session');
 const signup=await newcomer.call('/public/registration/complete',{method:'POST',body:{token:link.data.url.split('/').at(-1),username:'audit-signup-'+randomUUID(),password:seed.password,profile:{firstName:'تازه',lastName:'ثبت‌نام',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسه'}}});assert.equal(signup.status,201);
 const own=(await admin.call(`/admin/audit-events?userId=${signup.data.user.id}&pageSize=100`)).data.events;assert.ok(own.some(event=>event.action==='registration_links.updated'&&event.actorId===signup.data.user.id));
});

apiTest('management: a write returns its own profile snapshot even when another editor commits immediately afterwards',async()=>{
 const path=`/users/${seed.users.user.id}`,before=(await admin.call(path)).data,wrapped=new Map();let injected=false;
 const acquire=client=>{
  if(wrapped.has(client))return;const query=client.query;wrapped.set(client,query);
  client.query=async function(...args){
   const result=await query.apply(this,args);
   if(args[0]==='COMMIT'&&!injected){injected=true;await db.pool.query("UPDATE children SET profile=jsonb_set(profile,'{concerns}',to_jsonb($1::text)) WHERE id=$2",['new concurrent note',before.profile.id]);}
   return result;
  };
 };
 db.pool.on('acquire',acquire);
 let saved;
 try{saved=await admin.call(path,{method:'PATCH',body:{expectedRevision:before.user.revision,expectedProfileRevision:before.profile.revision,profile:{...before.profile,school:'atomic response school'}}});}
 finally{db.pool.off('acquire',acquire);for(const [client,query] of wrapped)client.query=query;}
 assert.equal(injected,true);assert.equal(saved.status,200);assert.equal(saved.data.profile.concerns,before.profile.concerns);assert.equal(saved.data.profile.revision,before.profile.revision+1);
 const latest=(await admin.call(path)).data;assert.equal(latest.profile.concerns,'new concurrent note');assert.equal(latest.profile.revision,saved.data.profile.revision+1);
 assert.equal((await admin.call(path,{method:'PATCH',body:{expectedRevision:saved.data.user.revision,expectedProfileRevision:saved.data.profile.revision,profile:saved.data.profile}})).status,409);
});

apiTest('management: creating an account linked to an existing profile returns the final account revision',async()=>{
 const profile={firstName:'نام',lastName:'پرونده',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسه',concerns:''};
 const child=await admin.call('/children',{method:'POST',body:profile});assert.equal(child.status,201);
 const created=await admin.call('/users',{method:'POST',body:{username:'linked-'+randomUUID(),name:'نام اولیه حساب',role:'user',method:'direct',password:seed.password,childId:child.data.profile.id}});assert.equal(created.status,201);
 const latest=(await admin.call(`/users/${created.data.user.id}`)).data;assert.equal(created.data.user.name,'نام پرونده');assert.equal(created.data.user.revision,latest.user.revision);
 assert.equal((await admin.call(`/users/${created.data.user.id}`,{method:'PATCH',body:{expectedRevision:created.data.user.revision,name:created.data.user.name}})).status,200);
});

apiTest('management: legacy profile creation synchronizes its owner name and rolls back an invalid combined name',async()=>{
 const id=randomUUID();await db.pool.query("INSERT INTO users(id,username,name,role,pending,active) VALUES($1,$2,$3,'user',true,false)",[id,'legacy-owner-'+id,'نام حساب قدیمی']);
 const original=(await admin.call(`/users/${id}`)).data.user,profile={firstName:'مالک',lastName:'تازه',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسه',concerns:'private owner note'};
 assert.equal((await admin.call('/children',{method:'POST',body:{...profile,ownerUserId:id}})).status,201);
 const latest=(await admin.call(`/users/${id}`)).data;assert.equal(latest.user.name,'مالک تازه');assert.equal(latest.user.revision,original.revision+1);assert.equal(latest.profile.concerns,'private owner note');
 const other=randomUUID();await db.pool.query("INSERT INTO users(id,username,name,role,pending,active) VALUES($1,$2,$3,'user',true,false)",[other,'invalid-owner-'+other,'نام معتبر']);
 const count=Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count);
 assert.equal((await admin.call('/children',{method:'POST',body:{...profile,firstName:'ا'.repeat(80),lastName:'ب'.repeat(80),ownerUserId:other}})).status,400);
 const unchanged=(await admin.call(`/users/${other}`)).data;assert.equal(unchanged.profile,null);assert.equal(unchanged.user.name,'نام معتبر');assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),count);
});

apiTest('management: audit date filters reject year zero without a database error and accept year one',async()=>{
 for(const key of ['from','to']){const invalid=await admin.call(`/admin/audit-events?${key}=0000-01-01`);assert.equal(invalid.status,400);assert.equal(invalid.data.code,'REQUEST_ERROR');}
 assert.equal((await admin.call('/admin/audit-events?from=0001-01-01')).status,200);
});
