const guardedIds=new Set(['edit-user-form','profile-form','admin-difficulty-form','training-profile-form','create-user-form','report-link-form','registration-link-form','invitation-form','password-form','registration-form']);
const fields=form=>[...form.querySelectorAll('input,textarea,select')];
const fieldKey=(node,index)=>node.name||node.getAttribute('data-birth-part')||String(index);
export function createNavigationGuard({document,tracker,identity,prepareDraft=()=>{},onSaveError=()=>{}}){
 let known=new WeakMap(),drafts=new Map(),asking=null,cancelPending=null;
 const forms=()=>[...document.querySelectorAll('form')].filter(form=>guardedIds.has(form.id));
 const dirty=form=>form.dataset.acknowledged!=='true'&&tracker.isDirty(form);
 function sync(){
  for(const form of forms())if(!known.has(form)){
   const key=identity()+':'+form.id+':'+(form.dataset.user||'');known.set(form,key);tracker.remember(form);
   const draft=drafts.get(key);if(draft){
    prepareDraft(form,draft.values);
    fields(form).forEach((node,index)=>{const value=draft.values[fieldKey(node,index)];if(value!==undefined)node.value=value;});
    for(const [name,value] of Object.entries(draft.versions))form.dataset[name]=value;
   }
  }
 }
 function stash(){
  sync();for(const form of forms()){
   const key=known.get(form);if(!dirty(form)){drafts.delete(key);continue;}
   const values={};fields(form).forEach((node,index)=>{if(node.type!=='password'&&!/password|token/i.test(node.name||''))values[fieldKey(node,index)]=node.value;});
   drafts.set(key,{values,versions:Object.fromEntries(['revision','profileRevision'].filter(key=>form.dataset[key]).map(key=>[key,form.dataset[key]]))});
  }
 }
 function acknowledge(form,submission){tracker.saved(form,submission);drafts.delete(known.get(form));if(tracker.isDirty(form))delete form.dataset.acknowledged;else form.dataset.acknowledged='true';}
 const hasChanges=()=>{sync();return Boolean(asking)||forms().some(form=>form.dataset.waiting==='true'&&form.dataset.acknowledged!=='true'||dirty(form));};
 function allow(save){
  if(asking)return asking;
  sync();const changed=forms().filter(form=>form.dataset.waiting==='true'&&form.dataset.acknowledged!=='true'||dirty(form));if(!changed.length)return Promise.resolve(true);
  const waiting=changed.some(form=>form.dataset.waiting==='true'),previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='navigation-confirm';dialog.setAttribute('aria-labelledby','navigation-confirm-title');
  dialog.innerHTML=`<h2 id="navigation-confirm-title">${waiting?'در حال ثبت اطلاعات':'تغییرات ذخیره نشده‌اند'}</h2><p>${waiting?'اطلاعات در حال ذخیره‌شدن است؛ کمی صبر کنید.':'تغییراتتان هنوز ذخیره نشده. می‌خواهید آن‌ها را ذخیره کنید یا بدون ذخیره ادامه دهید؟'}</p><p class="form-error" role="alert"></p><div class="modal-buttons"><button class="button primary" data-guard="stay" autofocus>ماندن در این صفحه</button>${waiting?'':'<button class="button subtle" data-guard="save">ذخیره و ادامه</button><button class="text-button danger" data-guard="discard">ادامه بدون ذخیره</button>'}</div>`;
  document.body.append(dialog);
  asking=new Promise(resolve=>{
   let settled=false;
   const finish=allowed=>{if(settled)return;settled=true;cancelPending=null;dialog.close?.();dialog.remove();asking=null;previous?.focus?.({preventScroll:true});resolve(allowed);};
   cancelPending=()=>finish(false);
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   dialog.addEventListener('click',async event=>{
    if(settled)return;
    const action=event.target.closest('[data-guard]')?.dataset.guard;if(!action)return;
    if(action==='stay')return finish(false);
    if(action==='discard'){for(const form of changed){drafts.delete(known.get(form));tracker.saved(form,tracker.capture(form));}return finish(true);}
    const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
    try{
     for(const form of changed){if(form.reportValidity&&!form.reportValidity())return finish(false);await save(form);if(settled)return;if(form.dataset.acknowledged!=='true')return finish(false);}
     finish(true);
    }catch(error){if(settled){onSaveError(error);return;}dialog.querySelector('[role=alert]').textContent=error.message;buttons.forEach(button=>button.disabled=false);}
   });
   if(dialog.showModal)dialog.showModal();else queueMicrotask(()=>finish(false));
  });return asking;
 }
 return {sync,stash,acknowledge,hasChanges,allow,clear(){cancelPending?.();drafts.clear();known=new WeakMap();tracker.clear();}};
}

export function handleTabKey(event){
 const tab=event.target.closest?.('[role=tab]'),list=tab?.closest('[role=tablist]');if(!list||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return false;
 const tabs=[...list.querySelectorAll('[role=tab]:not(:disabled)')],index=tabs.indexOf(tab),rtl=globalThis.getComputedStyle?getComputedStyle(list).direction==='rtl':true;
 const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?(rtl?1:-1):(rtl?-1:1))+tabs.length)%tabs.length;
 event.preventDefault();tabs.forEach((node,i)=>node.tabIndex=i===next?0:-1);tabs[next]?.focus();return true;
}
