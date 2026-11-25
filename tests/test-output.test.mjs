import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createTestOutput} from '../scripts/test-output.mjs';
import CompactReporter from '../scripts/playwright-reporter.mjs';

test('large assertion messages and repeated failures stay bounded while complete diagnostics are saved',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'havaas-test-output-')),chunks=[];
 try{
  const output=createTestOutput('fixture',{directory,write:chunk=>chunks.push(chunk)}),message='large HTML '.repeat(10000)+'END-OF-DIAGNOSTIC';
  for(let i=0;i<12;i++)output.diagnostic(`FAIL ${i}`,new Error(message));
  output.finish('12 failed');
  const text=chunks.join('');
  assert.ok(text.length<6500);assert.ok(text.includes('12 failed'));assert.ok(text.includes('7 additional diagnostics'));
  const log=await readFile(join(directory,(await readdir(directory))[0]),'utf8');
  assert.equal(log.split('END-OF-DIAGNOSTIC').length-1,12);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('browser error arrays show the first useful message and retain every error in the log',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'havaas-browser-output-')),chunks=[];
 try{
  const output=createTestOutput('browser',{directory,write:chunk=>chunks.push(chunk)});
  output.diagnostic('FAIL browser case',[{message:'Button timed out'},{message:'Additional browser error'}]);
  assert.ok(chunks.join('').includes('Button timed out'));
  const log=await readFile(join(directory,(await readdir(directory))[0]),'utf8');
  assert.ok(log.includes('Additional browser error'));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('the Node reporter preserves failed exit status, counts and a useful error without dumping source',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'havaas-test-reporter-'));
 try{
  await writeFile(join(directory,'fixture.mjs'),`import test from 'node:test';import assert from 'node:assert/strict';
test('passes',()=>{});test.skip('skips',()=>{});test('fails',()=>assert.match('x'.repeat(50000),/expected/));`);
  const reporter=fileURLToPath(new URL('../scripts/test-reporter.mjs',import.meta.url));
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test',`--test-reporter=${reporter}`,'fixture.mjs'],{cwd:directory,env,encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.equal(result.stderr,'');
  assert.ok(result.stdout.length<2500);assert.ok(result.stdout.includes('FAIL fails'));assert.ok(result.stdout.includes('1 passed, 1 failed, 1 skipped'));
  const logs=await readdir(join(directory,'.local/test-logs'));assert.equal(logs.length,1);
  assert.ok((await readFile(join(directory,'.local/test-logs',logs[0]),'utf8')).includes('x'.repeat(50000)));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('the browser reporter summarizes failures and accepts expected failures without launching a browser',()=>{
 const reporter=new CompactReporter(),events=[];
 reporter.output={diagnostic:(...args)=>events.push(args),finish:summary=>events.push(summary)};
 const entry={titlePath:()=>['suite','case'],location:{file:'fixture.mjs',line:2},expectedStatus:'passed'};
 reporter.onTestEnd(entry,{status:'passed'});
 reporter.onTestEnd(entry,{status:'skipped'});
 reporter.onTestEnd({...entry,expectedStatus:'failed'},{status:'failed'});
 reporter.onTestEnd(entry,{status:'timedOut',errors:[{message:'Timed out waiting for button'}]});
 reporter.onEnd({status:'failed'});
 assert.equal(events[0][1][0].message,'Timed out waiting for button');
 assert.equal(events[1],'Browser tests: failed; 2 passed, 1 failed, 1 skipped.');
});
