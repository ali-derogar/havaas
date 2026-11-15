// Build-time network access only; the game plays these MP3 files locally.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {GUIDANCE,GUIDANCE_VOICE,guidanceRate} from '../src/guidance.js';

const {values}=parseArgs({options:{output:{type:'string'},only:{type:'string'},preview:{type:'boolean',default:false}}});
const keys=values.only?values.only.split(','):values.preview?['traffic','nback-2','water']:Object.keys(GUIDANCE);
if(keys.some(key=>!Object.hasOwn(GUIDANCE,key)))throw Error('Unknown guidance key.');
if(new Set(keys).size!==keys.length)throw Error('Guidance keys must be unique.');
if((values.preview||values.only)&&!values.output)values.output='.local/voice-preview';
const output=resolve(values.output||'assets/audio'),{voice,rate,pitch}=GUIDANCE_VOICE;
if(keys.length!==Object.keys(GUIDANCE).length&&output===resolve('assets/audio'))throw Error('Partial builds must use a separate output directory.');
const command=process.env.EDGE_TTS_BIN||'edge-tts';
await mkdir(output,{recursive:true});
const staging=await mkdtemp(join(output,'.voice-build-'));
function generate(key,text,path){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,['--voice',voice,`--rate=${guidanceRate(key)}`,`--pitch=${pitch}`,'--text',text,'--write-media',path],{stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',chunk=>{error=(error+chunk).slice(-1500);});
    const timer=setTimeout(()=>child.kill('SIGTERM'),45000);
    child.once('error',failure=>{clearTimeout(timer);reject(failure);});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Neural voice generation failed (${code}): ${error}`));});
  });
}
try{
  for(const [index,key] of keys.entries()){
    const text=GUIDANCE[key];
    const path=join(staging,`${key}.mp3`);
    for(let attempt=0;;attempt++){
      try{await generate(key,text,path);if((await readFile(path)).length<1500)throw Error(`Empty audio: ${key}`);break;}
      catch(error){if(error.code==='ENOENT')throw Error('Install scripts/voice-requirements.txt and set EDGE_TTS_BIN to the edge-tts executable.');if(attempt===2)throw error;}
    }
    console.log(`${index+1}/${keys.length}: ${key}`);
  }
  const manifest={generator:'Microsoft Edge neural Persian via edge-tts 7.3.1',revision:2,voice,rate,pitch,rates:Object.fromEntries(keys.map(key=>[key,guidanceRate(key)])),encoding:'MP3, mono, 24 kHz, 48 kbps',scripts:Object.fromEntries(keys.map(key=>[key,GUIDANCE[key]]))};
  await writeFile(join(staging,'scripts.json'),JSON.stringify(manifest,null,2)+'\n');
  // Keep the existing voice pack intact until every replacement is generated.
  for(const file of [...keys.map(key=>`${key}.mp3`),'scripts.json'])await rename(join(staging,file),join(output,file));
  console.log(`Generated ${keys.length} Persian neural guidance clips.`);
}finally{await rm(staging,{recursive:true,force:true});}
