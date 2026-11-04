// Original, resolution-independent artwork for the Hope Shore adventure.
// Keep this module free of game state: illustration must never consume the game RNG.
const svg = (body, box, cls) => `<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;

export function arkBoatBody() {
  return `<g stroke="#713d28" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="166" cy="182" rx="139" ry="10" fill="#096d93" opacity=".16" stroke="none"/>
    <g class="vehicle-wake" stroke="#e4ffff" stroke-width="3.5"><path d="M20 183q24-6 48 0t48 0 48 0 48 0 48 0 48 0M61 191h39m75 0h51"/></g>
    <path d="M167 25v74" stroke="#a66a37" stroke-width="5"/>
    <path class="ark-pennant" d="M169 26q20 8 42 0l-7 12 8 12q-25 8-43-1z" fill="#ff665e" stroke="#b64b42"/>
    <path d="M58 133v-42h64v42" fill="#ffda7c"/>
    <path d="m48 92 42-30 43 30z" fill="#f77350"/>
    <path d="m56 90 34-22 34 22" stroke="#ffb47b"/>
    <path d="M121 134V78h104v56" fill="#ffe4a2"/>
    <path d="m110 80 62-37 64 37z" fill="#e95f46"/>
    <path d="m121 78 51-29 52 29" stroke="#ffb17a"/>
    <path d="M225 135V99h47v36" fill="#ffc967"/>
    <path d="m217 100 31-25 34 25z" fill="#ec7a48"/>
    <path d="M153 135v-23a20 20 0 0 1 40 0v23" fill="#74462e"/>
    <path d="M160 130v-18q0-14 13-14" stroke="#b5794b"/>
    <circle cx="186" cy="119" r="2" fill="#ffcd67" stroke="none"/>
    ${[83,135,211,249].map((x,i)=>`<circle cx="${x}" cy="${i===0?112:i===3?117:101}" r="${i===0||i===3?10:8}" fill="#66dbea"/><path d="m${x-3} ${i===0?108:i===3?113:97}-2 4" stroke="#f4ffff" stroke-width="3"/>`).join('')}
    <path d="M39 127q128 24 258-3l-20 31q-15 25-46 25H105q-32 0-46-24z" fill="#c87838"/>
    <path d="M43 132q126 25 249-2l-6 11q-123 26-236 2z" fill="#f8b251" stroke="none"/>
    <path d="M63 154q105 18 211-1M78 167q92 13 183-1" stroke="#985426"/>
    <path d="m102 151 7 26m53-23 1 26m56-27-7 25" stroke="#a45b2c"/>
    <path d="M38 127q128 25 259-3" stroke="#ffe3a1" stroke-width="7"/>
    <path d="M39 127q128 25 258-3" stroke="#864c2b" stroke-width="2"/>
    <circle cx="253" cy="147" r="14" fill="#fff3d3" stroke="#f47547" stroke-width="5"/>
    <circle cx="253" cy="147" r="6" fill="#bc7238" stroke="none"/>
    <path d="m243 137 5 5m10 10 5 5m0-20-5 5m-10 10-5 5" stroke="#fff3d3" stroke-width="4"/>
    <path d="M62 132v-13m15 16v-13m15 16v-13m142 8v-14m15 12v-15m15 12v-15" stroke="#91532d" stroke-width="3"/>
  </g>`;
}

export const arkBoatArt = () => svg(arkBoatBody(),'0 0 330 205','vehicle-art ark-boat-art');

export function arkAtmosphere() {
  return `<svg class="ark-atmosphere" viewBox="0 0 1000 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g class="ark-cloud ark-cloud-far" fill="#fff" opacity=".65"><path d="M110 48q-10-14 7-19 0-21 22-15 17-17 29 3 24-5 26 13 20 1 14 18z"/><path d="M510 27q-6-13 7-17 6-17 23-6 16-9 24 7 17-1 19 16z"/></g>
    <g class="ark-cloud ark-cloud-near" fill="#fff" opacity=".85"><path d="M324 57q-13-17 8-23 3-24 29-16 22-19 37 8 23-4 27 17 16 1 12 14z"/></g>
    <g class="ark-gull" stroke="#246c88" stroke-width="2.5" stroke-linecap="round"><path class="ark-gull-wings" d="M0 0q-9-10-17-4M0 0q9-10 17-4"/></g>
    <g class="ark-gull second" stroke="#246c88" stroke-width="2" stroke-linecap="round"><path class="ark-gull-wings" d="M0 0q-7-8-13-3M0 0q7-8 13-3"/></g>
    <g class="ark-water-glints" fill="none" stroke="#dbffff" stroke-linecap="round" stroke-width="2" opacity=".7"><path d="M415 173h30m56 19h49m73-27h24m-299 40h39m340-17h38m43-27h18"/></g>
    <g class="ark-surf" fill="none" stroke="#f5ffff" stroke-width="4" opacity=".7"><path d="M-30 220q110-15 220 0t220 0 220 0 220 0 220 0"/><path d="M-60 231q110-12 220 0t220 0 220 0 220 0 220 0" stroke-width="2" opacity=".6"/></g>
  </svg>`;
}

export function arkCover({lazy=false}={}) {
  return `<div class="illustrated-cover training-cover illustrated-ark ark-cover" data-game="ark"><img src="/assets/worlds/hope-shore.svg" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async">${arkAtmosphere()}<span class="ark-cover-boat">${arkBoatArt()}</span><span class="ark-cover-label" aria-hidden="true">ساحل امید</span></div>`;
}

export function arkOutcomeArt(completed) {
  return svg(`<image href="/assets/worlds/hope-shore.svg" width="640" height="260" preserveAspectRatio="xMidYMid slice"/><g transform="translate(110 38) scale(.9)"><g class="outcome-vehicle">${arkBoatBody()}</g></g>${completed?`<g class="ark-celebration" fill="#ffcf46">${[50,95,500,560,600].map((x,i)=>`<path d="m${x} ${35+i%3*30} 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>`).join('')}</g><g transform="translate(520 162)"><g class="arrival-check ark-arrival-check"><circle r="28" fill="#0cb88b" stroke="#fff" stroke-width="5"/><path d="m-12 0 8 8L14-11" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g>`:''}`,'0 0 640 260',`mission-outcome-art ark ${completed?'departed':'waiting'}`);
}
