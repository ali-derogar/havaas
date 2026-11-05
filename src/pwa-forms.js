// Form contents stay in this page's memory; only readiness is sent to the worker.
function formState(form){
 return JSON.stringify([...form.querySelectorAll('input,textarea,select')].filter(control=>!['hidden','submit','button','reset'].includes(control.type)&&!control.readOnly&&!control.hasAttribute('readonly')).map(control=>{
  let value=control.value??'';
  if(['checkbox','radio'].includes(control.type))value=Boolean(control.checked);
  if(control.type==='file')value=[...control.files||[]].map(file=>[file.name,file.size,file.lastModified]);
  if(control.tagName==='SELECT'&&control.multiple)value=[...control.options].filter(option=>option.selected).map(option=>option.value);
  return [control.name||'',control.type||control.tagName,value];
 }));
}
export function createFormTracker(){
 const records=new WeakMap();
 function remember(form){
  if(!records.has(form))records.set(form,{saved:formState(form),revision:0});
  return records.get(form);
 }
 return {
  remember,
  changed(form){remember(form).revision++;},
  capture(form){return {state:formState(form),revision:remember(form).revision};},
  saved(form,submission){
   if(!submission)return;
   const record=remember(form);
   // A successful reset/canonical value is clean. Edits made while the request
   // was in flight still differ from the state the server actually accepted.
   record.saved=record.revision===submission.revision?formState(form):submission.state;
  },
  isDirty(form){return formState(form)!==remember(form).saved;},
 };
}
