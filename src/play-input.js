// Keep keyboard play in the field after a choice replaces the arena's markup.
const fieldSelector='.search-choice,.scene-object,.hunt-choice';
// Hunt has a clipped, moving field. A native enabled button may already be
// entirely beyond its edge while the engine's departure margin is still open.
function visibleInHuntField(button,fieldBounds=null) {
  const field=button.matches('.hunt-choice')?button.closest('.hunt-surface'):null;
  if(!field||typeof field.getBoundingClientRect!=='function'||typeof button.getBoundingClientRect!=='function')return true;
  const box=button.getBoundingClientRect(),clip=fieldBounds||field.getBoundingClientRect();
  return box.width>0&&box.height>0&&box.x<clip.x+clip.width&&box.x+box.width>clip.x&&box.y<clip.y+clip.height&&box.y+box.height>clip.y;
}

// Native Tab also needs the clipped-field rule. Move focus to the response
// button if an animal leaves the field while it is selected by keyboard.
export function syncHuntFocus(field,previous=field?.ownerDocument.activeElement) {
  if(!field)return;
  const clip=field.getBoundingClientRect?.(),choices=[...field.querySelectorAll('.hunt-choice')].map(button=>({button,reachable:!button.disabled&&visibleInHuntField(button,clip)}));
  if(choices.some(({button,reachable})=>button===previous&&!reachable))field.closest('.play-panel')?.querySelector('[data-action="respond"]:not(:disabled)')?.focus({preventScroll:true});
  for(const {button,reachable} of choices){
    button.tabIndex=reachable?0:-1;button.setAttribute('aria-hidden',String(!reachable));
  }
}
export function capturePlayFocus(panel) {
  const active=panel.ownerDocument.activeElement;
  if(!panel.contains(active)||!active.matches('[data-action]'))return null;
  return {action:active.dataset.action,index:active.dataset.index,choice:active.dataset.choice};
}
export function restorePlayFocus(panel,previous) {
  if(!previous)return;
  const buttons=[...panel.querySelectorAll('button[data-action]:not(:disabled)')].filter(button=>visibleInHuntField(button));
  const same=buttons.find(button=>button.dataset.action===previous.action&&button.dataset.index===previous.index&&button.dataset.choice===previous.choice);
  const fields=buttons.filter(button=>button.matches(fieldSelector));
  const next=fields.find(button=>Number(button.dataset.index)>Number(previous.index))||fields[0];
  const primary=buttons.find(button=>['continue-review','next-round','acknowledge','depart','respond'].includes(button.dataset.action));
  const target=same||(primary?.dataset.action==='depart'?primary:null)||next||primary;
  target?.focus({preventScroll:true});
}

// Direction keys follow screen positions, including RTL and scattered layouts.
export function moveFieldFocus(current,key) {
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!current?.matches?.(fieldSelector)||!Object.hasOwn(directions,key))return false;
  const field=current.closest('.search-grid,.object-grid,.hunt-surface');if(!field)return false;
  const [dx,dy]=directions[key],rect=current.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  const candidates=[...field.querySelectorAll('button:not(:disabled)')].filter(button=>button!==current&&visibleInHuntField(button)).map(button=>{
    const box=button.getBoundingClientRect(),ox=box.x+box.width/2-x,oy=box.y+box.height/2-y;
    return {button,forward:ox*dx+oy*dy,sideways:Math.abs(ox*dy-oy*dx)};
  }).filter(point=>point.forward>1).sort((a,b)=>(a.forward+2*a.sideways)-(b.forward+2*b.sideways));
  candidates[0]?.button.focus();return true;
}
