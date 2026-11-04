import {equipment,icon} from './visuals.js';
import {spaceAtmosphere,spaceShipArt,spaceKitArt} from './space-art.js';

const palette={
  '#34443d':'#344f7b','#b7c89c':'#5adbb5','#cbd9b2':'#bcf3c0',
  '#cc8c84':'#ff88a0','#b9cba2':'#6ed9c9','#fff5df':'#fff2c2',
  '#c0a8c9':'#bb98ff','#708884':'#748ed0','#e7bf66':'#ffdf58',
  '#d79463':'#ff9a60','#e8be65':'#ffdc63','#c48d9f':'#fa91d2',
  '#dec299':'#ffe199','#b1baca':'#9caeff','#d68b88':'#ff879a',
  '#e4c36b':'#ffda65','#b5a8c6':'#ba99ff','#b9cbb0':'#72e4bf',
  '#b7c7ad':'#7de6ca','#e7bf78':'#ffe483','#d9ad75':'#ffd16a',
  '#dfad72':'#ffc478','#725344':'#6c5b83','#f4dec2':'#fff2c4',
  '#9dbb83':'#73e5b1','#d99c7d':'#ffa48d','#bb926f':'#edbd82',
  '#e5c69c':'#ffe7bb','#b3a2c6':'#bd9bff','#d6e0de':'#c5fff7',
  '#e6b172':'#ffd280','#9bb6c5':'#86d7ff','#d4aa76':'#f8c984',
  '#d2e0e2':'#d2f6ff','#9bb78c':'#82deb4','#e9bd66':'#ffdc6c',
  '#d59e7b':'#f8b18d','#e8c19b':'#ffdfab',
};
export const spaceEquipment=name=>spaceKitArt(name)||equipment(name).replace(/#[\da-f]{6}/gi,color=>palette[color.toLowerCase()]||color);

export function spaceScene(session,checklist){
  const {practice,ready,level,scattered}=session,items=practice?[session.currentItem]:session.items;
  const blocked=items.filter(item=>item.blocked).length;
  return `<div class="mission-time-track space-time-track" aria-hidden="true"><span id="mission-time-fill"></span></div>
    <div class="mission-brief space-mission-brief"><div class="space-mission-heading"><span class="space-mission-mark">${icon('rocket')}</span><div><small>${practice?'آموزش فضانورد کوچک':'مأموریت تو'}</small><b>آماده‌سازی سفر فضایی</b></div><span class="space-mission-count">${session.metrics.hits.toLocaleString('fa-IR')} / ${session.required.length.toLocaleString('fa-IR')}</span></div>${practice?'':checklist}<details class="companion-guide mission-story"><summary>داستان سفر</summary><p>${session.mission.story}</p></details></div>
    <div class="adventure-scene space ${level} space-world ${practice?'practice-scene':''}" data-ready="${ready}">
      <div class="space-panorama"><img class="world-backdrop" src="/assets/worlds/orbit-station.svg" alt="" aria-hidden="true" decoding="async">${spaceAtmosphere()}<div class="space-station-sign"><span>تا ستاره‌ها، با دقت تو</span><strong>ایستگاه حواس</strong><small><i aria-hidden="true"></i>${ready?'آمادهٔ پرتاب!':'در حال آماده‌سازی'}</small></div><div class="space-charge" aria-hidden="true">${session.required.map((_,i)=>`<i class="${i<session.metrics.hits?'charged':''}"></i>`).join('')}</div><div class="scene-vehicle ${ready?'vehicle-ready':''}">${spaceShipArt()}${ready?`<span>${icon('check')} آمادهٔ پرتاب!</span>`:''}</div></div>
      <div class="scene-heading"><span class="space-find-cue">${icon(practice&&blocked?'tap':'eye')} ${practice?blocked?'اول سنگ را کنار بزن':'این وسیله برای سفر لازم است؟':'وسایل سفر را پیدا کن'}</span><span>${practice?blocked?'روی سنگ بزن':'بردار یا دست نگه دار':`${items.length.toLocaleString('fa-IR')} وسیله · ${blocked.toLocaleString('fa-IR')} مانع`}</span></div>
      <div class="object-grid ${level} ${scattered?'scattered-objects':''}" ${scattered?`style="--field-height-desktop:${session.fieldHeights.desktop}px;--field-height-mobile:${session.fieldHeights.mobile}px"`:''} aria-label="تجهیزات ایستگاه؛ با کلیدهای جهت حرکت کن">${items.map((item,i)=>`<button type="button" class="scene-object ${item.collected?'collected':''} ${item.rejected?'rejected':''} ${item.blocked?'blocked':''}" data-action="item" data-index="${item.id}" data-equipment="${item.blocked?'obstacle':item.icon}" style="--space-item-turn:${(i%5-2)*3}deg;${item.layout?`--object-desktop-x:${item.layout.desktop.x}%;--object-desktop-y:${item.layout.desktop.y}%;--object-mobile-x:${item.layout.mobile.x}%;--object-mobile-y:${item.layout.mobile.y}%;--object-angle:${item.layout.angle}deg;--object-layer:${item.layout.layer}`:''}" aria-label="${item.blocked?'کنار زدن مانع':item.name}${item.collected?'، در سفینه قرار گرفت':item.rejected?'، برای این سفر لازم نبود':''}" ${item.collected||item.rejected?'disabled':''}>${spaceEquipment(item.blocked?'obstacle':item.icon)}<span>${item.blocked?'کنار بزن':item.name}</span>${item.blocked?`<b class="obstacle-plus">${icon('tap')}</b>`:item.collected?icon('check'):item.rejected?icon('repeat'):''}</button>`).join('')}</div>
      <div class="space-floor-edge" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    </div>`;
}
