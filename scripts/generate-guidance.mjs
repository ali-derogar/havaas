// Build-time network access only; the game plays these MP3 files locally.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {GUIDANCE} from '../src/guidance.js';

const output=resolve('assets/audio'),voice='fa-IR-DilaraNeural',rate='-6%';
const command=process.env.EDGE_TTS_BIN||'edge-tts';
await mkdir(output,{recursive:true});
const staging=await mkdtemp(join(output,'.voice-build-'));
function generate(text,path){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,['--voice',voice,`--rate=${rate}`,'--text',text,'--write-media',path],{stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',chunk=>{error=(error+chunk).slice(-1500);});
    const timer=setTimeout(()=>child.kill('SIGTERM'),45000);
    child.once('error',failure=>{clearTimeout(timer);reject(failure);});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Neural voice generation failed (${code}): ${error}`));});
  });
}
try{
  for(const [index,[key,text]] of Object.entries(GUIDANCE).entries()){
    const path=join(staging,`${key}.mp3`);
    for(let attempt=0;;attempt++){
      try{await generate(text,path);if((await readFile(path)).length<1500)throw Error(`Empty audio: ${key}`);break;}
      catch(error){if(error.code==='ENOENT')throw Error('Install scripts/voice-requirements.txt and set EDGE_TTS_BIN to the edge-tts executable.');if(attempt===2)throw error;}
    }
    console.log(`${index+1}/${Object.keys(GUIDANCE).length}: ${key}`);
  }
  const manifest={generator:'Microsoft Edge neural Persian via edge-tts 7.3.1',voice,rate,encoding:'MP3, mono, 24 kHz, 48 kbps',scripts:GUIDANCE};
  await writeFile(join(staging,'scripts.json'),JSON.stringify(manifest,null,2)+'\n');
  // Keep the existing voice pack intact until every replacement is generated.
  for(const file of [...Object.keys(GUIDANCE).map(key=>`${key}.mp3`),'scripts.json'])await rename(join(staging,file),join(output,file));
  console.log(`Generated ${Object.keys(GUIDANCE).length} Persian neural guidance clips.`);
}finally{await rm(staging,{recursive:true,force:true});}
