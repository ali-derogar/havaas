import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { playSession } from '../tests/helpers/play-session.mjs';
const project=`havaas-smoke-${process.pid}`,env={...process.env,POSTGRES_PASSWORD:randomBytes(24).toString('hex'),SESSION_SECRET:randomBytes(48).toString('hex'),APP_PORT:'4184',APP_ORIGIN:'http://127.0.0.1:4184',APP_BIND:'127.0.0.1'};
await mkdir('.local',{recursive:true});await writeFile('.local/compose.smoke.yaml','services:\n  app:\n    image: havaas-app:latest\n');
const args=['compose','-p',project,'-f','compose.yaml','-f','.local/compose.smoke.yaml'];
function docker(tail,{input,quiet=false}={}){return new Promise((resolve,reject)=>{const child=spawn('docker',[...args,...tail],{env,stdio:['pipe','pipe','pipe']});const out=[],err=[];child.stdout.on('data',c=>out.push(c));child.stderr.on('data',c=>err.push(c));child.on('exit',code=>code===0?resolve(Buffer.concat(out)):reject(Error(`Docker command failed: ${Buffer.concat(err).toString()}`)));if(input)child.stdin.end(input);else child.stdin.end();});}
let cookie='',csrf;
async function api(path,{method='GET',body}={}){const response=await fetch('http://127.0.0.1:4184/api'+path,{method,headers:{Cookie:cookie,...(method!=='GET'?{'X-CSRF-Token':csrf||''}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=response.headers.getSetCookie()[0];if(set)cookie=set.split(';')[0];const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;assert.ok(response.ok,JSON.stringify(data));return data;}
try{
 await docker(['up','-d','--wait','app']);const password='Disposable-smoke-password-2026!';await docker(['exec','-T','app','node','scripts/admin-create.mjs'],{input:JSON.stringify({email:'admin@example.test',name:'مدیر آزمون Docker',password})});
 await api('/auth/session');await api('/auth/login',{method:'POST',body:{email:'admin@example.test',password}});const invite=await api('/invitations',{method:'POST',body:{email:'therapist@example.test',role:'therapist'}});const token=invite.url.split('/').at(-1);await api('/invitations/accept',{method:'POST',body:{token,name:'درمانگر آزمون Docker',password}});
 const auth=await api('/auth/session');const child=await api('/children',{method:'POST',body:{firstName:'مراجع',lastName:'آزمون Docker',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'disposable smoke test'}});const id=child.profile.id;
 const run=await api(`/children/${id}/sessions`,{method:'POST',body:{gameId:'traffic',kind:'baseline'}});await api(`/children/${id}/sessions/${run.id}/complete`,{method:'POST',body:{result:playSession(run)}});
 await docker(['restart','db','app']);
 let ready=false;for(let attempt=0;attempt<40;attempt++){try{if((await fetch('http://127.0.0.1:4184/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'containers did not recover');assert.equal((await api(`/children/${id}/sessions`)).records[0].id,run.id);
 const backup=await docker(['exec','-T','db','pg_dump','-U','havaas','-d','havaas','-Fc','--no-owner']);assert.ok(backup.length>1000);
 await docker(['exec','-T','db','createdb','-U','havaas','havaas_restore_check']);await docker(['exec','-T','db','pg_restore','-U','havaas','-d','havaas_restore_check','--no-owner'],{input:backup});
 const restored=(await docker(['exec','-T','db','psql','-U','havaas','-d','havaas_restore_check','-Atc','SELECT count(*) FROM game_sessions WHERE result IS NOT NULL'])).toString().trim();assert.equal(restored,'1');
 console.log('Docker passed: fresh bootstrap, canonical session, app/database restart, persisted login/results, pg_dump and restore.');
}finally{await docker(['down','-v','--remove-orphans']);}
