import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {MessageChannel} from 'node:worker_threads';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createServiceWorker} from '../scripts/pwa.mjs';
import {createApp} from '../server/app.js';

const template=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');
function worker({failInstall=false,networkFails=false,clients=[],listClients=null}={}){
 const handlers={},stored=new Map(),deleted=[],messages=[];let skipped=false,network=0;
 const cache={addAll:async requests=>{assert.ok(requests.every(request=>request.credentials==='omit'));if(failInstall)throw Error('offline');},match:async key=>stored.get(key)?.clone()};
 const self={location:{origin:'https://havaas.test'},addEventListener:(name,fn)=>{handlers[name]=fn;},clients:{claim:async()=>{},matchAll:listClients||(async()=>clients)},skipWaiting:async()=>{skipped=true;}};
 const caches={open:async()=>cache,delete:async key=>{deleted.push(key);return true;},keys:async()=>['havaas-static-old','havaas-static-test','another-app-cache']};
 class LocalRequest extends Request{constructor(url,options){super(new URL(url,'https://havaas.test'),options);}}
 vm.runInNewContext(template.replace('__PWA_RELEASE__','test').replace('/* __PWA_ASSETS__ */ []',JSON.stringify(['/index.html','/offline.html','/src/app.js','/assets/guide.mp3'])),{self,caches,Request:LocalRequest,Response,Headers,URL,MessageChannel,setTimeout,clearTimeout,fetch:async()=>{network++;if(networkFails)throw Error('offline');return new Response('new shell');}});
 return {handlers,stored,deleted,messages,get skipped(){return skipped;},get network(){return network;}};
}
async function eventRun(handler,extra={}){let pending;handler({waitUntil:value=>{pending=value;},...extra});await pending;}
async function resource(w,path,{method='GET',mode='cors',range=null}={}){let result;w.handlers.fetch({request:{url:new URL(path,'https://havaas.test').href,method,mode,headers:new Headers(range?{Range:range}:{})},respondWith:promise=>{result=promise;}});return result===undefined?null:await result;}

