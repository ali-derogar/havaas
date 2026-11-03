// Rebuild local Persian guidance with espeak-ng and lame installed on the build host.
import { spawnSync } from 'node:child_process';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GUIDANCE } from '../src/guidance.js';
await mkdir('assets/audio',{recursive:true});
for(const [key,text] of Object.entries(GUIDANCE)){
  const wav=join(tmpdir(),`havaas-guide-${key}.wav`);
  for(const [command,args] of [['espeak-ng',['-v','fa','-s','140','-p','52','-w',wav,text]],['lame',['--silent','-m','m','-b','48',wav,`assets/audio/${key}.mp3`]]]){
    const result=spawnSync(command,args,{stdio:'inherit'});if(result.status!==0)throw Error(`Audio build failed: ${command}`);
  }
  await rm(wav,{force:true});
}
await writeFile('assets/audio/scripts.json',JSON.stringify({generator:'espeak-ng Persian (fa), 140 words/minute; MP3 encoding: lame, mono 48 kbps',scripts:GUIDANCE},null,2)+'\n');
console.log(`Generated ${Object.keys(GUIDANCE).length} local Persian guidance clips.`);
