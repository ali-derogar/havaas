// Inventory authored strings and verify that English covers every source fragment.
// This never scans user data or changes application source.
import {parse} from 'acorn';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {translate} from '../src/i18n.js';
const messages=new Set(),check=process.argv.includes('--check');
const hasFa=value=>/[\u0600-\u06ff]/.test(value);
async function visit(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=directory+'/'+entry.name;
  if(entry.isDirectory()){if(entry.name!=='locales')await visit(path);continue;}
  if(!path.endsWith('.js')||['i18n.js','guidance.js','theme.js','service-worker.js'].includes(entry.name))continue;
  const source=await readFile(path,'utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  function walk(node){
   if(!node||typeof node!=='object')return;
   if(node.type==='Literal'&&typeof node.value==='string'&&hasFa(node.value))messages.add(node.value);
   if(node.type==='TemplateLiteral')for(const part of node.quasis)if(hasFa(part.value.cooked))messages.add(part.value.cooked);
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }
  walk(ast);
 }
}
await visit('src');await visit('server');
const missing=[...messages].filter(value=>hasFa(translate(value,'en')));
if(check){console.log(`${messages.size} source fragments checked; ${missing.length} missing English translations.`);for(const text of missing)console.log(JSON.stringify(text));if(missing.length)process.exitCode=1;}
else{await writeFile('.local/translation-inventory.json',JSON.stringify([...messages].sort(),null,2)+'\n');console.log(`${messages.size} source fragments inventoried.`);}
