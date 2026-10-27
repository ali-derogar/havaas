import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createApp } from '../server/app.js';
import { testDatabase,seedAccounts,testPassword } from './helpers/database.mjs';
import { playSession } from './helpers/play-session.mjs';
import { GAMES } from '../src/config.js';
const source=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let db,server,base,seed,admin,therapist,parent,otherParent,otherTherapist;
class Client{
 constructor(){this.cookie='';this.csrf=null;}
 async call(path,{method='GET',body,headers={}}={}){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:this.cookie,...(method!=='GET'?{'X-CSRF-Token':this.csrf||''}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  if(data.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data,headers:response.headers};
 }
 async login(user){await this.call('/auth/session');const r=await this.call('/auth/login',{method:'POST',body:{email:user.email,password:testPassword}});assert.equal(r.status,200);return this;}
}
const apiTest=(name,fn)=>test(name,{skip:!source},fn);
before(async()=>{
 if(!source)return;db=await testDatabase(source,`havaas_test_${process.pid}`);seed=await seedAccounts(db.pool);
 server=createApp({pool:db.pool,secret:'test-session-secret-at-least-thirty-two-characters'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
 admin=await new Client().login(seed.users.admin);therapist=await new Client().login(seed.users.therapist);parent=await new Client().login(seed.users.parent);otherParent=await new Client().login(seed.users.otherParent);otherTherapist=await new Client().login(seed.users.otherTherapist);
});
after(async()=>{if(!source)return;await new Promise(r=>{server.close(r);server.closeAllConnections();});await db.close();});
const start=async(client,gameId,kind='baseline',extra={})=>{const r=await client.call(`/children/${seed.children[0].id}/sessions`,{method:'POST',body:{gameId,kind,...extra}});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;};
const complete=(client,run,payload=playSession(run))=>client.call(`/children/${seed.children[0].id}/sessions/${run.id}/complete`,{method:'POST',body:{result:payload}});
apiTest('server: roles protect lists, clinical notes, direct IDs and raw exports',async()=>{
 const own=await parent.call('/bootstrap');assert.equal(own.status,200);assert.equal(own.data.profiles.length,1);assert.equal(own.data.profiles[0].concerns,undefined);assert.ok(!JSON.stringify(own.data).includes('clinical-secret'));
 for(const path of [`/children/${seed.children[1].id}`,`/children/${seed.children[1].id}/sessions`,`/children/${seed.children[1].id}/reports`,`/children/${seed.children[1].id}/assessment`,`/children/${seed.children[1].id}/difficulty`])assert.equal((await parent.call(path)).status,404);
 assert.equal((await therapist.call(`/children/${seed.children[1].id}`)).status,404);assert.equal((await parent.call(`/children/${seed.children[0].id}/export`)).status,403);
 assert.equal((await parent.call(`/children/${seed.children[0].id}`,{method:'PATCH',body:{concerns:'changed'}})).status,403);
 assert.equal((await parent.call('/invitations',{method:'POST',body:{email:'bad@example.test',role:'therapist'}})).status,403);
 assert.equal((await new Client().call('/children')).status,401);
});
apiTest('server: CSRF and foreign origins are rejected',async()=>{
 assert.equal((await parent.call('/auth/logout',{method:'POST',headers:{'X-CSRF-Token':'wrong'}})).status,403);
 assert.equal((await parent.call('/auth/logout',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
});
apiTest('server: all seven games save canonical metrics and resume assessment from another device',async()=>{
 for(const game of GAMES){const run=await start(therapist,game.id);const payload=playSession(run);payload.score=99999;payload.hits=99999;const r=await complete(therapist,run,payload);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.record.result.score,r.data.record.result.maxScore);assert.notEqual(r.data.record.result.hits,99999);assert.equal(r.data.record.actorId,seed.users.therapist.id);assert.equal(r.data.record.result.settingsSnapshot.seed,run.settings.seed);assert.equal(r.data.record.result.stimulusVersion,run.settings.stimulusVersion);}
 const assessment=await parent.call(`/children/${seed.children[0].id}/assessment`);assert.equal(assessment.data.steps.filter(s=>s.baseline).length,7);
 const result=await parent.call(`/children/${seed.children[0].id}/reports`);assert.ok(result.data.records.every(r=>r.result.outcomes===undefined));assert.ok(!JSON.stringify(result.data).includes('clinical-secret'));
 const secondDevice=await new Client().login(seed.users.parent);assert.equal((await secondDevice.call(`/children/${seed.children[0].id}/assessment`)).data.steps.filter(s=>s.baseline).length,7);
});
apiTest('server: fixed levels and snapshots survive changes during a session',async()=>{
 const child=seed.children[0].id;
 let r=await therapist.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'hard'}});assert.equal(r.status,200);
 const run=await start(parent,'traffic','training');assert.equal(run.settings.level,'hard');
 await therapist.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'easy'}});
 const saved=await complete(parent,run);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.record.result.level,'hard');
 assert.equal((await start(parent,'traffic','training')).settings.level,'easy');
 assert.equal((await parent.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'fixed',level:'hard'}})).status,403);
});
apiTest('server: retries and simultaneous sessions update adaptive difficulty only once',async()=>{
 const child=seed.children[0].id;await therapist.call(`/children/${child}/difficulty`,{method:'PATCH',body:{gameId:'traffic',mode:'adaptive',level:'easy'}});
 const a=await start(parent,'traffic','training'),b=await start(parent,'traffic','training');
 const replies=await Promise.all([complete(parent,a),complete(parent,a),complete(parent,b)]);assert.ok(replies.every(r=>r.status===200));
 const state=(await parent.call(`/children/${child}/difficulty`)).data.settings.find(s=>s.gameId==='traffic');assert.equal(state.level,'medium');
 const count=await db.pool.query('SELECT count(*)::int AS n FROM game_sessions WHERE id IN ($1,$2) AND result IS NOT NULL',[a.id,b.id]);assert.equal(count.rows[0].n,2);
 assert.equal((await complete(otherParent,a)).status,404);
});
apiTest('server: invalid response traces do not save or change difficulty',async()=>{
 const run=await start(parent,'hunt','training'),payload=playSession(run);payload.outcomes.pop();assert.equal((await complete(parent,run,payload)).status,400);
 assert.equal((await db.pool.query('SELECT result FROM game_sessions WHERE id=$1',[run.id])).rows[0].result,null);
 const fixed=await start(parent,'search','baseline',{targetCount:2,material:'letters',layout:'scattered'});assert.equal((await complete(parent,fixed)).status,200);
 const timeout=await start(parent,'space','training');assert.equal((await complete(parent,timeout,playSession(timeout,{timeout:true}))).status,200);
});
apiTest('server: impossible timing is rolled back without saving results or increasing levels',async()=>{
 const child=seed.children[0].id;
 for(const gameId of ['traffic','search','space']){
  const run=await start(parent,gameId,'training'),before=(await parent.call(`/children/${child}/difficulty`)).data.settings,payload=playSession(run);
  if(gameId==='space')payload.outcomes.find(o=>o.reactionMs>0).reactionMs=-1;
  else {payload.durationMs=1;for(const o of payload.outcomes){o.atMs=1;if(o.response)o.reactionMs=0;}}
  assert.equal((await complete(parent,run,payload)).status,400);
  assert.equal((await db.pool.query('SELECT result FROM game_sessions WHERE id=$1',[run.id])).rows[0].result,null);
  assert.deepEqual((await parent.call(`/children/${child}/difficulty`)).data.settings,before);
  assert.equal((await complete(parent,run)).status,200);
 }
});
apiTest('server: invitation links are one-use, expire, and cannot take over an existing account',async()=>{
 const invite=await therapist.call('/invitations',{method:'POST',body:{email:'new-parent@example.test',role:'parent',childId:seed.children[0].id}});assert.equal(invite.status,201);const raw=invite.data.url.split('/').at(-1),guest=new Client();await guest.call('/auth/session');
 const stored=(await db.pool.query("SELECT * FROM invitations WHERE email='new-parent@example.test'")).rows[0];assert.notEqual(stored.token_hash,raw);
 const accepted=await guest.call('/invitations/accept',{method:'POST',body:{token:raw,name:'والد تازه',password:testPassword}});assert.equal(accepted.status,200);assert.equal((await guest.call('/bootstrap')).data.profiles.length,1);
 assert.equal((await guest.call('/invitations/accept',{method:'POST',body:{token:raw,name:'تکراری',password:testPassword}})).status,400);
 const existing=await therapist.call('/invitations',{method:'POST',body:{email:seed.users.otherParent.email,role:'parent',childId:seed.children[0].id}}),existingToken=existing.data.url.split('/').at(-1);
 assert.equal((await guest.call('/invitations/accept',{method:'POST',body:{token:existingToken,password:'takeover-password!'}})).status,401);
 assert.equal((await otherParent.call('/invitations/accept',{method:'POST',body:{token:existingToken}})).status,200);
 const expired=await therapist.call('/invitations',{method:'POST',body:{email:'expired@example.test',role:'parent',childId:seed.children[0].id}});await db.pool.query("UPDATE invitations SET expires_at=now()-interval '1 minute' WHERE email='expired@example.test'");
 assert.equal((await guest.call('/invitations/inspect',{method:'POST',body:{token:expired.data.url.split('/').at(-1)}})).status,400);
});
apiTest('server: imports preview, assign, preserve legacy metadata and reject duplication and invalid files',async()=>{
 const p={...seed.children[0],id:'legacy-child'},run=await start(therapist,'hunt'),result=playSession(run),legacy={version:1,profile:p,records:[{id:'legacy-run',profileId:p.id,kind:'baseline',result}]};
 const preview=await therapist.call('/imports/preview',{method:'POST',body:{document:legacy}});assert.equal(preview.status,200);assert.equal(preview.data.errors.length,0);
 const body={previewId:preview.data.id,mapping:[{sourceId:p.id,targetId:null}]};const imported=await therapist.call('/imports/commit',{method:'POST',body});assert.equal(imported.status,200,JSON.stringify(imported.data));assert.equal(imported.data.importedRecords,1);
 const again=await therapist.call('/imports/commit',{method:'POST',body});assert.deepEqual(again.data,imported.data);
 const preview2=await therapist.call('/imports/preview',{method:'POST',body:{document:legacy}});const again2=await therapist.call('/imports/commit',{method:'POST',body:{...body,previewId:preview2.data.id}});assert.equal(again2.data.createdProfiles,0);assert.equal(again2.data.importedRecords,0);
 const records=(await therapist.call(`/children/${imported.data.childIds[0]}/sessions`)).data.records;assert.equal(records[0].legacyId,'legacy-run');assert.equal(records[0].result.finishedAt,result.finishedAt);assert.equal(records[0].result.protocolVersion,result.protocolVersion);
 const bad=await therapist.call('/imports/preview',{method:'POST',body:{document:{...legacy,records:[{...legacy.records[0],result:{...result,score:-1}}]}}});assert.equal(bad.data.id,null);assert.ok(bad.data.errors.length);
 assert.equal((await parent.call('/imports/preview',{method:'POST',body:{document:legacy}})).status,403);
});
apiTest('server: raw exports enforce permission and persist after creating a new app instance',async()=>{
 const reports=await therapist.call(`/children/${seed.children[0].id}/sessions`),id=reports.data.records[0].id;
 assert.equal((await parent.call(`/children/${seed.children[0].id}/sessions/${id}/export`)).status,403);assert.equal((await therapist.call(`/children/${seed.children[0].id}/sessions/${id}/export`)).status,200);
 const another=createApp({pool:db.pool,secret:'test-session-secret-at-least-thirty-two-characters'}).listen(0,'127.0.0.1');await new Promise(r=>another.once('listening',r));const response=await fetch(`http://127.0.0.1:${another.address().port}/api/bootstrap`,{headers:{Cookie:therapist.cookie}});assert.equal(response.status,200);assert.ok((await response.json()).records.length>=7);await new Promise(r=>{another.close(r);another.closeAllConnections();});
});
apiTest('server: administrator password reset invalidates other sessions; logout revokes access',async()=>{
 const reset=await admin.call('/invitations',{method:'POST',body:{email:seed.users.parent.email,purpose:'reset'}});assert.equal(reset.status,201);const client=new Client();await client.call('/auth/session');
 const accepted=await client.call('/invitations/accept',{method:'POST',body:{token:reset.data.url.split('/').at(-1),password:'A-brand-new-password-2026!'}});assert.equal(accepted.status,200);
 assert.equal((await parent.call('/children')).status,401);assert.equal((await client.call('/auth/logout',{method:'POST'})).status,200);assert.equal((await client.call('/children')).status,401);
});

