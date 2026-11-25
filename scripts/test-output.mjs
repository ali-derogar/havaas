import {mkdirSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {inspect} from 'node:util';

// Keep large HTML/SVG assertion diffs and browser call logs out of the terminal.
// The original diagnostics remain available in the ignored local directory.
export function createTestOutput(label,{write=chunk=>process.stdout.write(chunk),directory='.local/test-logs'}={}){
 const path=join(directory,`${label}-${Date.now()}-${process.pid}.log`);
 let logged=false,shown=0;
 const short=(value,max)=>{const text=String(value??'').replace(/\x1b\[[0-9;]*m/g,'');return text.length>max?text.slice(0,max)+' … [truncated]':text;};
 return {
  diagnostic(title,detail){
   if(!logged){mkdirSync(directory,{recursive:true});logged=true;}
   appendFileSync(path,`${title}\n${typeof detail==='string'?detail:inspect(detail,{depth:8,maxStringLength:Infinity,maxArrayLength:Infinity,colors:false})}\n\n`);
   if(shown++<5){
    const error=Array.isArray(detail)?detail[0]:detail?.cause||detail;
    const message=error?.message||error?.stack||error;
    const frames=typeof error?.stack==='string'?error.stack.split('\n').filter(line=>/^\s+at /.test(line)).slice(0,2).map(line=>short(line,200)).join('\n'):'';
    write(`${short(title,220)}\n${short(message,650)}\n${frames?frames+'\n':''}`);
   }
  },
  finish(summary){
   write(`${summary}\n`);
   if(logged)write(`Full diagnostics: ${path}${shown>5?` (${shown-5} additional diagnostics omitted from terminal)`:''}\n`);
  }
 };
}
