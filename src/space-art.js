// Local vector artwork: decorative paths never read or alter mission state.
const svg=(body,box,cls)=>`<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;

export function spaceShipBody(){
  return `<g stroke="#284b7a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <g class="space-engine-glow" stroke="none"><ellipse cx="110" cy="237" rx="37" ry="27" fill="#63e6f5" opacity=".12"/><ellipse cx="110" cy="235" rx="22" ry="23" fill="#63e6f5" opacity=".18"/></g>
    <g class="launch-flame" stroke="none"><path d="M89 204q-4 31 21 62 26-33 21-62z" fill="#aa89ff" opacity=".75"/><path d="M96 205q-1 29 14 47 17-20 14-47z" fill="#58e0ef"/><path d="M104 205q-2 19 6 30 9-11 6-30z" fill="#e4ffff"/></g>
    <path d="m77 143-31 23-10 53 39-21m68-55 31 23 10 53-39-21" fill="#a583f3"/>
    <path d="m56 169-9 35 24-13m92-22 10 35-24-13" stroke="#d9c5ff" stroke-width="3"/>
    <path d="M85 191h50l-4 23H89z" fill="#f8b74d"/><path d="M95 201h30" stroke="#ffe5a4" stroke-width="4"/>
    <path d="M77 196C54 120 74 64 110 22c37 42 56 98 33 174z" fill="#e9f9ff"/>
    <path d="M110 22c-27 43-41 104-24 174H77C54 120 74 64 110 22" fill="#bcddec" stroke="none"/>
    <path d="M110 22q23 24 35 58H75q12-34 35-58z" fill="#ff7967"/>
    <path d="M88 65q9-18 19-28" stroke="#ffb59a" stroke-width="5"/>
    <path d="M74 81h72" stroke="#c95662" stroke-width="3"/>
    <circle cx="110" cy="119" r="27" fill="#78daeb" stroke="#498cb3" stroke-width="4"/>
    <circle cx="110" cy="119" r="20" fill="#285385" stroke="#d2fbff" stroke-width="2"/>
    <path d="M97 114q2-10 12-11m-14 17v2" stroke="#baf7ff" stroke-width="4"/>
    <path d="m116 121 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#7ee6ef" stroke="none"/>
    <path d="M80 171h60v20H80z" fill="#55cdd9" stroke="none"/><path d="M79 171h62m-60 20h58" stroke="#309aaa"/>
    <circle cx="110" cy="159" r="4" fill="#ffc658" stroke="none"/>
    <path d="M110 172v34" stroke="#275684" stroke-width="7"/><path d="M110 173v28" stroke="#66e2e8" stroke-width="3"/>
    <path d="M67 108 63 131m94-23 4 23" stroke="#f5ffff" stroke-width="2"/>
  </g>`;
}
export const spaceShipArt=()=>svg(spaceShipBody(),'0 0 220 280','vehicle-art space-ship-art');

export function spaceAtmosphere(){
  return `<svg class="space-atmosphere" viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g class="space-twinkling-stars" fill="#e2eaff">${[75,184,296,413,538,653,772,890,958].map((x,i)=>`<path d="m${x} ${25+i%4*29} 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/>`).join('')}</g>
    <g class="space-satellite" stroke="#496697" stroke-width="1.7" stroke-linejoin="round"><path d="M-12-6h24v20h-24z" fill="#ffe196"/><path d="M-49-15h30v34h-30zm68 0h30v34H19z" fill="#6f90e0"/><path d="M-39-15v34m10-34v34m58-34v34m10-34v34M-49-4h30m-30 12h30m38-12h30m-30 12h30" stroke="#b3ccff"/><path d="M-19 2h7m24 0h7M0-6v-7l12-9"/><circle cx="12" cy="-22" r="3" fill="#a5f1ed" stroke="none"/></g>
    <path class="space-orbit-trail" d="M200 168Q400 35 647 68" stroke="#d5cbff" stroke-width="1.3" stroke-dasharray="4 7" opacity=".2"/>
    <g class="space-beacons" fill="#75f9dd"><circle cx="76" cy="219" r="3"/><circle cx="818" cy="220" r="3"/><circle cx="854" cy="220" r="3"/></g>
  </svg>`;
}

export function spaceCover({lazy=false}={}){
  return `<div class="illustrated-cover training-cover illustrated-space space-cover" data-game="space"><img src="/assets/worlds/orbit-station.svg" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async">${spaceAtmosphere()}<span class="space-cover-ship">${spaceShipArt()}</span><span class="space-cover-label" aria-hidden="true">آمادهٔ پرواز!</span></div>`;
}

