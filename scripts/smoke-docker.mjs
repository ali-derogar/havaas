import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { playSession } from '../tests/helpers/play-session.mjs';
const project=`havaas-smoke-${process.pid}`,env={...process.env,POSTGRES_PASSWORD:randomBytes(24).toString('hex'),SESSION_SECRET:randomBytes(48).toString('hex'),APP_PORT:'4184',APP_ORIGIN:'http://127.0.0.1:4184',APP_BIND:'127.0.0.1'};
const args=['compose','-p',project,'-f','compose.yaml'];
function docker(tail,{input,quiet=false}={}){return new Promise((resolve,reject)=>{const child=spawn('docker',[...args,...tail],{env,stdio:['pipe','pipe','pipe']});const out=[],err=[];child.stdout.on('data',c=>out.push(c));child.stderr.on('data',c=>err.push(c));child.on('exit',code=>code===0?resolve(Buffer.concat(out)):reject(Error(`Docker command failed: ${Buffer.concat(err).toString()}`)));if(input)child.stdin.end(input);else child.stdin.end();});}
let cookie='',csrf;
async function api(path,{method='GET',body}={}){const response=await fetch('http://127.0.0.1:4184/api'+path,{method,headers:{Origin:env.APP_ORIGIN,Cookie:cookie,...(method!=='GET'?{'X-CSRF-Token':csrf||''}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=response.headers.getSetCookie()[0];if(set)cookie=set.split(';')[0];const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;assert.ok(response.ok,JSON.stringify(data));return data;}
try{
 await docker(['up','-d','--build','--wait','app']);const password='Disposable-smoke-password-2026!';await docker(['exec','-T','app','node','scripts/admin-create.mjs'],{input:JSON.stringify({username:'admin',email:'admin@example.test',name:'مدیر آزمون Docker',password})});
 await api('/auth/session');await api('/auth/login',{method:'POST',body:{identifier:'admin',password}});
 const overview=await api('/admin/dashboard?days=7');assert.equal(overview.totals.users,0);
 const invitation=await api('/registration-links',{method:'POST',body:{label:'دعوت آزمون Docker'}});
 await api('/public/registration/complete',{method:'POST',body:{token:invitation.url.split('/').at(-1),username:'smoke-user',password,profile:{firstName:'مراجع',lastName:'آزمون Docker',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'}}});const id=(await api('/bootstrap')).profiles[0].id;
 const run=await api(`/children/${id}/sessions`,{method:'POST',body:{gameId:'traffic',kind:'baseline'}});await api(`/children/${id}/sessions/${run.id}/complete`,{method:'POST',body:{result:playSession(run)}});
 await docker(['restart','db','app']);
 let ready=false;for(let attempt=0;attempt<40;attempt++){try{if((await fetch('http://127.0.0.1:4184/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'containers did not recover');assert.equal((await api(`/children/${id}/sessions`)).records[0].id,run.id);
 const backup=await docker(['exec','-T','db','pg_dump','-U','havaas','-d','havaas','-Fc','--no-owner']);assert.ok(backup.length>1000);
 await docker(['exec','-T','db','createdb','-U','havaas','havaas_restore_check']);await docker(['exec','-T','db','pg_restore','-U','havaas','-d','havaas_restore_check','--no-owner'],{input:backup});
 const restored=(await docker(['exec','-T','db','psql','-U','havaas','-d','havaas_restore_check','-Atc','SELECT count(*) FROM game_sessions WHERE result IS NOT NULL'])).toString().trim();assert.equal(restored,'1');
 console.log('Docker passed: fresh bootstrap, canonical session, app/database restart, persisted login/results, pg_dump and restore.');
}finally{await docker(['down','-v','--remove-orphans']);}
