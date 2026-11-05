import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';

async function filesUnder(directory){
 const entries=await readdir(directory,{withFileTypes:true}),groups=await Promise.all(entries.filter(entry=>!entry.name.startsWith('.')).map(entry=>entry.isDirectory()?filesUnder(resolve(directory,entry.name)):entry.isFile()?[resolve(directory,entry.name)]:[]));
 return groups.flat();
}
export async function createServiceWorker(root){
 const template=await readFile(resolve(root,'src/service-worker.js'),'utf8');
 // The seven current worlds use SVGs; legacy painted backdrops need not make
 // every installation download the previous artwork collection as well.
 const files=[...['index.html','offline.html','manifest.webmanifest'].map(path=>resolve(root,path)),...(await Promise.all(['src','assets'].map(path=>filesUnder(resolve(root,path))))).flat()].filter(path=>path!==resolve(root,'src/service-worker.js')&&!(path.startsWith(resolve(root,'assets/worlds')+sep)&&/\.(png|jpe?g)$/i.test(path))).sort();
 const hash=createHash('sha256').update(template),assets=[];
 for(const path of files){const url='/'+relative(root,path).split(sep).map(encodeURIComponent).join('/');hash.update(url).update('\0').update(await readFile(path)).update('\0');assets.push(url);}
 const version=hash.digest('hex').slice(0,20);
 return template.replace('__PWA_RELEASE__',version).replace('/* __PWA_ASSETS__ */ []',JSON.stringify(assets));
}
