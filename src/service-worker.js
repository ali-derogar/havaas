// The build and development server replace these two values together.
const RELEASE='__PWA_RELEASE__';
const PRECACHE=/* __PWA_ASSETS__ */ [];
const PREFIX='havaas-static-',CACHE=PREFIX+RELEASE,ASSETS=new Set(PRECACHE);

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);await cache.addAll(PRECACHE.map(url=>new Request(url,{cache:'reload',credentials:'omit'})));}
  catch(error){await caches.delete(CACHE);throw error;}
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});

async function rangedResponse(request,response){
 const value=request.headers.get('Range');if(!value)return response;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||(!match[1]&&!match[2]))return response;
 const body=await response.arrayBuffer(),size=body.byteLength;
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');headers.delete('Content-Encoding');
 return new Response(body.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Account data, exports and all writes always go directly to the server.
 if(request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.has(url.pathname)&&!['/','/index.html'].includes(url.pathname))return;
 if(request.mode==='navigate'){
  if(!['/','/index.html','/offline.html'].includes(url.pathname))return;
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   if(url.pathname==='/offline.html')return await cache.match('/offline.html')||Response.error();
   try{const response=await fetch(request,{cache:'no-store'});if(response.ok)return await cache.match('/index.html')||response;}
   catch{/* The public offline page contains no account data. */}
   return await cache.match('/offline.html')||Response.error();
  })());return;
 }
 event.respondWith((async()=>{
  const response=await(await caches.open(CACHE)).match(url.pathname);
  return response?await rangedResponse(request,response):fetch(request);
 })());
});

function prepareClient(client){
 return new Promise(resolve=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},3000);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.ready===true);};
  try{client.postMessage({type:'PWA_PREPARE_UPDATE'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(false);}
 });
}
let applyingUpdate=false;
self.addEventListener('message',event=>{
 if(event.data?.type!=='PWA_APPLY_UPDATE'||applyingUpdate||!event.source?.id)return;
 applyingUpdate=true;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true}),ready=await Promise.all(clients.map(prepareClient));
  if(ready.length&&ready.every(Boolean)){await self.skipWaiting();return;}
  clients.forEach(client=>client.postMessage({type:'PWA_CANCEL_UPDATE'}));
  event.source.postMessage({type:'PWA_UPDATE_BLOCKED'});applyingUpdate=false;
 })().catch(async()=>{applyingUpdate=false;for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'PWA_CANCEL_UPDATE'});}));
});
