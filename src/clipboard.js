export async function copyTextField(field){
  try{
    if(globalThis.navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(field.value);
      return true;
    }
  }catch{ /* Permission may be denied even when the Clipboard API exists. */ }

  // Clipboard API is unavailable on public HTTP origins. Copy the visible
  // field inside its dialog; moving focus outside a modal would be blocked.
  field.focus({preventScroll:true});
  field.select();
  field.setSelectionRange(0,field.value.length);
  try{return field.ownerDocument.execCommand?.('copy')===true;}
  catch{return false;}
}
