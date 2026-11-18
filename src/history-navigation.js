// Restore the accepted history entry before asking, so cancelling Back also
// preserves the browser's Back/Forward positions.
export function createHistoryNavigation({window,history,location,needsConfirmation,confirm,navigate,onError}){
 const key='havaasIndex';
 let accepted={index:Number.isSafeInteger(history.state?.[key])?history.state[key]:0,hash:location.hash},restoring=null,authorized=null,asking=false;
 const tag=index=>history.replaceState?.({...history.state,[key]:index},'',location.href);
 tag(accepted.index);
 function accept(index){accepted={index,hash:location.hash};void Promise.resolve(navigate()).catch(onError);}
 function restore(index){
  if(!history.go){history.replaceState?.({[key]:accepted.index},'',accepted.hash||location.pathname);return Promise.resolve();}
  return new Promise(resolve=>{restoring=resolve;history.go(accepted.index-index);});
 }
 window.addEventListener('popstate',event=>{
  const index=Number.isSafeInteger(event.state?.[key])?event.state[key]:accepted.index+1;
  if(!Number.isSafeInteger(event.state?.[key]))tag(index);
  if(restoring){if(index===accepted.index){const done=restoring;restoring=null;done();}else history.go(accepted.index-index);return;}
  if(authorized===index){authorized=null;accept(index);return;}
  if(asking){void restore(index);return;}
  if(!needsConfirmation()){accept(index);return;}
  asking=true;
  void (async()=>{
   await restore(index);
   if(await confirm()){
    authorized=index;
    if(history.go)history.go(index-accepted.index);
   }
  })().catch(onError).finally(()=>{asking=false;});
 });
 return {push(hash){if(location.hash!==hash){accepted={index:accepted.index+1,hash};history.pushState({[key]:accepted.index},'',hash||location.pathname);}else accepted.hash=hash;}};
}
