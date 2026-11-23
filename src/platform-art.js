import {numberLocale} from './i18n.js';
import {lt} from './i18n.js';
// Original, local vector illustrations for the platform, never game stimuli.
export function compassArt() {
 return `<svg class="explorer-compass" viewBox="0 0 180 200" fill="none" aria-hidden="true">
  <ellipse cx="90" cy="182" rx="53" ry="9" fill="#33366d" opacity=".12"/>
  <g class="compass-body">
   <path d="m46 137-16 16m104-16 16 16M67 154l-5 17m51-17 5 17" stroke="#294658" stroke-width="9" stroke-linecap="round"/>
   <rect x="72" y="14" width="36" height="27" rx="11" fill="#ffca69" stroke="#294658" stroke-width="4"/>
   <circle cx="90" cy="95" r="65" fill="#ef9b47" stroke="#294658" stroke-width="4"/>
   <circle cx="90" cy="90" r="65" fill="#ffd77e" stroke="#294658" stroke-width="4"/>
   <circle cx="90" cy="90" r="53" fill="#fffcf2" stroke="#e4aa55" stroke-width="2"/>
   <path d="M90 44v7m0 78v7m46-46h-7m-78 0h-7" stroke="#83959b" stroke-width="3" stroke-linecap="round"/>
   <g class="compass-needle"><path d="m90 54 13 36-13 10-13-10z" fill="#7765ce"/><path d="m90 126 13-36-13 10-13-10z" fill="#b8e5dc"/></g>
   <g class="compass-eyes" fill="#294658"><ellipse cx="70" cy="91" rx="4" ry="6"/><ellipse cx="110" cy="91" rx="4" ry="6"/></g>
   <path d="M80 108q10 10 20 0" stroke="#294658" stroke-width="3" stroke-linecap="round"/>
   <circle cx="60" cy="104" r="6" fill="#f2a28b" opacity=".6"/><circle cx="120" cy="104" r="6" fill="#f2a28b" opacity=".6"/>
   <path d="M47 65q10-23 30-24" stroke="#fff3cb" stroke-width="5" stroke-linecap="round"/>
  </g>
 </svg>`;
}

const spark = (x,y,color,size=7) => `<path d="m${x} ${y-size} 2 ${size-2} ${size-2} 2-${size-2} 2-2 ${size-2}-2-${size-2}-${size-2}-2 ${size-2}-2z" fill="${color}"/>`;

export function explorerScene({completed=0}={}) {
 const count=Math.max(0,Math.min(7,Number(completed)||0));
 return lt`<div class="journey-art explorer-scene" aria-hidden="true">
  <svg class="explorer-landscape" viewBox="0 0 620 420" fill="none">
   <circle cx="320" cy="195" r="169" fill="#e6e1f6"/><circle cx="320" cy="195" r="145" stroke="#d3cbea" stroke-dasharray="3 10"/>
   <circle cx="489" cy="74" r="30" fill="#ffda80"/><circle cx="489" cy="74" r="44" stroke="#efcb79" stroke-dasharray="2 9"/>
   <g class="explorer-cloud" fill="#fffdf7"><path d="M76 104h98a18 18 0 0 0-5-35 29 29 0 0 0-53-2 20 20 0 0 0-40 37Z"/><path d="M440 201h99a16 16 0 0 0-6-31 27 27 0 0 0-50-7 20 20 0 0 0-43 38Z"/></g>
   <path class="explorer-trail" d="M116 242c-36-89 71-140 143-81s207 40 242 114c36 74-145 129-222 65" stroke="#a096c5" stroke-width="3" stroke-dasharray="5 9" stroke-linecap="round"/>
   <g class="explorer-island island-back"><path d="m63 229 72 45 76-45-74-28z" fill="#d0b2e7"/><path d="m63 229 32 51 42 21 40-20 34-52-76 30z" fill="#b39bcf"/><ellipse cx="137" cy="227" rx="74" ry="30" fill="#e9daf3"/>
    <path d="m111 213 27-63 29 63" fill="#8070b9"/><path d="m122 186 16-36 17 36-15-8z" fill="#fff9ee"/><path d="M96 228h84" stroke="#b4a1d0" stroke-width="3" stroke-linecap="round"/>
   </g>
   <g class="explorer-island island-front"><path d="m407 285 34 51 50 23 44-27 32-47-77 31z" fill="#72b4ab"/><ellipse cx="487" cy="282" rx="80" ry="30" fill="#b8e1ce"/>
    <path d="M479 284v-70" stroke="#416e65" stroke-width="5"/><path d="M481 215v34l39-17z" fill="#ee987b"/><path d="m452 286 12-23 11 23" fill="#5a9c86"/><path d="m514 286 13-29 13 29" fill="#5a9c86"/>
   </g>
   <g class="explorer-island island-main"><path d="m194 306 37 48 82 39 77-37 39-50-117 31z" fill="#d1a66c"/><path d="m231 354 82 39 8-57-46-10z" fill="#b48d64"/><ellipse cx="311" cy="302" rx="118" ry="43" fill="#a6d7b4"/><ellipse cx="311" cy="295" rx="108" ry="35" fill="#d5e9b6"/>
    <path d="m224 298 12-24 12 24m129 10 11-24 11 24" fill="#70a784"/><path d="M274 322q42-22 80-9" stroke="#f8f1cd" stroke-width="9" stroke-linecap="round"/>
   </g>
   ${spark(214,69,'#8a79bc',9)}${spark(558,122,'#e9b352',9)}${spark(69,319,'#de9175',8)}${spark(387,119,'#fffdf7',10)}
   <circle cx="185" cy="337" r="5" fill="#d89b81"/><circle cx="530" cy="365" r="4" fill="#8b7eb6"/>
  </svg>
  <div class="scene-compass">${compassArt()}</div>
  <span class="journey-tile discovery-tag tag-focus">✦ <span>کشف کن</span></span>
  <span class="journey-tile discovery-tag tag-memory"><span>قدم‌به‌قدم</span> ↗</span>
  <div class="scene-waypoints">${Array.from({length:7},(_,i)=>`<span class="${i<count?'visited':''}">${i<count?'✓':'·'}</span>`).join('')}</div>
 </div>`;
}

