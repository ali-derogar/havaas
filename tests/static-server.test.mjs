import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServiceWorker} from '../scripts/pwa.mjs';

const script=fileURLToPath(new URL('../scripts/serve.mjs',import.meta.url));
const template=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');

for(const built of [false,true])test(`static ${built?'build':'source'} serves every precached asset and both language manifests`,{timeout:10000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'havaas-static-')),root=built?join(directory,'dist'):directory;
 let child;
 try{
  await mkdir(join(root,'src'),{recursive:true});await mkdir(join(root,'assets'));
  for(const [path,content]of Object.entries({'index.html':'<h1>Havaas</h1>','offline.html':'<h1>Offline</h1>','manifest.webmanifest':'{"lang":"fa"}','manifest.en.webmanifest':'{"lang":"en"}','src/service-worker.js':template,'src/app.js':'export const app = true;','assets/test.svg':'<svg/>','.env':'private'}))await writeFile(join(root,path),content);
  if(built)await writeFile(join(root,'sw.js'),await createServiceWorker(root));
  child=spawn(process.execPath,[script,...(built?['--dist']:[])],{cwd:directory,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let output='';const address=await new Promise((resolve,reject)=>{
   child.on('error',reject);child.once('exit',code=>reject(Error(`Static server exited: ${code}`)));
   child.stdout.on('data',chunk=>{output+=chunk;const match=/http:\/\/localhost:(\d+)/.exec(output);if(match)resolve(`http://127.0.0.1:${match[1]}`);});
  });
  const worker=await fetch(address+'/sw.js');assert.equal(worker.status,200);
  const source=await worker.text(),assets=JSON.parse(/const PRECACHE=(\[[^\n]*\]);/.exec(source)[1]);
  assert.ok(assets.includes('/manifest.en.webmanifest'));
  for(const asset of assets){const response=await fetch(address+asset);assert.equal(response.status,200,asset);await response.body.cancel();}
  for(const locale of ['fa','en']){
   const response=await fetch(address+(locale==='en'?'/manifest.en.webmanifest':'/manifest.webmanifest'));
   assert.match(response.headers.get('Content-Type'),/application\/manifest\+json/);assert.equal((await response.json()).lang,locale);
  }
  for(const path of ['/.env','/package.json','/server/app.js']){const response=await fetch(address+path);assert.equal(response.status,404);await response.body.cancel();}
 }finally{
  if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
  await rm(directory,{recursive:true,force:true});
 }
});