apiTest('server: changing a password revokes another browser session',async()=>{
 const one=await new Client().login(seed.users.otherTherapist),two=await new Client().login(seed.users.otherTherapist);
 const changed=await one.call('/auth/change-password',{method:'POST',body:{currentPassword:testPassword,password:'New-therapist-password-2026!'}});assert.equal(changed.status,200);assert.equal((await two.call('/children')).status,401);assert.equal((await one.call('/children')).status,200);otherTherapist=one;
});
apiTest('server: login cookies are HttpOnly and login attempts are rate limited',async()=>{
 const limited=createApp({pool:db.pool,secret:'rate-limit-test-secret-with-at-least-thirty-two-characters',loginLimit:2}).listen(0,'127.0.0.1');await new Promise(r=>limited.once('listening',r));const old=base;base=`http://127.0.0.1:${limited.address().port}`;
 try{const client=new Client(),session=await client.call('/auth/session');assert.ok(session.headers.get('set-cookie').includes('HttpOnly'));assert.ok(session.headers.get('set-cookie').includes('SameSite=Lax'));for(let i=0;i<2;i++)assert.equal((await client.call('/auth/login',{method:'POST',body:{email:'absent@example.test',password:'invalid-password'}})).status,401);assert.equal((await client.call('/auth/login',{method:'POST',body:{email:'absent@example.test',password:'invalid-password'}})).status,429);}finally{base=old;await new Promise(r=>{limited.close(r);limited.closeAllConnections();});}
});
apiTest('server: invalid imports roll back all mappings and do not grant foreign case access',async()=>{
 const run=await start(therapist,'traffic'),profile={...seed.children[0],id:'rollback-legacy'},document={version:1,profile,records:[{id:'rollback-record',profileId:profile.id,kind:'baseline',result:playSession(run)}]};const preview=await otherTherapist.call('/imports/preview',{method:'POST',body:{document}}),before=(await db.pool.query('SELECT count(*) FROM children')).rows[0].count;
 const result=await otherTherapist.call('/imports/commit',{method:'POST',body:{previewId:preview.data.id,mapping:[{sourceId:profile.id,targetId:seed.children[0].id}]}});assert.equal(result.status,404);assert.equal((await db.pool.query('SELECT count(*) FROM children')).rows[0].count,before);
});
apiTest('server: first administrator CLI has no default password and refuses a second bootstrap',async()=>{
 const fresh=await testDatabase(source,`havaas_cli_${process.pid}`);
 const execute=()=>new Promise(resolve=>{const child=spawn(process.execPath,['scripts/admin-create.mjs'],{env:{...process.env,DATABASE_URL:fresh.url},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('exit',code=>resolve({code,output}));child.stdin.end(JSON.stringify({email:'first-admin@example.test',name:'مدیر اولیه',password:testPassword}));});
 try{const created=await execute();assert.equal(created.code,0,created.output);assert.ok(!created.output.includes(testPassword));const second=await execute();assert.notEqual(second.code,0);assert.equal((await fresh.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n,1);}finally{await fresh.close();}
});
