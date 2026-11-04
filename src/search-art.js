// Original artwork for the clue workshop. Scored stimuli stay in visuals.symbol.
const svg=(body,box,cls)=>`<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;

export function searchLensArt(){
 return svg(`<ellipse cx="114" cy="181" rx="74" ry="9" fill="#b5a7cd" opacity=".2"/><g stroke="#47688c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(-12 85 80)"><rect x="24" y="28" width="103" height="116" rx="17" fill="#c4b6ed"/><rect x="33" y="20" width="103" height="116" rx="17" fill="#fff8df"/><path d="M47 38h49m-49 10h27" stroke="#d8d6d9" stroke-width="4"/><path d="m80 60 8 16 18 3-13 13 3 18-16-8-17 8 4-18-13-13 18-3z" fill="#ffc65e" stroke="#ce9c4e" stroke-width="2"/></g><g transform="rotate(-9 142 118)"><path d="m143 123 38 40q8 10-1 18t-17-2l-38-40" fill="#a990e8"/><path d="m141 139 32 33" stroke="#d3c1ff" stroke-width="4"/><circle cx="109" cy="99" r="46" fill="#71d4d8"/><circle cx="109" cy="99" r="36" fill="#e8ffff" fill-opacity=".87" stroke="#52a9bb"/><path d="M88 88q4-13 19-14m-21 22v2" stroke="#fff" stroke-width="6"/><path d="m98 104 9 9 17-22" stroke="#52bca4" stroke-width="5"/></g></g><g fill="#f6ba57"><path d="m163 22 3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/><path d="m22 132 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></g>`,'0 0 210 200','search-lens-art');
}

export function searchCover({lazy=false}={}){
 return `<div class="illustrated-cover training-cover illustrated-search search-cover" data-game="search"><img src="/assets/worlds/clue-workshop.svg" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async"><span class="search-cover-lens">${searchLensArt()}</span><span class="search-cover-label" aria-hidden="true">کارگاه سرنخ<small>خوب ببین، دقیق پیدا کن</small></span></div>`;
}

export function searchMemorySeal(){
 return svg(`<circle cx="50" cy="50" r="43" fill="#eee7ff" stroke="#d6c5f4" stroke-width="2"/><g stroke="#7970b0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="24" y="34" width="51" height="39" rx="9" fill="#fff9e7"/><path d="m26 39 23 18 24-18"/><path d="M40 34v-8a10 10 0 0 1 20 0v8"/><circle cx="50" cy="63" r="3" fill="#c5a7f1" stroke="none"/></g><path d="m76 18 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffcd66"/>`,'0 0 100 100','search-memory-seal');
}

export function searchOutcomeArt(session){
 const stamps=Array.from({length:session.total},(_,i)=>{
  const found=session.outcomes.filter(outcome=>outcome.round===i+1&&outcome.target&&outcome.response).length,complete=found===session.targetCount;
  const x=194+i%5*49,y=66+Math.floor(i/5)*58;
  return `<g class="search-result-stamp ${complete?'discovered':'unfinished'}" transform="translate(${x} ${y})"><rect x="-19" y="-19" width="38" height="38" rx="11" fill="${complete?'#d8f4e9':'#faf0d6'}" stroke="${complete?'#7fc7b4':'#d9c7a1'}" stroke-width="2"/>${complete?'<path d="m-9 0 6 6L10-9" stroke="#259d86" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>':'<circle r="7" fill="#d8c2a0"/><path d="M0-3v4m0 4v0" stroke="#fffcf1" stroke-width="2" stroke-linecap="round"/>'}</g>`;
 }).join('');
 return svg(`<image href="/assets/worlds/clue-workshop.svg" width="620" height="260" preserveAspectRatio="xMidYMid slice"/><g transform="rotate(-4 300 126)" stroke="#7e78a5" stroke-linejoin="round"><rect x="146" y="21" width="305" height="198" rx="20" fill="#b39cde" stroke-width="3"/><rect x="157" y="12" width="305" height="198" rx="20" fill="#fffbef" stroke-width="3"/><path d="M177 31v157" stroke="#e3d0e7" stroke-width="2"/>${stamps}<path d="M185 180h105m16 0h96" stroke="#d4d6de" stroke-width="4" stroke-linecap="round"/></g><g transform="translate(432 129) scale(.55)">${searchLensArt().replace(/<svg[^>]*>|<\/svg>/g,'')}</g>`,'0 0 620 260','search-outcome-art');
}