export const journeyArt=()=>explorerScene();

export function sectionArt(kind='progress') {
 const drawings={
  account:'<rect x="31" y="28" width="66" height="75" rx="13" fill="#e7dff5" stroke="#8873b0" stroke-width="2"/><circle cx="64" cy="53" r="12" fill="#fffaf0"/><path d="M44 86q2-22 20-22t20 22" fill="#fffaf0"/><circle cx="99" cy="96" r="21" fill="#ffd680"/><path d="m90 96 6 6 12-13" stroke="#705925" stroke-width="3" stroke-linecap="round"/>',
  family:'<rect x="23" y="42" width="91" height="62" rx="12" fill="#c4e5d7" stroke="#649f90" stroke-width="2"/><path d="m25 47 43 34 44-34" stroke="#649f90" stroke-width="2"/><path d="M68 65C35 44 52 23 68 35c16-12 33 9 0 30" fill="#e79b86"/>',
  progress:'<path d="M27 102h82" stroke="#bfb0d4" stroke-width="3" stroke-linecap="round"/><rect x="32" y="72" width="17" height="28" rx="5" fill="#b9dfce"/><rect x="59" y="52" width="17" height="48" rx="5" fill="#b6a6dd"/><rect x="86" y="31" width="17" height="69" rx="5" fill="#f2c36d"/><path d="m29 57 34-30 17 5 22-19m-15 0h15v15" stroke="#6d6292" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  pause:'<path d="M29 91q39-16 79 0" stroke="#c4b3d7" stroke-width="3" stroke-linecap="round"/><path d="M43 51h51v23a25 25 0 0 1-51 0z" fill="#ffd884"/><path d="M94 55h7a11 11 0 0 1 0 22h-7" stroke="#d7aa55" stroke-width="4"/><path d="M56 37q-8-9 0-18m15 18q-8-9 0-18m15 18q-8-9 0-18" stroke="#b9a9d0" stroke-width="3" stroke-linecap="round"/>'
 };
 return `<span class="platform-illustration" aria-hidden="true"><svg viewBox="0 0 136 130" fill="none"><circle cx="68" cy="65" r="58" fill="#f3edf9"/>${drawings[kind]||drawings.progress}${spark(17,29,'#d2a14c',8)}${spark(117,80,'#8c79b0',6)}</svg></span>`;
}

export function assessmentMap(steps) {
 const positions=[[650,121],[550,82],[450,128],[350,83],[250,128],[150,83],[50,121]];
 return lt`<div class="exploration-map" data-reveal><svg viewBox="0 0 700 205" fill="none" role="img" aria-label="مسیر هفت ایستگاه ارزیابی؛ وضعیت هر بخش در کارت‌های پایین آمده است">
  <path d="M650 121C605 121 595 82 550 82S495 128 450 128s-55-45-100-45-55 45-100 45-55-45-100-45-55 38-100 38" stroke="#e2d9ed" stroke-width="15" stroke-linecap="round"/>
  <path class="map-trail" d="M650 121C605 121 595 82 550 82S495 128 450 128s-55-45-100-45-55 45-100 45-55-45-100-45-55 38-100 38" stroke="#b4a0ce" stroke-width="3" stroke-dasharray="5 9" stroke-linecap="round"/>
  ${steps.map(({baseline},i)=>{const [x,y]=positions[i];return `<g class="map-stop ${baseline?'map-done':''}" style="--stop-index:${i}"><circle cx="${x}" cy="${y+5}" r="26" fill="${baseline?'#87b3a1':'#d2bddf'}"/><circle cx="${x}" cy="${y}" r="26" fill="${baseline?'#bce3cb':'#fffaf0'}" stroke="${baseline?'#6d9d86':'#c8b6d8'}" stroke-width="2"/><text x="${x}" y="${y+7}" text-anchor="middle" fill="#344c55" font-size="21" font-weight="700">${baseline?'✓':(i+1).toLocaleString(numberLocale())}</text></g>`;}).join('')}
  ${spark(625,55,'#dfac51',9)}${spark(78,42,'#dfac51',8)}${spark(379,167,'#8a79b0',8)}
 </svg><span class="map-caption">هر ایستگاه، یک بازی</span></div>`;
}
