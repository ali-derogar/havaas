// One-time source migration and a repeatable translation coverage inventory.
import {parse} from 'acorn';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {relative,dirname,resolve} from 'node:path';
const apply=process.argv.includes('--apply'),messages=new Set();
const hasFa=value=>/[\u0600-\u06ff]/.test(value);
const chunks=/[\u0600-\u06ff][\u0600-\u06ff\u200c\u200f\s؛،؟«»…:.!()٬٫٪0-9\-–—+\/]*[\u0600-\u06ff؟.!…»)]?/gu;
function collect(value){if(!hasFa(value))return;if(!/<\/?[a-z]/i.test(value))messages.add(value);for(const part of value.match(chunks)||[])if(part.trim())messages.add(part.trim());}
async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=directory+'/'+entry.name;if(entry.isDirectory()){if(entry.name!=='locales')await visit(path);continue;}if(!path.endsWith('.js')||['i18n.js','theme.js','service-worker.js'].includes(entry.name))continue;
 const source=await readFile(path,'utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'}),edits=[],imports=new Set();
 const canEdit=directory.startsWith('src')&&entry.name!=='guidance.js';
 function walk(node,ancestors=[]){if(!node||typeof node!=='object')return;
  const parent=ancestors.at(-1),insideFunction=ancestors.some(value=>/Function|MethodDefinition/.test(value.type));
  if(node.type==='VariableDeclarator'&&!insideFunction&&['ObjectExpression','ArrayExpression'].includes(node.init?.type)&&hasFa(source.slice(node.init.start,node.init.end))&&node.id.name!=='STROOP_RULES'){
   // Lazy labels remain live when the language changes without reloading a form.
   if(canEdit&&parent?.type==='VariableDeclaration'&&!source.slice(Math.max(0,node.init.start-12),node.init.start).includes('localized(')){edits.push([node.init.start,node.init.start,'localized('],[node.init.end,node.init.end,')']);imports.add('localized');}
  }
  if(node.type==='Literal'&&typeof node.value==='string'&&hasFa(node.value)){
   collect(node.value);
   if(canEdit&&insideFunction&&!(parent?.type==='Property'&&parent.key===node)&&!(parent?.type==='CallExpression'&&['t','translate'].includes(parent.callee?.name))){edits.push([node.start,node.end,`t(${source.slice(node.start,node.end)})`]);imports.add('t');}
  }
  if(node.type==='TemplateLiteral'){
   const pattern=node.quasis.map((part,i)=>part.value.cooked+(i<node.expressions.length?`{${i}}`:'')).join('');collect(pattern);for(const part of node.quasis)collect(part.value.cooked);
   if(canEdit&&node.quasis.some(part=>hasFa(part.value.cooked))&&parent?.type!=='TaggedTemplateExpression'){edits.push([node.start,node.start,'lt']);imports.add('lt');}
  }
  for(const [key,value]of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>walk(child,[...ancestors,node]));else if(value&&typeof value==='object')walk(value,[...ancestors,node]);}
 }
 walk(ast);
 if(apply&&edits.length){let output=source;for(const[start,end,value]of edits.sort((a,b)=>b[0]-a[0]||b[1]-a[1]))output=output.slice(0,start)+value+output.slice(end);let module=relative(dirname(path),resolve('src/i18n.js')).replaceAll('\\','/');if(!module.startsWith('.'))module='./'+module;output=`import {${[...imports].join(',')}} from '${module}';\n`+output;await writeFile(path,output);}
}}
await visit('src');await visit('server');
await writeFile('.local/translation-inventory.json',JSON.stringify([...messages].sort(),null,2));
console.log(`${messages.size} authored translation keys inventoried${apply?'; source migration applied':''}.`);
