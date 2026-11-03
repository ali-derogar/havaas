import {exerciseEmblem} from './training-art.js';

// Decorative vector artwork; no score, user data or game stimuli are drawn here.
export function journeyArt(){
 return `<div class="journey-art" aria-hidden="true">
  <svg class="journey-orbits" viewBox="0 0 500 390" fill="none">
   <ellipse cx="250" cy="203" rx="200" ry="153" stroke="currentColor" stroke-opacity=".16"/>
   <ellipse cx="250" cy="203" rx="148" ry="111" stroke="currentColor" stroke-opacity=".22" stroke-dasharray="4 9"/>
   <path d="M80 268Q150 50 355 105T395 298" stroke="currentColor" stroke-opacity=".15" stroke-width="26" stroke-linecap="round"/>
   <g fill="#ffd46b"><path d="m394 39 5 13 14 5-14 5-5 14-5-14-13-5 13-5z"/><circle cx="113" cy="115" r="5"/><circle cx="399" cy="283" r="4"/></g>
   <g fill="#7be0cc"><circle cx="61" cy="214" r="5"/><circle cx="326" cy="345" r="7"/></g>
   <g stroke="#b6efde" stroke-width="2.5" stroke-linecap="round"><path d="M144 332v13m-6-7h12M299 47v10m-5-5h10"/></g>
  </svg>
  <div class="journey-core"><svg viewBox="0 0 160 160" fill="none"><rect x="8" y="8" width="144" height="144" rx="45" fill="#d4f8ed"/><rect x="20" y="20" width="120" height="120" rx="36" fill="#fffdf3"/><g stroke="#117d79" stroke-width="8" stroke-linecap="round"><path d="M49 64V49h15m32 0h15v15m0 32v15H96m-32 0H49V96"/></g><circle cx="80" cy="80" r="14" fill="#ffb94f"/><path d="m75 80 4 4 8-9" stroke="#58411e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <div class="journey-tile tile-focus">${exerciseEmblem('hunt')}<span>تمرکز</span></div>
  <div class="journey-tile tile-memory">${exerciseEmblem('nback')}<span>حافظه</span></div>
  <div class="journey-tile tile-space">${exerciseEmblem('space')}</div>
  <div class="journey-tile tile-search">${exerciseEmblem('search')}</div>
  <span class="journey-spark">✦</span>
 </div>`;
}
