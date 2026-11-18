import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {testDatabase,seedAccounts} from './helpers/database.mjs';
import {playSession} from './helpers/play-session.mjs';
import {createProfileSettings,profileEntry,validateProfileSettings} from '../src/training-profiles.js';
import {migrate} from '../server/db.js';
const source=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let db,seed,server,base,admin,user,a,b;
class Client{
 cookie='';csrf='';
 async call(path,method='GET',body){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:this.cookie,...(method!=='GET'?{'X-CSRF-Token':this.csrf,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];const data=await response.json();if(data.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data};
 }
 async login(key){await this.call('/auth/session');assert.equal((await this.call('/auth/login','POST',{identifier:seed.users[key].username,password:seed.password})).status,200);return this;}
}
before(async()=>{if(!source)return;db=await testDatabase(source,`havaas_profiles_${process.pid}`);seed=await seedAccounts(db.pool);server=createApp({pool:db.pool,secret:'training-profiles-test-secret-at-least-thirty-two-characters',loginLimit:200}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;admin=await new Client().login('admin');user=await new Client().login('user');});
after(async()=>{if(!db)return;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.close();});
const apiTest=(name,fn)=>test(name,{skip:!source},fn),catalog='/admin/training-profiles';
const settingsFor=child=>`/children/${child}/difficulty`;
async function assign(gameId,profileId,extra={},child=seed.children[0].id){const current=(await admin.call(settingsFor(child))).data.settings.find(setting=>setting.gameId===gameId&&setting.variant===(extra.trafficMode==='signs'?'signs':'standard'));return admin.call(settingsFor(child),'PATCH',{gameId,trainingProfileId:profileId,expectedRevision:current?.revision||0,...extra});}
async function start(gameId,kind='training',version=3){const response=await user.call(`/children/${seed.children[0].id}/sessions`,'POST',{gameId,kind,clientExperienceVersion:version});assert.equal(response.status,201,JSON.stringify(response.data));return response.data;}
async function complete(run){const response=await user.call(`/children/${seed.children[0].id}/sessions/${run.id}/complete`,'POST',{result:{...playSession(run),trainingProfile:{name:'forged',revision:999}}});assert.equal(response.status,200,JSON.stringify(response.data));return response.data.record;}
apiTest('profile catalog contains three complete defaults and validates named seven-game profiles',async()=>{
 const list=await admin.call(catalog);assert.equal(list.status,200);assert.equal(list.data.profiles.length,3);
 for(const level of ['easy','medium','hard']){const profile=(await admin.call(`${catalog}/builtin:${level}`)).data.profile;assert.deepEqual(validateProfileSettings(profile.settings),createProfileSettings(level));}
 assert.equal((await user.call(catalog)).status,403);assert.equal((await user.call(catalog,'POST',{name:'ممنوع',settings:createProfileSettings()})).status,403);
 for(const settings of [[],createProfileSettings().slice(1),[...createProfileSettings(),createProfileSettings()[0]]])assert.equal((await admin.call(catalog,'POST',{name:'ناقص',settings})).status,400);
 const first=await admin.call(catalog,'POST',{name:'سخت کودکان تا ۶ سال',description:'انتخاب ادمین؛ بدون محدودیت سنی',settings:createProfileSettings('hard')});assert.equal(first.status,201);a=first.data.profile;
 const second=await admin.call(catalog,'POST',{name:'سخت کودکان تا ۱۰ سال',settings:createProfileSettings('hard')});assert.equal(second.status,201);b=second.data.profile;
 assert.equal((await admin.call(catalog,'POST',{name:a.name,settings:a.settings})).status,409);
 const before=Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),noop=await admin.call(`${catalog}/${a.id}`,'PATCH',{...a,expectedRevision:a.revision});assert.equal(noop.status,200);assert.equal(noop.data.profile.revision,a.revision);assert.equal(Number((await db.pool.query('SELECT count(*) FROM audit_events')).rows[0].count),before);
});
apiTest('profile assignments are fixed, scoped to a game and mode, and available regardless of age',async()=>{
 for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop'])await complete(await start(gameId,'baseline'));
 const legacyRun=await start('traffic','training',2);
 assert.equal((await assign('traffic',a.id,{mode:'adaptive'})).status,200);await complete(legacyRun);assert.equal((await assign('ark',b.id)).status,200);
 const settings=(await user.call(settingsFor(seed.children[0].id))).data.settings;assert.equal(settings.find(setting=>setting.gameId==='traffic').mode,'fixed');assert.equal(settings.find(setting=>setting.gameId==='traffic').trainingProfile.name,a.name);assert.equal(settings.find(setting=>setting.gameId==='ark').trainingProfile.id,b.id);assert.equal(settings.find(setting=>setting.gameId==='space').trainingProfileId,null);
 const unrelated=(await admin.call(settingsFor(seed.children[1].id))).data.settings;assert.equal(unrelated.length,0);
 assert.equal((await admin.call(settingsFor(seed.children[0].id),'PATCH',{gameId:'traffic',level:'easy',mode:'adaptive'})).status,409);
 for(const version of [1,2])assert.equal((await user.call(`/children/${seed.children[0].id}/sessions`,'POST',{gameId:'traffic',kind:'training',clientExperienceVersion:version})).status,409);
 const run=await start('traffic');assert.equal(run.settings.level,'hard');assert.equal(run.settings.trainingProfile.name,a.name);const record=await complete(run);assert.equal(record.result.trainingProfile.name,a.name);assert.equal((await user.call(settingsFor(seed.children[0].id))).data.settings.find(setting=>setting.gameId==='traffic').level,'hard');
 const signs=await user.call(`/children/${seed.children[0].id}/game-timings?gameId=traffic&variant=signs`);assert.equal(signs.data.trainingProfile,undefined);
});
apiTest('live profile edits affect the next session while snapshots, reports and free-practice timing remain stable',async()=>{
 const old=await start('traffic'),settings=structuredClone(a.settings),entry=profileEntry(settings,'traffic');entry.level='medium';entry.timings.standard={visibleMs:1350,intervalMs:2350};
 const edited=await admin.call(`${catalog}/${a.id}`,'PATCH',{name:'متوسط کودکان تا ۶ سال',settings,expectedRevision:a.revision});assert.equal(edited.status,200);a=edited.data.profile;
 const oldResult=await complete(old);assert.equal(oldResult.result.trainingProfile.name,'سخت کودکان تا ۶ سال');assert.equal(oldResult.result.level,'hard');
 const next=await start('traffic');assert.equal(next.settings.level,'medium');assert.deepEqual(next.settings.timing,{visibleMs:1350,intervalMs:2350});assert.equal(next.settings.trainingProfile.revision,a.revision);await complete(next);
 const practice=await user.call(`/children/${seed.children[0].id}/game-timings?gameId=traffic`);assert.equal(practice.data.effectiveLevel,'medium');assert.deepEqual(practice.data.levels.find(row=>row.level==='medium').timing,next.settings.timing);
 const bootstrap=await user.call('/bootstrap?view=panel');assert.equal(bootstrap.data.difficulties.find(setting=>setting.gameId==='traffic').level,'medium');
 const report=await user.call(`/children/${seed.children[0].id}/reports?view=panel&recordId=${next.id}`);assert.equal(report.data.selected.result.trainingProfile.name,a.name);assert.equal(report.data.selected.result.trainingProfile.id,undefined);
 const conflict=await admin.call(`${catalog}/${a.id}`,'PATCH',{name:'تعارض',expectedRevision:1});assert.equal(conflict.status,409);
});
apiTest('archiving retains existing assignments, refuses new ones, and restoring is revision guarded',async()=>{
 const archived=await admin.call(`${catalog}/${a.id}`,'PATCH',{archived:true,expectedRevision:a.revision});assert.equal(archived.status,200);a=archived.data.profile;
 assert.equal((await assign('space',a.id)).status,409);assert.equal((await assign('traffic',a.id)).status,200);assert.equal((await start('traffic')).settings.trainingProfile.id,a.id);
 const restored=await admin.call(`${catalog}/${a.id}`,'PATCH',{archived:false,expectedRevision:a.revision});assert.equal(restored.status,200);a=restored.data.profile;
 const events=await admin.call('/admin/audit-events?action=training_profiles.updated');assert.equal(events.status,200);assert.ok(events.data.events.some(event=>event.actorId===seed.users.admin.id));
});
apiTest('default selection replaces legacy timing only for that game; default edits are live and custom copies stay independent',async()=>{
 const child=seed.children[0].id,path=`/children/${child}/game-timings`,timingKey={gameId:'traffic',variant:'standard',timingFamily:'standard',level:'hard'};
 assert.equal((await admin.call(path,'PATCH',{...timingKey,timing:{visibleMs:2000,intervalMs:3000},expectedRevision:0})).status,200);
 const legacyActive=await start('traffic');
 assert.equal((await assign('traffic',null,{level:'hard',mode:'adaptive'})).status,200);
 const builtin=(await admin.call(`${catalog}/builtin:hard`)).data.profile,settings=structuredClone(builtin.settings);profileEntry(settings,'traffic').timings.standard={visibleMs:1450,intervalMs:2450};
 const updated=await admin.call(`${catalog}/builtin:hard`,'PATCH',{settings,expectedRevision:builtin.revision});assert.equal(updated.status,200);assert.ok(updated.data.profile.revision>builtin.revision);
 assert.equal((await admin.call(`${catalog}/builtin:hard`,'PATCH',{settings,expectedRevision:builtin.revision})).status,409);
 const fresh=await start('traffic');assert.deepEqual(fresh.settings.timing,{visibleMs:1450,intervalMs:2450});assert.equal(fresh.settings.trainingProfile,undefined);assert.equal((await admin.call(path+'?gameId=traffic')).data.levels.find(row=>row.level==='hard').override,null);
 const independent=(await admin.call(`${catalog}/${a.id}`)).data.profile;assert.deepEqual(profileEntry(independent.settings,'traffic').timings.standard,{visibleMs:1350,intervalMs:2350});assert.equal((await user.call(settingsFor(child))).data.settings.find(setting=>setting.gameId==='ark').trainingProfile.id,b.id);
 await complete(legacyActive);await migrate(db.pool);assert.equal((await admin.call(catalog)).status,200);
});
apiTest('each of the seven engines uses its own entry in one profile and preserves the profile in exports',async()=>{
 for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop']){
  assert.equal((await assign(gameId,a.id)).status,200);const run=await start(gameId),entry=profileEntry(a.settings,gameId);assert.equal(run.settings.level,entry.level);const record=await complete(run);assert.equal(record.result.trainingProfile.name,a.name);assert.equal(record.result.completed,true);
 }
 const child=seed.children[0].id,exported=await admin.call(`/children/${child}/export`),preview=await admin.call('/imports/preview','POST',{document:exported.data});assert.equal(preview.status,200);assert.deepEqual(preview.data.errors,[]);
 const report=await user.call(`/children/${child}/reports?view=panel`);assert.equal(report.data.selected.result.trainingProfile.name,a.name);assert.equal(report.data.selected.result.trainingProfile.id,undefined);
});
