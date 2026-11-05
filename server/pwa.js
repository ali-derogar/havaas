import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServiceWorker} from '../scripts/pwa.mjs';

export function registerPwa(app,root){
 app.get('/sw.js',async(_req,res)=>{
  let script;try{script=await readFile(resolve(root,'sw.js'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;script=await createServiceWorker(root);}
  res.set({'Cache-Control':'no-cache','Service-Worker-Allowed':'/'}).type('application/javascript').send(script);
 });
 app.get('/manifest.webmanifest',(_req,res)=>res.set('Cache-Control','no-cache').type('application/manifest+json').sendFile(resolve(root,'manifest.webmanifest')));
 app.get('/offline.html',(_req,res)=>res.set('Cache-Control','no-cache').sendFile(resolve(root,'offline.html')));
}