test('PWA releases are deterministic and change with app content; private files and legacy paintings are excluded',async()=>{
 const root=await mkdtemp(join(tmpdir(),'havaas-pwa-'));
 try{
  await mkdir(join(root,'src'));await mkdir(join(root,'assets/worlds'),{recursive:true});
  for(const path of ['index.html','offline.html','manifest.webmanifest','src/app.js','assets/worlds/current.svg','assets/worlds/legacy.png'])await writeFile(join(root,path),path);
  await writeFile(join(root,'src/service-worker.js'),template);await writeFile(join(root,'.env'),'private');
  const first=await createServiceWorker(root);assert.equal(first,await createServiceWorker(root));assert.ok(first.includes('/assets/worlds/current.svg'));assert.ok(!first.includes('/assets/worlds/legacy.png'));assert.ok(!first.includes('/.env'));assert.ok(!first.includes('__PWA_RELEASE__'));
  await writeFile(join(root,'src/app.js'),'new release');assert.notEqual(first,await createServiceWorker(root));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('PWA installation is atomic and activation deletes only older app caches',async()=>{
 const failed=worker({failInstall:true});await assert.rejects(eventRun(failed.handlers.install),/offline/);assert.deepEqual(failed.deleted,['havaas-static-test']);
 const active=worker();await eventRun(active.handlers.install);assert.equal(active.skipped,false);await eventRun(active.handlers.activate);assert.deepEqual(active.deleted,['havaas-static-old']);
});
test('PWA never intercepts accounts, exports, writes, other origins or unknown static files',async()=>{
 const w=worker();for(const path of ['/api/auth/session','/api/bootstrap','/api/children/123/export','/health','/secret.json','https://other.test/src/app.js'])assert.equal(await resource(w,path),null,path);
 assert.equal(await resource(w,'/src/app.js',{method:'POST'}),null);assert.equal(w.network,0);
});
test('PWA serves a consistent cached release online and a public offline page after a failed navigation',async()=>{
 const w=worker();w.stored.set('/index.html',new Response('cached shell'));w.stored.set('/src/app.js',new Response('cached module'));
 assert.equal(await(await resource(w,'/',{mode:'navigate'})).text(),'cached shell');assert.equal(await(await resource(w,'/src/app.js')).text(),'cached module');
 const offline=worker({networkFails:true});offline.stored.set('/offline.html',new Response('offline page'));assert.equal(await(await resource(offline,'/?source=pwa',{mode:'navigate'})).text(),'offline page');
 assert.equal(await resource(offline,'/unknown',{mode:'navigate'}),null);
});
test('PWA cached audio supports byte ranges, suffixes and out-of-bounds responses',async()=>{
 const w=worker();w.stored.set('/assets/guide.mp3',new Response('0123456789',{headers:{'Content-Type':'audio/mpeg'}}));
 for(const [range,status,body,contentRange] of [['bytes=1-3',206,'123','bytes 1-3/10'],['bytes=-3',206,'789','bytes 7-9/10'],['bytes=8-',206,'89','bytes 8-9/10'],['bytes=99-',416,'','bytes */10']]){const response=await resource(w,'/assets/guide.mp3',{range});assert.equal(response.status,status);assert.equal(await response.text(),body);assert.equal(response.headers.get('Content-Range'),contentRange);}
});
test('PWA update waits for every open window and cancels prepared clients when one is busy',async()=>{
 const calls=[];
 const client=(id,ready)=>({id,postMessage(message,ports){calls.push([id,message.type]);if(ports){ports[0].postMessage({ready});ports[0].close();}}});
 const busy=worker({clients:[client('idle',true),client('playing',false)]});await eventRun(busy.handlers.message,{data:{type:'PWA_APPLY_UPDATE'},source:{id:'idle',postMessage:message=>calls.push(['source',message.type])}});assert.equal(busy.skipped,false);assert.ok(calls.some(([id,type])=>id==='idle'&&type==='PWA_CANCEL_UPDATE'));assert.ok(calls.some(([,type])=>type==='PWA_UPDATE_BLOCKED'));
 const ready=worker({clients:[client('idle',true),client('saved',true)]});await eventRun(ready.handlers.message,{data:{type:'PWA_APPLY_UPDATE'},source:{id:'idle',postMessage(){}}});assert.equal(ready.skipped,true);
});
test('PWA update does not activate if another window opens after the readiness check starts',async()=>{
 const calls=[],idle={id:'idle',postMessage(message,ports){calls.push(message.type);if(ports){ports[0].postMessage({ready:true});ports[0].close();}}},newcomer={id:'new-window',postMessage(){}};let listed=0;
 const w=worker({listClients:async()=>++listed===1?[idle]:[idle,newcomer]});
 await eventRun(w.handlers.message,{data:{type:'PWA_APPLY_UPDATE'},source:{id:'idle',postMessage:message=>calls.push(message.type)}});
 assert.equal(w.skipped,false);assert.ok(calls.includes('PWA_CANCEL_UPDATE'));assert.ok(calls.includes('PWA_UPDATE_BLOCKED'));
});
test('PWA public routes have the right types, worker scope, update headers and CSP without touching accounts',async()=>{
 let queries=0;const app=createApp({pool:{query(){queries++;throw Error('PWA files must not query accounts');}},secret:'pwa-static-test-secret-at-least-32-characters',production:false,staticRoot:resolve('.')});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const manifest=await fetch(base+'/manifest.webmanifest');assert.equal(manifest.status,200);assert.match(manifest.headers.get('Content-Type'),/application\/manifest\+json/);assert.equal((await manifest.json()).display,'standalone');
  const script=await fetch(base+'/sw.js');assert.equal(script.status,200);assert.match(script.headers.get('Content-Type'),/javascript/);assert.equal(script.headers.get('Service-Worker-Allowed'),'/');assert.equal(script.headers.get('Cache-Control'),'no-cache');assert.match(script.headers.get('Content-Security-Policy'),/worker-src 'self'/);assert.ok(!(await script.text()).includes('__PWA_RELEASE__'));
  const offline=await fetch(base+'/offline.html');assert.equal(offline.status,200);assert.match(await offline.text(),/برای ادامه/);assert.equal(offline.headers.get('Set-Cookie'),null);assert.equal(queries,0);
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
