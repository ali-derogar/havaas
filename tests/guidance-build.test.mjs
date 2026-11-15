import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {GUIDANCE} from '../src/guidance.js';

test('duplicate guidance keys cannot bypass the full-pack guard or partially replace an audio package',async()=>{
 const taskRoot=await mkdtemp(join(tmpdir(),'havaas-voice-keys-')),output=join(taskRoot,'audio');
 try{
  const keys=Array(Object.keys(GUIDANCE).length).fill('traffic').join(',');
  const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/generate-guidance.mjs',import.meta.url)),'--only',keys,'--output',output],{encoding:'utf8',env:{...process.env,EDGE_TTS_BIN:join(taskRoot,'must-not-run')}});
  assert.equal(run.status,1);assert.match(run.stderr,/Guidance keys must be unique/);assert.equal(existsSync(output),false,'invalid selections must fail before touching an output package');
 }finally{await rm(taskRoot,{recursive:true,force:true});}
});
