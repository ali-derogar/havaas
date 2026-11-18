import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {testDatabase,seedAccounts} from './helpers/database.mjs';
import {playSession} from './helpers/play-session.mjs';
import {migrate} from '../server/db.js';

const source=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let db,seed,server,base,admin,user;
class Client{
 cookie='';csrf='';
 async call(path,method='GET',body){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:this.cookie,...(method!=='GET'?{'X-CSRF-Token':this.csrf,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];const data=await response.json();if(data.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data};
 }
 async login(key){await this.call('/auth/session');assert.equal((await this.call('/auth/login','POST',{identifier:seed.users[key].username,password:seed.password})).status,200);return this;}
}
before(async()=>{if(!source)return;db=await testDatabase(source,`havaas_timings_${process.pid}`);seed=await seedAccounts(db.pool);server=createApp({pool:db.pool,secret:'timing-test-secret-at-least-thirty-two-characters',loginLimit:200}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;admin=await new Client().login('admin');user=await new Client().login('user');});
after(async()=>{if(!db)return;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.close();});
const apiTest=(name,fn)=>test(name,{skip:!source},fn);
const identity={gameId:'traffic',variant:'standard',timingFamily:'standard',level:'hard'};
const query=key=>new URLSearchParams(key).toString();
const globalPath='/admin/game-timings';
const childPath=()=>`/children/${seed.children[0].id}/game-timings`;
const hard=data=>data.levels.find(row=>row.level==='hard');
async function save(path,key,timing){const current=await admin.call(`${path}?${query(key)}`);assert.equal(current.status,200);return admin.call(path,'PATCH',{...key,timing,expectedRevision:current.data.levels.find(row=>row.level===key.level).revision});}
async function start(kind,version=3,extra={}){const response=await user.call(`/children/${seed.children[0].id}/sessions`,'POST',{gameId:'traffic',kind,clientExperienceVersion:version,...extra});assert.equal(response.status,201,JSON.stringify(response.data));return response.data;}
async function complete(run){const response=await user.call(`/children/${seed.children[0].id}/sessions/${run.id}/complete`,'POST',{result:playSession(run)});assert.equal(response.status,200,JSON.stringify(response.data));return response.data.record;}

apiTest('timing policies inherit, override, reset and isolate each user, mode and level',async()=>{
 const initial=await admin.call(`${globalPath}?${query(identity)}`);assert.equal(initial.status,200);assert.deepEqual(hard(initial.data).timing,{visibleMs:300,intervalMs:1000});assert.equal(hard(initial.data).revision,0);
 assert.equal((await save(globalPath,identity,{visibleMs:1500,intervalMs:2500})).status,200);
 let own=await admin.call(`${childPath()}?${query(identity)}`);assert.equal(hard(own.data).source,'global');assert.equal(own.data.levels[0].source,'default');
 assert.equal((await save(childPath(),identity,{visibleMs:2000,intervalMs:3000})).status,200);
 own=await admin.call(`${childPath()}?${query(identity)}`);assert.equal(hard(own.data).source,'child');assert.equal(hard(own.data).timing.visibleMs,2000);
 const other=await admin.call(`/children/${seed.children[1].id}/game-timings?${query(identity)}`);assert.equal(hard(other.data).timing.visibleMs,1500);
 const signs=await admin.call(`${childPath()}?${query({...identity,variant:'signs'})}`);assert.equal(hard(signs.data).source,'default');
 await save(globalPath,identity,{visibleMs:2500,intervalMs:3500});assert.equal(hard((await admin.call(`${childPath()}?${query(identity)}`)).data).timing.visibleMs,2000);
 const reset=await save(childPath(),identity,null);assert.equal(hard(reset.data).source,'global');assert.equal(hard(reset.data).timing.visibleMs,2500);
 const resetGlobal=await save(globalPath,identity,null);assert.equal(hard(resetGlobal.data).source,'default');assert.ok(hard(resetGlobal.data).revision>1);
});
apiTest('timing writes enforce permissions, validation, optimistic concurrency and audit no-ops',async()=>{
 assert.equal((await user.call(`${globalPath}?${query(identity)}`)).status,403);
 assert.equal((await user.call(childPath(),'PATCH',{...identity,timing:null,expectedRevision:0})).status,403);
 assert.equal((await user.call(`/children/${seed.children[1].id}/game-timings?${query(identity)}`)).status,404);
 const visible=(await user.call(`${childPath()}?${query(identity)}`)).data;assert.deepEqual(Object.keys(hard(visible)).sort(),['level','timing']);
 for(const body of [{...identity,timing:{visibleMs:1500,intervalMs:1000},expectedRevision:0},{...identity,variant:'invalid',timing:null,expectedRevision:0},{...identity,timing:{visibleMs:100,intervalMs:0},expectedRevision:0}])assert.equal((await admin.call(globalPath,'PATCH',body)).status,400);
 const before=(await admin.call(`${globalPath}?${query(identity)}`)).data,revision=hard(before).revision,timing={visibleMs:500,intervalMs:1500};
 const responses=await Promise.all([admin.call(globalPath,'PATCH',{...identity,timing,expectedRevision:revision}),admin.call(globalPath,'PATCH',{...identity,timing:{visibleMs:600,intervalMs:1600},expectedRevision:revision})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const current=(await admin.call(`${globalPath}?${query(identity)}`)).data,count=Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count);
 const same=await save(globalPath,identity,hard(current).timing);assert.equal(hard(same.data).revision,hard(current).revision);assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),count);
 assert.equal((await admin.call(globalPath,'PATCH',{...identity,timing:null})).status,428);
 const events=await admin.call('/admin/audit-events?action=game_timing_defaults.updated');assert.equal(events.status,200);assert.ok(events.data.events.some(event=>event.actorId===seed.users.admin.id&&event.changedFields.includes('timing')));
});
apiTest('new sessions snapshot authoritative timings, baselines stay standard and old clients keep their schedules',async()=>{
 await save(globalPath,identity,{visibleMs:1500,intervalMs:2500});await save(childPath(),identity,{visibleMs:2000,intervalMs:3000});
 const baseline=await start('baseline',3,{timing:{visibleMs:10000,intervalMs:15000}});assert.deepEqual(baseline.settings.timing,{visibleMs:800,intervalMs:1500});await complete(baseline);
 assert.equal((await admin.call(`/children/${seed.children[0].id}/difficulty`,'PATCH',{gameId:'traffic',mode:'fixed',level:'hard'})).status,200);
 const run=await start('training',3,{timing:{visibleMs:100,intervalMs:200}});assert.deepEqual(run.settings.timing,{visibleMs:2000,intervalMs:3000});
 await save(childPath(),identity,{visibleMs:2500,intervalMs:3500});const result=await complete(run);assert.deepEqual(result.result.timing,{visibleMs:2000,intervalMs:3000});
 const next=await start('training');assert.deepEqual(next.settings.timing,{visibleMs:2500,intervalMs:3500});await complete(next);
 for(const version of [1,2]){const old=await start('training',version);assert.equal(old.settings.timing,undefined);assert.equal((await complete(old)).result.experienceVersion,version);}
 const panel=await user.call(`/children/${seed.children[0].id}/reports?view=panel&recordId=${run.id}`);assert.equal(panel.status,200);assert.equal(panel.data.trend.length,1);assert.deepEqual(panel.data.selected.result.timing,run.settings.timing);
 const exported=await admin.call(`/children/${seed.children[0].id}/export`),preview=await admin.call('/imports/preview','POST',{document:exported.data});assert.equal(preview.status,200);assert.deepEqual(preview.data.errors,[]);
 await migrate(db.pool);assert.equal((await admin.call(`${childPath()}?${query(identity)}`)).status,200);
});