export function spaceOutcomeArt(completed){
  return svg(`<image href="/assets/worlds/orbit-station.svg" width="640" height="280" preserveAspectRatio="xMidYMid slice"/><g transform="translate(213 30) scale(.8)"><g class="outcome-vehicle">${spaceShipBody()}</g></g>${completed?`<g class="space-launch-trails" stroke="#98eafa" stroke-width="2" stroke-linecap="round" opacity=".5"><path d="m235 208-8 28m25-13-6 30m-35-42-8 20"/></g><g transform="translate(525 210)"><g class="arrival-check space-arrival-check"><circle r="27" fill="#35c7ac" stroke="#c7fff4" stroke-width="4"/><path d="m-11 0 8 8 16-18" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g>`:''}`,'0 0 640 280',`mission-outcome-art space ${completed?'departed':'waiting'}`);
}

// Detailed equipment keeps the same names and silhouettes used by the task.
const kit={
  oxygen:`<path d="M25 12V5h15v8" fill="#a3d9f1"/><rect x="15" y="12" width="32" height="47" rx="12" fill="#5ccfe2"/><path d="M19 25h24M19 47h24" stroke="#b8f7ff" stroke-width="4"/><path d="M47 21c18-4 18 23 7 23h-7"/><path d="M23 18v4" stroke="#f0ffff" stroke-width="3"/><text x="31" y="41" text-anchor="middle" font-size="13" font-weight="800" fill="#174a7c" stroke="none">O₂</text><circle cx="35" cy="7" r="3" fill="#ffc966"/>`,
  suit:`<path d="m20 16-13 7-4 16 12 4 7-9-3 25h12l1-17 2 17h12l-3-25 7 9 12-4-4-16-14-7" fill="#edf8ff"/><path d="M23 6h18v13H23z" fill="#82dce9"/><rect x="23" y="23" width="19" height="15" rx="4" fill="#7e9ee9"/><path d="M27 28h7m-7 5h11" stroke="#ddfcff"/><path d="M19 49h12m3 0h12" stroke="#fbad6b" stroke-width="5"/><path d="m6 34 10 4m32 0 10-4" stroke="#73d1e4" stroke-width="4"/>`,
  fuel:`<path d="M23 15V5h19v11" fill="#ffd06c"/><path d="M18 18 9 8l9-5 12 14" fill="#ff9b6c"/><rect x="13" y="16" width="39" height="44" rx="8" fill="#ffac64"/><path d="M18 22h28" stroke="#ffe1a0" stroke-width="3"/><path d="M34 28c2 8 9 9 9 16a11 11 0 0 1-22 0c0-5 4-9 7-13l2 9z" fill="#fff3bb" stroke="#d8784a" stroke-width="1.5"/><path d="M19 54h27" stroke="#d47a48"/>`,
  helmet:`<path d="M8 33C8-2 56-2 56 33v18H8z" fill="#edfaff"/><rect x="14" y="16" width="36" height="27" rx="12" fill="#72dce9"/><rect x="18" y="20" width="28" height="18" rx="8" fill="#32548d"/><path d="m25 25-3 6" stroke="#b2f6ff" stroke-width="3"/><rect x="11" y="47" width="42" height="12" rx="5" fill="#9a8ee9"/><path d="M17 52h7m16 0h7" stroke="#e5ddff" stroke-width="2"/><path d="M7 29h5v12H7zm45 0h5v12h-5z" fill="#f8bd66"/>`,
  food:`<rect x="8" y="16" width="48" height="42" rx="12" fill="#f8c563"/><path d="M11 25h42m-29-8-5 13m19-13-5 13" stroke="#bc8046"/><path d="M16 43h32" stroke="#fff1bb" stroke-width="9"/><path d="M17 21h4m24 0h4" stroke="#ffe6a1" stroke-width="2"/>`,
  map:`<path d="m5 14 17-7 20 8 17-8v43l-17 8-20-8-17 8z" fill="#97e0d0"/><path d="M22 7v43m20-35v43" stroke="#43a7aa"/><path d="m12 35 10-8 10 14 16-18" stroke="#8973d9" stroke-width="3" stroke-dasharray="4 4"/><path d="m48 19 2 5 5 1-4 4 1 5-4-3-5 3 1-5-4-4 5-1z" fill="#fff1a0" stroke="#b99856" stroke-width="1"/>`,
  obstacle:`<path d="m3 44 9-23L28 8l19 8 14 29-17 13H17z" fill="#9ba6ca"/><path d="m12 22 16 10 19-16M28 32l-7 25m7-25 20 9-4 17" stroke="#5d6b9b" stroke-width="2.5"/><path d="m14 24 12-11 7 2m-24 28 4-11" stroke="#d1d9f5" stroke-width="3"/><path d="m36 30 9-6 7 14-13-3z" fill="#b9c6e7" stroke="none"/><circle cx="20" cy="41" r="3" fill="#7f8eb7" stroke="none"/>`,
};
export function spaceKitArt(name){
  return kit[name]?svg(`<g stroke="#2e507c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kit[name]}</g>`,'0 0 64 64',`equipment space-equipment ${name==='obstacle'?'space-rock':''}`):null;
}
