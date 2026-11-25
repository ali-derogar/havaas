import {createTestOutput} from './test-output.mjs';

export default async function* reporter(events){
 const chunks=[],output=createTestOutput('unit',{write:chunk=>chunks.push(chunk)});
 let passed=0,failed=0,skipped=0,cancelled=0;
 for await(const {type,data} of events){
  if(type==='test:pass'){if(data.skip||data.todo)skipped++;else passed++;}
  if(type==='test:fail'){
   if(data.details?.error?.failureType!=='subtestsFailed'){
    failed++;output.diagnostic(`FAIL ${data.name} (${data.file||''}:${data.line||''})`,data.details?.error);
   }
  }
  if(type==='test:stdout'||type==='test:stderr')output.diagnostic(`${type} ${data.file||''}`,data.message);
  if(type==='test:summary'&&data.file===undefined){
   passed=data.counts.passed;failed=data.counts.failed;skipped=data.counts.skipped+data.counts.todo;cancelled=data.counts.cancelled;
  }
  while(chunks.length)yield chunks.shift();
 }
 output.finish(`Tests: ${passed} passed, ${failed} failed, ${skipped} skipped, ${cancelled} cancelled.`);
 while(chunks.length)yield chunks.shift();
}
