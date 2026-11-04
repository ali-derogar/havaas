// Keep route geometry independent of the response engine and its random stream.
export const TRAFFIC_TRAVEL=375;
const svg=(body,box,cls)=>`<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;

export function trafficCarBody(){
 return `<g stroke="#28516d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="94" cy="88" rx="53" ry="4" fill="#263c5b" stroke="none" opacity=".2"/>
  <g class="car-chassis"><path d="m45 55 14-5 16-22h35l21 23 12 6 3 19-7 5H43V61z" fill="#1cbfe3"/>
   <path d="m65 49 14-17h27l15 17z" fill="#b5f2f9"/><path d="M93 33v16" stroke="#64b4d4"/>
   <path d="m77 38-5 8m27-8h5" stroke="#efffff" stroke-width="3"/>
   <path d="M47 56h87l8 8H46z" fill="#64dded" stroke="none"/><path d="M81 54v19m40-20 8 19" stroke="#159ab9"/>
   <path d="M90 57h7" stroke="#e5fcff" stroke-width="3"/><path d="M48 75h94" stroke="#1488a5" stroke-width="3"/>
   <path d="M136 59h7v8h-7z" fill="#fff0a5" stroke="#dcbe6b"/><path d="M44 61h5v8h-5z" fill="#ff8a80" stroke="none"/>
   <path d="M137 77h9m-104 0h7" stroke="#d6eff1" stroke-width="4"/>
   <path d="M60 52h5v7h-5z" fill="#59d6e9"/>
  </g>
  ${[64,123].map(x=>`<g class="car-wheel"><circle cx="${x}" cy="79" r="11" fill="#304966"/><circle cx="${x}" cy="79" r="7" fill="#a9cbdf"/><circle cx="${x}" cy="79" r="3" fill="#f4ffff" stroke="none"/><path d="M${x-5} 79h10m-5-5v10" stroke="#e9fbff" stroke-width="1.8"/></g>`).join('')}
 </g>`;
}

export function trafficRoadArt(progress=0){
 const position=Math.max(0,Math.min(1,progress));
 return `<svg class="traffic-road traffic-journey-art" viewBox="0 0 620 300" xmlns="http://www.w3.org/2000/svg" fill="none" data-progress="${position}" aria-label="مسیر ماشین تا پرچم مقصد"><image href="/assets/worlds/rainbow-town.svg" width="620" height="300" preserveAspectRatio="xMidYMid slice"/>
  <g class="town-cloud-drift" fill="#ffffffb0" transform="translate(0 0)"><path d="M195 43q-8-12 7-16 4-16 19-9 16-10 25 7 16-1 18 18z"/></g>
  <g transform="translate(0 175)"><path d="M0 29h620v69H0z" fill="#526b83"/><path d="M0 29h620M0 98h620" stroke="#eef6de" stroke-width="4"/><path d="M0 63h620" stroke="#f6efcb" stroke-width="3" stroke-dasharray="25 18"/>
   <path d="M0 20h620m-620 87h620" stroke="#9fc6ab" stroke-width="5"/>
   <g class="road-destination ${position===1?'arrived':''}"><path d="M510 31h10v65h-10z" fill="#fff5cf"/><path d="M510 31h5v8h-5zm5 8h5v8h-5zm-5 8h5v8h-5zm5 8h5v8h-5zm-5 8h5v8h-5zm5 8h5v8h-5zm-5 8h5v8h-5zm5 8h5v8h-5z" fill="#344963"/>
    <path d="M548-14v98" stroke="#355b6e" stroke-width="3"/><path class="destination-pennant" d="M550-14h38v27h-38z" fill="#ffdc68" stroke="#d1a645" stroke-width="1.5"/><path d="M551-13h9v9h-9zm18 0h9v9h-9zm-9 9h9v9h-9zm18 0h9v9h-9zm-27 9h9v7h-9zm18 0h9v7h-9z" fill="#3c6075"/>
    <g class="destination-star" transform="translate(570 -34)"><path d="m0-12 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1z" fill="#ffda53" stroke="#d5a736" stroke-width="1.5"/></g>
   </g>
   <g class="road-car" transform="translate(${TRAFFIC_TRAVEL*position} 0)">${trafficCarBody()}</g>
  </g></svg>`;
}

export function trafficCover({lazy=false}={}){
 return `<div class="illustrated-cover training-cover illustrated-traffic traffic-cover" data-game="traffic"><img src="/assets/worlds/rainbow-town.svg" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async">${svg(`<path d="M0 149h340v43H0z" fill="#5c7890"/><path d="M0 169h340" stroke="#fff4d3" stroke-width="2" stroke-dasharray="17 12"/><g transform="translate(14 56) scale(1.45)">${trafficCarBody()}</g><g transform="translate(266 33)"><path d="M0 84v49" stroke="#4c7585" stroke-width="6"/><rect x="-22" width="44" height="89" rx="15" fill="#32516c" stroke="#759ba7" stroke-width="2"/><circle cy="18" r="11" fill="#607689"/><circle cy="44" r="11" fill="#607689"/><circle cy="69" r="11" fill="#40d29e"/><path d="m-5 69 4 4 7-9" stroke="#c4ffec" stroke-width="2"/></g>`,'0 0 340 200','traffic-cover-art')}<span class="traffic-cover-label" aria-hidden="true">با دقت، تا مقصد</span></div>`;
}

export function trafficOutcome(progress){
 const arrived=progress>=1;
 return `<div class="traffic-outcome ${arrived?'arrived':'journey-ended'}">${trafficRoadArt(progress)}${arrived?'<span class="traffic-arrival-badge" aria-label="به مقصد رسیدی">★</span>':''}</div>`;
}
