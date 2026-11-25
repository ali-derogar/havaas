import {createTestOutput} from './test-output.mjs';

export default class CompactReporter{
 constructor(){this.output=createTestOutput('browser');this.passed=0;this.failed=0;this.skipped=0;}
 printsToStdio(){return true;}
 onBegin(_config,suite){process.stdout.write(`Browser tests: ${suite.allTests().length} selected.\n`);}
 onTestEnd(test,result){
  if(result.status==='skipped'){this.skipped++;return;}
  if(result.status===test.expectedStatus){this.passed++;return;}
  this.failed++;this.output.diagnostic(`FAIL ${test.titlePath().join(' > ')} (${test.location.file}:${test.location.line})`,result.errors?.length?result.errors:{message:`Unexpected status: ${result.status}`});
 }
 onError(error){this.output.diagnostic('Browser runner error',error);}
 onStdOut(chunk){this.output.diagnostic('Browser stdout',String(chunk));}
 onStdErr(chunk){this.output.diagnostic('Browser stderr',String(chunk));}
 onEnd(result){
  if(result.status==='passed'&&this.passed+this.failed+this.skipped===0){this.output.finish('Browser test discovery complete; no tests executed.');return;}
  this.output.finish(`Browser tests: ${result.status}; ${this.passed} passed, ${this.failed} failed, ${this.skipped} skipped.`);
 }
}
