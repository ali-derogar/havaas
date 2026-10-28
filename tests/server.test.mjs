import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createApp } from '../server/app.js';
import { testDatabase,seedAccounts,testPassword } from './helpers/database.mjs';
import { playSession } from './helpers/play-session.mjs';
import { GAMES } from '../src/config.js';
const source=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let db,server,base,seed,admin,user,otherUser;
class Client{
 constructor(){this.cookie='';this.csrf=null;}
 async call(path,{method='GET',body,headers={}}={}){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:this.cookie,...(method!=='GET'?{'X-CSRF-Token':this.csrf||''}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  if(data.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data,headers:response.headers};
 }
 async login(user,password=testPassword){await this.call('/auth/session');const r=await this.call('/auth/login',{method:'POST',body:{identifier:user.username,password}});assert.equal(r.status,200);return this;}
}
const apiTest=(name,fn)=>test(name,{skip:!source},fn);
before(async()=>{
 if(!source)return;db=await testDatabase(source,`havaas_test_${process.pid}`);seed=await seedAccounts(db.pool);
 server=createApp({pool:db.pool,loginLimit:200,secret:'test-session-secret-at-least-thirty-two-characters'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
 admin=await new Client().login(seed.users.admin);user=await new Client().login(seed.users.user);otherUser=await new Client().login(seed.users.otherUser);
});
after(async()=>{if(!source)return;await new Promise(r=>{server.close(r);server.closeAllConnections();});await db.close();});
const start=async(client,gameId,kind='baseline',extra={})=>{const r=await client.call(`/children/${seed.children[0].id}/sessions`,{method:'POST',body:{gameId,kind,...extra}});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;};
const complete=(client,run,payload=playSession(run))=>client.call(`/children/${seed.children[0].id}/sessions/${run.id}/complete`,{method:'POST',body:{result:payload}});
apiTest('server: roles protect lists, clinical notes, direct IDs and raw exports',async()=>{
 const own=await user.call('/bootstrap');assert.equal(own.status,200);assert.equal(own.data.profiles.length,1);assert.equal(own.data.profiles[0].concerns,undefined);assert.ok(!JSON.stringify(own.data).includes('clinical-secret'));
 for(const path of [`/children/${seed.children[1].id}`,`/children/${seed.children[1].id}/sessions`,`/children/${seed.children[1].id}/reports`,`/children/${seed.children[1].id}/assessment`,`/children/${seed.children[1].id}/difficulty`])assert.equal((await user.call(path)).status,404);
 assert.equal((await user.call(`/children/${seed.children[1].id}`)).status,404);assert.equal((await user.call(`/children/${seed.children[0].id}/export`)).status,403);
 assert.equal((await user.call(`/children/${seed.children[0].id}`,{method:'PATCH',body:{concerns:'changed'}})).status,403);
 assert.equal((await user.call('/invitations',{method:'POST',body:{email:'bad@example.test',role:'admin'}})).status,403);
 assert.equal((await new Client().call('/children')).status,401);
});
apiTest('server: CSRF and foreign origins are rejected',async()=>{
 assert.equal((await user.call('/auth/logout',{method:'POST',headers:{'X-CSRF-Token':'wrong'}})).status,403);
 assert.equal((await user.call('/auth/logout',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
});
apiTest('server: all seven games save canonical metrics and resume assessment from another device',async()=>{
 for(const game of GAMES){const run=await start(admin,game.id);const payload=playSession(run);payload.score=99999;payload.hits=99999;const r=await complete(admin,run,payload);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.record.result.score,r.data.record.result.maxScore);assert.notEqual(r.data.record.result.hits,99999);assert.equal(r.data.record.actorId,seed.users.admin.id);assert.equal(r.data.record.result.settingsSnapshot.seed,run.settings.seed);assert.equal(r.data.record.result.stimulusVersion,run.settings.stimulusVersion);}
 const assessment=await user.call(`/children/${seed.children[0].id}/assessment`);assert.equal(assessment.data.steps.filter(s=>s.baseline).length,7);
 const result=await user.call(`/children/${seed.children[0].id}/reports`);assert.ok(result.data.records.every(r=>r.result.outcomes===undefined));assert.ok(!JSON.stringify(result.data).includes('clinical-secret'));
 const secondDevice=await new Client().login(seed.users.user);assert.equal((await secondDevice.call(`/children/${seed.children[0].id}/assessment`)).data.steps.filter(s=>s.baseline).length,7);
});
apiTest('server: fixed levels and snapshots survive changes during a session',async()=>{
 const child=seed.children[0].id;
 let r=await admin.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'hard'}});assert.equal(r.status,200);
 const run=await start(user,'traffic','training');assert.equal(run.settings.level,'hard');
 await admin.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'easy'}});
 const saved=await complete(user,run);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.record.result.level,'hard');
 assert.equal((await start(user,'traffic','training')).settings.level,'easy');
 assert.equal((await user.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'hard'}})).status,403);
});
apiTest('server: retries and simultaneous sessions update adaptive difficulty only once',async()=>{
 const child=seed.children[0].id;await admin.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'adaptive',level:'easy'}});
 const a=await start(user,'traffic','training'),b=await start(user,'traffic','training');
 const replies=await Promise.all([complete(user,a),complete(user,a),complete(user,b)]);assert.ok(replies.every(r=>r.status===200));
 const state=(await user.call(`/children/${child}/difficulty`)).data.settings.find(s=>s.gameId==='traffic');assert.equal(state.level,'medium');
 const count=await db.pool.query('SELECT count(*)::int AS n FROM game_sessions WHERE id IN ($1,$2) AND result IS NOT NULL',[a.id,b.id]);assert.equal(count.rows[0].n,2);
 assert.equal((await complete(otherUser,a)).status,404);
});
apiTest('server: invalid response traces do not save or change difficulty',async()=>{
 const run=await start(user,'hunt','training'),payload=playSession(run);payload.outcomes.pop();assert.equal((await complete(user,run,payload)).status,400);
 assert.equal((await db.pool.query('SELECT result FROM game_sessions WHERE id=$1',[run.id])).rows[0].result,null);
 const fixed=await start(user,'search','baseline',{targetCount:2,material:'letters',layout:'scattered'});assert.equal((await complete(user,fixed)).status,200);
 const timeout=await start(user,'space','training');assert.equal((await complete(user,timeout,playSession(timeout,{timeout:true}))).status,200);
});
apiTest('server: impossible timing is rolled back without saving results or increasing levels',async()=>{
 const child=seed.children[0].id;
 for(const gameId of ['traffic','search','space']){
  const run=await start(user,gameId,'training'),before=(await user.call(`/children/${child}/difficulty`)).data.settings,payload=playSession(run);
  if(gameId==='space')payload.outcomes.find(o=>o.reactionMs>0).reactionMs=-1;
  else {payload.durationMs=1;for(const o of payload.outcomes){o.atMs=1;if(o.response)o.reactionMs=0;}}
  assert.equal((await complete(user,run,payload)).status,400);
  assert.equal((await db.pool.query('SELECT result FROM game_sessions WHERE id=$1',[run.id])).rows[0].result,null);
  assert.deepEqual((await user.call(`/children/${child}/difficulty`)).data.settings,before);
  assert.equal((await complete(user,run)).status,200);
 }
});
apiTest('server: invitation links reserve usernames, are one-use, expire and cannot take over accounts',async()=>{
 const profile={firstName:'تازه',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'};
 const invite=await admin.call('/users',{method:'POST',body:{username:'new-user',name:'کاربر تازه',role:'user',method:'invite',profile}});assert.equal(invite.status,201,JSON.stringify(invite.data));const raw=invite.data.url.split('/').at(-1),guest=new Client();await guest.call('/auth/session');
 const stored=(await db.pool.query('SELECT * FROM invitations WHERE user_id=$1',[invite.data.user.id])).rows[0];assert.notEqual(stored.token_hash,raw);assert.equal(Math.round((new Date(stored.expires_at)-new Date(stored.created_at))/3600000),48);
 assert.equal((await guest.call('/auth/login',{method:'POST',body:{identifier:'new-user',password:testPassword}})).status,401);
 const accepted=await guest.call('/invitations/accept',{method:'POST',body:{token:raw,password:testPassword}});assert.equal(accepted.status,200);assert.equal((await guest.call('/bootstrap')).data.profiles.length,1);
 assert.equal((await guest.call('/invitations/accept',{method:'POST',body:{token:raw,password:testPassword}})).status,400);
 assert.equal((await admin.call('/users',{method:'POST',body:{username:'NEW-USER',name:'تکراری',role:'user',method:'invite',profile}})).status,409);
 assert.equal((await user.call('/invitations',{method:'POST',body:{userId:seed.users.otherUser.id,purpose:'reset'}})).status,403);
 const expired=await admin.call('/users',{method:'POST',body:{username:'expired-user',name:'دعوت منقضی',role:'admin',method:'invite'}});await db.pool.query("UPDATE invitations SET expires_at=now()-interval '1 minute' WHERE user_id=$1",[expired.data.user.id]);
 assert.equal((await guest.call('/invitations/inspect',{method:'POST',body:{token:expired.data.url.split('/').at(-1)}})).status,400);
});
apiTest('server: imports preview, assign, preserve legacy metadata and reject duplication and invalid files',async()=>{
 const p={...seed.children[0],id:'legacy-child'},run=await start(admin,'hunt'),result=playSession(run),legacy={version:1,profile:p,records:[{id:'legacy-run',profileId:p.id,kind:'baseline',result}]};
 const preview=await admin.call('/imports/preview',{method:'POST',body:{document:legacy}});assert.equal(preview.status,200);assert.equal(preview.data.errors.length,0);
 const body={previewId:preview.data.id,mapping:[{sourceId:p.id,targetId:null}]};const imported=await admin.call('/imports/commit',{method:'POST',body});assert.equal(imported.status,200,JSON.stringify(imported.data));assert.equal(imported.data.importedRecords,1);
 const again=await admin.call('/imports/commit',{method:'POST',body});assert.deepEqual(again.data,imported.data);
 const preview2=await admin.call('/imports/preview',{method:'POST',body:{document:legacy}});assert.equal(preview2.data.profiles[0].targetId,imported.data.childIds[0]);const again2=await admin.call('/imports/commit',{method:'POST',body:{...body,previewId:preview2.data.id}});assert.equal(again2.data.createdProfiles,0);assert.equal(again2.data.importedRecords,0);
 const records=(await admin.call(`/children/${imported.data.childIds[0]}/sessions`)).data.records;assert.equal(records[0].legacyId,'legacy-run');assert.equal(records[0].result.finishedAt,result.finishedAt);assert.equal(records[0].result.protocolVersion,result.protocolVersion);
 const bad=await admin.call('/imports/preview',{method:'POST',body:{document:{...legacy,records:[{...legacy.records[0],result:{...result,score:-1}}]}}});assert.equal(bad.data.id,null);assert.ok(bad.data.errors.length);
 assert.equal((await user.call('/imports/preview',{method:'POST',body:{document:legacy}})).status,403);
});
apiTest('server: raw exports enforce permission and persist after creating a new app instance',async()=>{
 const reports=await admin.call(`/children/${seed.children[0].id}/sessions`),id=reports.data.records[0].id;
 assert.equal((await user.call(`/children/${seed.children[0].id}/sessions/${id}/export`)).status,403);assert.equal((await admin.call(`/children/${seed.children[0].id}/sessions/${id}/export`)).status,200);
 const another=createApp({pool:db.pool,loginLimit:200,secret:'test-session-secret-at-least-thirty-two-characters'}).listen(0,'127.0.0.1');await new Promise(r=>another.once('listening',r));const response=await fetch(`http://127.0.0.1:${another.address().port}/api/bootstrap`,{headers:{Cookie:admin.cookie}});assert.equal(response.status,200);assert.ok((await response.json()).records.length>=7);await new Promise(r=>{another.close(r);another.closeAllConnections();});
});
apiTest('server: administrator password reset invalidates other sessions; logout revokes access',async()=>{
 const reset=await admin.call('/invitations',{method:'POST',body:{userId:seed.users.user.id,purpose:'reset'}});assert.equal(reset.status,201);const client=new Client();await client.call('/auth/session');
 const accepted=await client.call('/invitations/accept',{method:'POST',body:{token:reset.data.url.split('/').at(-1),password:'A-brand-new-password-2026!'}});assert.equal(accepted.status,200);
 assert.equal((await user.call('/children')).status,401);assert.equal((await client.call('/auth/logout',{method:'POST'})).status,200);assert.equal((await client.call('/children')).status,401);
});

apiTest('server: changing a password revokes another browser session',async()=>{
 const one=await new Client().login(seed.users.otherUser),two=await new Client().login(seed.users.otherUser);
 const changed=await one.call('/auth/change-password',{method:'POST',body:{currentPassword:testPassword,password:'New-admin-password-2026!'}});assert.equal(changed.status,200);assert.equal((await two.call('/children')).status,401);assert.equal((await one.call('/children')).status,200);otherUser=one;
});
apiTest('server: login cookies are HttpOnly and login attempts are rate limited',async()=>{
 const limited=createApp({pool:db.pool,secret:'rate-limit-test-secret-with-at-least-thirty-two-characters',loginLimit:2}).listen(0,'127.0.0.1');await new Promise(r=>limited.once('listening',r));const old=base;base=`http://127.0.0.1:${limited.address().port}`;
 try{const client=new Client(),session=await client.call('/auth/session');assert.ok(session.headers.get('set-cookie').includes('HttpOnly'));assert.ok(session.headers.get('set-cookie').includes('SameSite=Lax'));for(let i=0;i<2;i++)assert.equal((await client.call('/auth/login',{method:'POST',body:{email:'absent@example.test',password:'invalid-password'}})).status,401);assert.equal((await client.call('/auth/login',{method:'POST',body:{email:'absent@example.test',password:'invalid-password'}})).status,429);}finally{base=old;await new Promise(r=>{limited.close(r);limited.closeAllConnections();});}
});
apiTest('server: invalid imports roll back all mappings and users cannot import',async()=>{
 const run=await start(admin,'traffic'),profile={...seed.children[0],id:'rollback-legacy'},document={version:1,profile,records:[{id:'rollback-record',profileId:profile.id,kind:'baseline',result:playSession(run)}]};
 assert.equal((await otherUser.call('/imports/preview',{method:'POST',body:{document}})).status,403);
 const preview=await admin.call('/imports/preview',{method:'POST',body:{document}}),before=(await db.pool.query('SELECT count(*) FROM children')).rows[0].count;
 const result=await admin.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping:[{sourceId:profile.id,targetId:randomUUID()}]}});assert.equal(result.status,404);assert.equal((await db.pool.query('SELECT count(*) FROM children')).rows[0].count,before);
});
apiTest('server: first administrator CLI has no default password and refuses a second bootstrap',async()=>{
 const fresh=await testDatabase(source,`havaas_cli_${process.pid}`);
 const execute=()=>new Promise(resolve=>{const child=spawn(process.execPath,['scripts/admin-create.mjs'],{env:{...process.env,DATABASE_URL:fresh.url},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('exit',code=>resolve({code,output}));child.stdin.end(JSON.stringify({username:'first-admin',email:'first-admin@example.test',name:'مدیر اولیه',password:testPassword}));});
 try{const created=await execute();assert.equal(created.code,0,created.output);assert.ok(!created.output.includes(testPassword));const second=await execute();assert.notEqual(second.code,0);assert.equal((await fresh.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n,1);}finally{await fresh.close();}
});

apiTest('server: direct accounts require a new password and user creation is atomic with one profile',async()=>{
 const profile={firstName:'مستقیم',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'admin-only-direct-note'};
 const invalid=await admin.call('/users',{method:'POST',body:{username:'invalid-profile',name:'حساب نامعتبر',role:'user',method:'direct',password:testPassword}});assert.equal(invalid.status,400);assert.equal((await db.pool.query("SELECT 1 FROM users WHERE username='invalid-profile'")).rowCount,0);
 const created=await admin.call('/users',{method:'POST',body:{username:'Direct.User',name:'حساب مستقیم',role:'user',method:'direct',password:testPassword,profile}});assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.user.username,'direct.user');assert.equal(created.data.user.passwordChangeRequired,true);
 const direct=await new Client().login({username:'DIRECT.USER'});const blocked=await direct.call('/bootstrap');assert.equal(blocked.status,403);assert.equal(blocked.data.code,'PASSWORD_CHANGE_REQUIRED');assert.equal((await direct.call(`/children/${created.data.profile.id}/sessions`,{method:'POST',body:{gameId:'hunt',kind:'baseline'}})).status,403);
 assert.equal((await direct.call('/auth/change-password',{method:'POST',body:{currentPassword:testPassword,password:testPassword}})).status,400);
 const changed=await direct.call('/auth/change-password',{method:'POST',body:{currentPassword:testPassword,password:'Direct-personal-password-2026!'}});assert.equal(changed.status,200);
 const own=(await direct.call('/bootstrap')).data;assert.equal(own.profiles.length,1);assert.equal(own.profiles[0].id,created.data.profile.id);assert.ok(!JSON.stringify(own).includes('admin-only-direct-note'));
 for(const path of ['/users',`/users/${seed.users.admin.id}`,`/children/${created.data.profile.id}/export`])assert.equal((await direct.call(path)).status,403);
 for(const [path,body] of [[`/users/${created.data.user.id}`,{active:false}],['/children',profile],[`/children/${created.data.profile.id}`,{school:'changed'}],[`/children/${created.data.profile.id}/difficulty`,{gameId:'hunt',mode:'fixed',level:'hard'}]])assert.equal((await direct.call(path,{method:path==='/children'?'POST':'PATCH',body})).status,403);
 const reviewed=await admin.call(`/users/${created.data.user.id}`);assert.equal(reviewed.data.profile.concerns,'admin-only-direct-note');assert.ok(reviewed.data.user.lastLoginAt);assert.equal((await db.pool.query('SELECT count(*)::int n FROM children WHERE owner_user_id=$1',[created.data.user.id])).rows[0].n,1);
 const updated=await admin.call(`/users/${created.data.user.id}`,{method:'PATCH',body:{username:'renamed.user',name:'نام تازه'}});assert.equal(updated.status,200);assert.equal((await direct.call('/children')).status,401);await direct.login({username:'RENAMED.USER'},'Direct-personal-password-2026!');
 const orphan=await admin.call('/children',{method:'POST',body:profile});const attached=await admin.call('/users',{method:'POST',body:{username:'attached-user',name:'پروندهٔ منتقل',role:'user',method:'invite',childId:orphan.data.profile.id}});assert.equal(attached.status,201);assert.equal(attached.data.profile.id,orphan.data.profile.id);
 assert.equal((await admin.call('/users',{method:'POST',body:{username:'attach-twice',name:'اتصال تکراری',role:'user',method:'invite',childId:orphan.data.profile.id}})).status,409);assert.equal((await db.pool.query("SELECT 1 FROM users WHERE username='attach-twice'")).rowCount,0);
});

apiTest('server: public parent links disclose only report data, update live, survive disabled login, and revoke immediately',async()=>{
 const owner=await new Client().login(seed.users.user,'A-brand-new-password-2026!'),childId=seed.children[0].id;
 const created=await owner.call(`/children/${childId}/report-links`,{method:'POST',body:{label:'گزارش خانواده'}});assert.equal(created.status,201);const raw=created.data.url.split('/').at(-1),guest=new Client();await guest.call('/auth/session');
 assert.notEqual((await db.pool.query('SELECT token_hash FROM report_links WHERE id=$1',[created.data.id])).rows[0].token_hash,raw);
 const get=()=>guest.call('/public/report',{method:'POST',body:{token:raw}}),first=await get();assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-store');assert.ok(first.data.sessions.length>=7);
 const serialized=JSON.stringify(first.data);for(const forbidden of ['clinical-secret','outcomes','settingsSnapshot','actorId','legacyId','email','password',childId,seed.users.user.id])assert.ok(!serialized.includes(forbidden),forbidden);assert.equal(Object.keys(first.data).sort().join(','),'displayName,generatedAt,sessions');
 const run=await start(owner,'traffic');await complete(owner,run);assert.equal((await get()).data.sessions.length,first.data.sessions.length+1);
 const secondDevice=await new Client().login(seed.users.user,'A-brand-new-password-2026!');assert.equal((await secondDevice.call(`/children/${childId}/report-links`)).data.links[0].id,created.data.id);assert.ok(!JSON.stringify((await secondDevice.call(`/children/${childId}/report-links`)).data).includes(raw));
 assert.equal((await otherUser.call(`/children/${childId}/report-links`)).status,404);assert.equal((await otherUser.call(`/children/${childId}/report-links/${created.data.id}`,{method:'DELETE'})).status,404);
 await admin.call(`/users/${seed.users.user.id}`,{method:'PATCH',body:{active:false}});assert.equal((await owner.call('/bootstrap')).status,401);assert.equal((await get()).status,200);
 assert.equal((await admin.call(`/children/${childId}/report-links/${created.data.id}`,{method:'DELETE'})).status,200);assert.equal((await get()).status,404);
 await admin.call(`/users/${seed.users.user.id}`,{method:'PATCH',body:{active:true}});
 assert.equal((await guest.call('/public/report',{method:'POST',body:{token:'0'.repeat(64)},headers:{'X-CSRF-Token':'bad'}})).status,403);
 const report=(await admin.call(`/children/${childId}/report-links`,{method:'POST',body:{label:'گزارش مدیر'}})).data;assert.equal((await guest.call('/public/report',{method:'POST',body:{token:report.url.split('/').at(-1)}})).status,200);
});

apiTest('server: multiple administrators and concurrent deactivations retain an active administrator',async()=>{
 assert.equal((await admin.call(`/users/${seed.users.admin.id}`,{method:'PATCH',body:{active:false}})).status,409);
 const invitation=await admin.call('/users',{method:'POST',body:{username:'second-admin',name:'مدیر دوم',role:'admin',method:'invite'}});assert.equal(invitation.status,201);assert.equal(invitation.data.profile,null);
 const second=new Client();await second.call('/auth/session');assert.equal((await second.call('/invitations/accept',{method:'POST',body:{token:invitation.data.url.split('/').at(-1),password:testPassword}})).status,200);
 const replies=await Promise.all([admin.call(`/users/${invitation.data.user.id}`,{method:'PATCH',body:{active:false}}),second.call(`/users/${seed.users.admin.id}`,{method:'PATCH',body:{active:false}})]);
 assert.equal(replies.filter(r=>r.status===200).length,1);assert.ok(replies.every(r=>[200,403,409].includes(r.status)));
 const enabled=(await db.pool.query("SELECT id FROM users WHERE role='admin' AND active=true")).rows;assert.equal(enabled.length,1);
 if(enabled[0].id!==seed.users.admin.id){assert.equal((await second.call(`/users/${seed.users.admin.id}`,{method:'PATCH',body:{active:true}})).status,200);admin=await new Client().login(seed.users.admin);}
});

apiTest('server: version-two migration preserves legacy administrators, seven sessions, levels and unambiguous ownership',async()=>{
 const {readFile}=await import('node:fs/promises'),{migrate}=await import('../server/db.js'),fresh=await testDatabase(source,`havaas_migration_${process.pid}`);
 let migratedServer;
 try{
  await fresh.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');await fresh.pool.query(await readFile(new URL('../server/migrations/001.sql',import.meta.url),'utf8'));await fresh.pool.query('CREATE TABLE schema_migrations(version integer PRIMARY KEY,applied_at timestamptz DEFAULT now()); INSERT INTO schema_migrations(version) VALUES(1)');
  const hash=(await db.pool.query('SELECT password_hash FROM users WHERE id=$1',[seed.users.admin.id])).rows[0].password_hash,ids={admin:randomUUID(),therapist:randomUUID(),ambiguous:randomUUID(),parent:randomUUID()},childId=randomUUID();
  for(const [key,id] of Object.entries(ids))await fresh.pool.query('INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',[id,`${key}@legacy.test`,key,key==='ambiguous'?'therapist':key,hash]);
  const profile={firstName:'سوابق',lastName:'قدیمی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'retained-clinical-note'};
  await fresh.pool.query('INSERT INTO children(id,therapist_id,profile) VALUES($1,$2,$3)',[childId,ids.therapist,profile]);
  for(let i=0;i<2;i++)await fresh.pool.query('INSERT INTO children(id,therapist_id,profile) VALUES($1,$2,$3)',[randomUUID(),ids.ambiguous,profile]);
  await fresh.pool.query('INSERT INTO parent_children(parent_id,child_id) VALUES($1,$2)',[ids.parent,childId]);
  const {normalizeSettings}=await import('../server/domain.js');
  for(const game of GAMES){const settings={...normalizeSettings({gameId:game.id}),seed:42,practice:true},result=playSession({id:randomUUID(),kind:'baseline',settings});await fresh.pool.query('INSERT INTO game_sessions(id,child_id,actor_id,kind,settings,difficulty_revision,result,finished_at,legacy_id) VALUES($1,$2,$3,$4,$5,1,$6,$7,$8)',[randomUUID(),childId,ids.therapist,'baseline',settings,result,result.finishedAt,`legacy-${game.id}`]);}
  await fresh.pool.query("INSERT INTO difficulty(child_id,game_id,variant,protocol,mode,level) VALUES($1,'hunt','standard',3,'fixed','hard')",[childId]);
  await fresh.pool.query("INSERT INTO auth_sessions(sid,sess,expire) VALUES('old-session','{}',now()+interval '1 hour')");
  await fresh.pool.query("INSERT INTO invitations(id,token_hash,email,role,purpose,created_by,expires_at) VALUES($1,'obsolete-token','old@legacy.test','parent','invite',$2,now()+interval '1 day')",[randomUUID(),ids.admin]);
  const before=(await fresh.pool.query('SELECT * FROM game_sessions ORDER BY id')).rows;await migrate(fresh.pool);await migrate(fresh.pool);assert.deepEqual((await fresh.pool.query('SELECT * FROM game_sessions ORDER BY id')).rows,before);
  const users=(await fresh.pool.query('SELECT * FROM users')).rows;assert.equal(users.find(u=>u.id===ids.admin).password_hash,hash);assert.equal(users.find(u=>u.id===ids.therapist).active,true);assert.equal(users.find(u=>u.id===ids.parent).active,false);assert.equal(users.find(u=>u.id===ids.ambiguous).active,false);assert.ok(users.every(u=>['admin','user'].includes(u.role)&&u.username&&u.legacy_email_login));
  assert.equal((await fresh.pool.query('SELECT owner_user_id FROM children WHERE id=$1',[childId])).rows[0].owner_user_id,ids.therapist);assert.equal((await fresh.pool.query('SELECT count(*)::int n FROM children WHERE owner_user_id IS NULL')).rows[0].n,2);assert.equal((await fresh.pool.query('SELECT count(*)::int n FROM auth_sessions')).rows[0].n,0);assert.equal((await fresh.pool.query('SELECT count(*)::int n FROM invitations WHERE used_at IS NULL')).rows[0].n,0);
  assert.equal((await fresh.pool.query('SELECT level FROM difficulty WHERE child_id=$1',[childId])).rows[0].level,'hard');
  migratedServer=createApp({pool:fresh.pool,secret:'migration-session-secret-more-than-thirty-two-characters'}).listen(0,'127.0.0.1');await new Promise(r=>migratedServer.once('listening',r));const oldBase=base;base=`http://127.0.0.1:${migratedServer.address().port}`;
  try{const legacyAdmin=await new Client().login({username:'admin@legacy.test'});assert.equal((await legacyAdmin.call('/users')).status,200);const legacyUser=await new Client().login({username:'therapist@legacy.test'}),own=(await legacyUser.call('/bootstrap')).data;assert.equal(own.profiles.length,1);assert.equal(own.records.length,7);assert.ok(!JSON.stringify(own).includes('retained-clinical-note'));}finally{base=oldBase;}
 }finally{if(migratedServer)await new Promise(r=>{migratedServer.close(r);migratedServer.closeAllConnections();});await fresh.close();}
});

apiTest('server: successful logins do not consume failed-attempt limits or share limits with invite inspection',async()=>{
 const limited=createApp({pool:db.pool,secret:'success-rate-limit-test-secret-more-than-thirty-two-characters',loginLimit:2}).listen(0,'127.0.0.1');await new Promise(r=>limited.once('listening',r));const previous=base;base=`http://127.0.0.1:${limited.address().port}`;
 try{
  const client=new Client();await client.call('/auth/session');
  for(let i=0;i<4;i++){assert.equal((await client.call('/auth/login',{method:'POST',body:{identifier:seed.users.admin.username,password:testPassword}})).status,200);assert.equal((await client.call('/auth/logout',{method:'POST'})).status,200);await client.call('/auth/session');}
  for(let i=0;i<2;i++)assert.equal((await client.call('/invitations/inspect',{method:'POST',body:{token:'0'.repeat(64)}})).status,400);
  assert.equal((await client.call('/invitations/inspect',{method:'POST',body:{token:'0'.repeat(64)}})).status,429);
  assert.equal((await client.call('/auth/login',{method:'POST',body:{identifier:seed.users.admin.username,password:testPassword}})).status,200);
  for(let i=0;i<2;i++)assert.equal((await client.call('/auth/login',{method:'POST',body:{identifier:'missing-account',password:'incorrect-password'}})).status,401);
  assert.equal((await client.call('/AUTH/LOGIN/',{method:'POST',body:{identifier:'missing-account',password:'incorrect-password'}})).status,429);
 }finally{base=previous;await new Promise(r=>{limited.close(r);limited.closeAllConnections();});}
});

apiTest('server: accepting and regenerating an invitation concurrently does not deadlock or reuse a token',async()=>{
 const created=await admin.call('/users',{method:'POST',body:{username:'racing-invitation',name:'دعوت هم‌زمان',role:'admin',method:'invite'}});assert.equal(created.status,201);
 const guest=new Client();await guest.call('/auth/session');const raw=created.data.url.split('/').at(-1);
 const [accept,renew]=await Promise.all([guest.call('/invitations/accept',{method:'POST',body:{token:raw,password:testPassword}}),admin.call('/invitations',{method:'POST',body:{userId:created.data.user.id,purpose:'invite'}})]);
 assert.ok([200,400].includes(accept.status),JSON.stringify(accept.data));assert.ok([201,400].includes(renew.status),JSON.stringify(renew.data));assert.equal((accept.status===200?1:0)+(renew.status===201?1:0),1);
 if(renew.status===201)assert.equal((await guest.call('/invitations/accept',{method:'POST',body:{token:renew.data.url.split('/').at(-1),password:testPassword}})).status,200);
 assert.equal((await guest.call('/invitations/accept',{method:'POST',body:{token:raw,password:testPassword}})).status,400);
 const reset=await admin.call('/invitations',{method:'POST',body:{userId:created.data.user.id,purpose:'reset'}});assert.equal(reset.status,201);
 assert.equal((await guest.call('/auth/change-password',{method:'POST',body:{currentPassword:testPassword,password:'Changed-after-reset-issuance-2026!'}})).status,200);
 const stranger=new Client();await stranger.call('/auth/session');assert.equal((await stranger.call('/invitations/accept',{method:'POST',body:{token:reset.data.url.split('/').at(-1),password:'Obsolete-reset-password-2026!'}})).status,400);
 assert.equal((await stranger.call('/auth/login',{method:'POST',body:{identifier:'racing-invitation',password:'Changed-after-reset-issuance-2026!'}})).status,200);
});

apiTest('server: concurrent administrator recovery commands leave one valid thirty-minute link',async()=>{
 const execute=()=>new Promise(resolve=>{const child=spawn(process.execPath,['scripts/admin-reset-link.mjs'],{env:{...process.env,DATABASE_URL:db.url},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.on('exit',code=>resolve({code,output}));child.stdin.end(seed.users.admin.username+'\n');});
 const attempts=await Promise.all([execute(),execute()]);assert.ok(attempts.every(result=>result.code===0));assert.ok(attempts.every(result=>/#invite\/[a-f0-9]{64}/.test(result.output)));
 const links=(await db.pool.query('SELECT * FROM invitations WHERE user_id=$1 AND used_at IS NULL',[seed.users.admin.id])).rows;assert.equal(links.length,1);assert.equal(Math.round((new Date(links[0].expires_at)-new Date(links[0].created_at))/60000),30);
 const guest=new Client();await guest.call('/auth/session');const inspected=await Promise.all(attempts.map(result=>guest.call('/invitations/inspect',{method:'POST',body:{token:result.output.match(/#invite\/([a-f0-9]{64})/)[1]}})));assert.equal(inspected.filter(r=>r.status===200).length,1);assert.equal(inspected.filter(r=>r.status===400).length,1);
});

apiTest('server: malformed import mappings return a validation error and leave the preview reusable',async()=>{
 const run=await start(admin,'traffic'),profile={...seed.children[0],id:'mapping-validation-case'},document={version:1,profile,records:[{id:'mapping-validation-run',profileId:profile.id,kind:'baseline',result:playSession(run)}]};
 const preview=await admin.call('/imports/preview',{method:'POST',body:{document}});assert.equal(preview.status,200);const before=(await db.pool.query('SELECT count(*)::int n FROM children')).rows[0].n;
 for(const mapping of [[null],[{}],[{sourceId:profile.id,targetId:{id:seed.children[0].id}}]])assert.equal((await admin.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping}})).status,400);
 assert.equal((await db.pool.query('SELECT count(*)::int n FROM children')).rows[0].n,before);assert.equal((await db.pool.query('SELECT committed_at FROM import_previews WHERE id=$1',[preview.data.id])).rows[0].committed_at,null);
 const valid=await admin.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping:[{sourceId:profile.id,targetId:seed.children[0].id}]}});assert.equal(valid.status,200);assert.equal(valid.data.importedRecords,1);
});

apiTest('server: imported standard baselines without a variant allow training and share one latest difficulty',async()=>{
 const {normalizeSettings}=await import('../server/domain.js');const run={id:'old-standard',kind:'baseline',settings:{...normalizeSettings({gameId:'traffic'}),seed:42}},result=playSession(run);delete result.variant;
 const profile={firstName:'قدیمی',lastName:'بدون حالت',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',id:'no-variant-case'},document={version:1,profile,records:[{id:'old-standard-run',profileId:profile.id,kind:'baseline',result}]};
 const preview=await admin.call('/imports/preview',{method:'POST',body:{document}});assert.equal(preview.data.errors.length,0);const imported=await admin.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping:[{sourceId:profile.id,targetId:null}]}});assert.equal(imported.status,200);const id=imported.data.childIds[0];
 const assessment=await admin.call(`/children/${id}/assessment`);assert.ok(assessment.data.steps.find(s=>s.gameId==='traffic').baseline);
 const training=await admin.call(`/children/${id}/sessions`,{method:'POST',body:{gameId:'traffic',kind:'training'}});assert.equal(training.status,201,JSON.stringify(training.data));assert.equal(training.data.settings.variant,'standard');
 const stored=(await db.pool.query('SELECT result FROM game_sessions WHERE child_id=$1 AND legacy_id=$2',[id,'old-standard-run'])).rows[0].result;assert.equal(stored.variant,undefined);assert.equal(stored.finishedAt,result.finishedAt);
});

apiTest('server: invalid Unicode and malformed timestamps are reported in preview and rejected by profile APIs',async()=>{
 const run=await start(admin,'traffic'),valid=playSession(run),profile={...seed.children[0],id:'invalid-text-case'},original=(await db.pool.query('SELECT profile FROM children WHERE id=$1',[seed.children[0].id])).rows[0].profile;
 for(const text of ['bad\u0000text','bad\ud800text','bad\udc00text']){
  const document={version:1,profile:{...profile,firstName:text},records:[{id:'invalid-text-run',profileId:profile.id,kind:'baseline',result:valid}]};
  const preview=await admin.call('/imports/preview',{method:'POST',body:{document}});assert.equal(preview.status,200);assert.equal(preview.data.id,null);assert.ok(preview.data.errors.length);
  assert.equal((await admin.call(`/children/${seed.children[0].id}`,{method:'PATCH',body:{firstName:text}})).status,400);
  assert.equal((await admin.call(`/users/${seed.users.otherUser.id}`,{method:'PATCH',body:{name:text}})).status,400);
  assert.equal((await admin.call(`/children/${seed.children[0].id}/report-links`,{method:'POST',body:{label:text}})).status,400);
 }
 for(const finishedAt of ['1',1,'2026-02-30T12:00:00Z','not-a-date']){
  const preview=await admin.call('/imports/preview',{method:'POST',body:{document:{version:1,profile,records:[{id:'invalid-date-run',profileId:profile.id,kind:'baseline',result:{...valid,finishedAt}}]}}});assert.equal(preview.status,200);assert.equal(preview.data.id,null);assert.ok(preview.data.errors.length);
 }
 const metadata=await admin.call('/imports/preview',{method:'POST',body:{document:{version:1,profile:{...profile,metadata:{note:'bad\u0000metadata'}},records:[]}}});assert.equal(metadata.status,200);assert.equal(metadata.data.id,null);
 assert.deepEqual((await db.pool.query('SELECT profile FROM children WHERE id=$1',[seed.children[0].id])).rows[0].profile,original);
});

apiTest('server: mixed explicit and omitted standard variants seed difficulty from the latest imported baseline',async()=>{
 const {normalizeSettings}=await import('../server/domain.js'),run={id:'mixed-standard',kind:'baseline',settings:{...normalizeSettings({gameId:'traffic'}),seed:42}},older={...playSession(run),finishedAt:'2026-01-01T12:00:00.000Z'},latest={...playSession(run,{omit:true}),finishedAt:'2026-01-02T15:30:00.000+03:30'};delete latest.variant;
 const profile={id:'mixed-standard-case',firstName:'مراجع',lastName:'آخرین ارزیابی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',createdAt:'2025-12-01T12:00:00.000+03:30'},document={version:1,profile,records:[{id:'older-standard',kind:'baseline',profileId:profile.id,result:older},{id:'latest-no-variant',kind:'baseline',profileId:profile.id,result:latest}]};
 const preview=await admin.call('/imports/preview',{method:'POST',body:{document}});assert.deepEqual(preview.data.errors,[]);const imported=await admin.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping:[{sourceId:profile.id,targetId:null}]}});assert.equal(imported.status,200);const id=imported.data.childIds[0],settings=(await admin.call(`/children/${id}/difficulty`)).data.settings;assert.equal(settings.length,1);assert.equal(settings[0].variant,'standard');assert.equal(settings[0].level,'easy');
 const saved=(await db.pool.query('SELECT result,finished_at FROM game_sessions WHERE child_id=$1 AND legacy_id=$2',[id,'latest-no-variant'])).rows[0];assert.equal(saved.result.finishedAt,latest.finishedAt);assert.equal(saved.finished_at.toISOString(),'2026-01-02T12:00:00.000Z');assert.equal((await db.pool.query('SELECT created_at FROM children WHERE id=$1',[id])).rows[0].created_at.toISOString(),'2025-12-01T08:30:00.000Z');
 const reordered={...document,profile:Object.fromEntries(Object.entries(profile).reverse())};const again=await admin.call('/imports/preview',{method:'POST',body:{document:reordered}});assert.equal(again.data.profiles[0].targetId,id);const repeat=await admin.call('/imports/commit',{method:'POST',body:{previewId:again.data.id,mapping:[{sourceId:profile.id,targetId:id}]}});assert.equal(repeat.status,200);assert.equal(repeat.data.createdProfiles,0);assert.equal(repeat.data.importedRecords,0);
});
