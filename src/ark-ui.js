import { equipment, icon } from './visuals.js';
import { arkAtmosphere, arkBoatArt } from './ark-art.js';

// Recolor the existing vector set locally so distractors and essentials share
// one visual vocabulary. Color never reveals whether an object is required.
export function arkEquipment(name) {
  const colors = {
    '#34443d':'#28556a','#b7c89c':'#40c99e','#cbd9b2':'#a0e9a9',
    '#cc8c84':'#f77472','#b9cba2':'#58caaa','#fff5df':'#fff5cb',
    '#c0a8c9':'#ad86f1','#708884':'#42759b','#e7bf66':'#ffce3e',
    '#d79463':'#fa8d42','#e8be65':'#ffce43','#c48d9f':'#ed719e',
    '#dec299':'#ffd16b','#b1baca':'#8ea6f2','#d68b88':'#ff7281',
    '#e4c36b':'#ffce43','#b5a8c6':'#aa83ec','#b9cbb0':'#55caac',
    '#b7c7a3':'#64cfa0','#d5b78b':'#ffbc57','#dfbd76':'#ffcb46',
    '#a9c6c7':'#64d9ea','#e1b874':'#ffb83f','#b4c6d1':'#8bacec',
    '#c6a8bd':'#ee83b7','#b5c9a2':'#54c89e','#c6b1ce':'#b78bf0',
    '#d6a78a':'#fa9d69','#d9b66f':'#ffc44a','#b6c9a1':'#5acb9a',
    '#c5abc9':'#b38df1','#b7ccd1':'#67cfe5','#d5b2a1':'#f9a77d',
    '#b8dfe5':'#b4f1ff','#6c9bab':'#259fca','#77b8cd':'#2dc8f2',
    '#e7bb7b':'#ffb852','#f9e9bc':'#fff0bd','#f5e8d5':'#fff5ee',
    '#d97769':'#fb6472','#e8a45e':'#ff9943','#fae1a4':'#fff0a7',
    '#eec477':'#ffe16c','#82ad99':'#38bea6','#e8bd76':'#ffc84b',
    '#fbf6e9':'#f2fffa','#d77f6a':'#fa6375','#b7c7ad':'#6bceac',
    '#e7bf78':'#ffd264','#d9ad75':'#ffb648','#dfad72':'#f6af52',
    '#725344':'#7c5135','#f4dec2':'#ffe9a3','#9dbb83':'#50c58d',
    '#d99c7d':'#f88b68','#bb926f':'#dd9d59','#e5c69c':'#ffe0a1',
    '#b3a2c6':'#ab89ed','#d6e0de':'#bcf4ef','#e6b172':'#ffbc58',
    '#9bb6c5':'#6dbfe9','#d4aa76':'#efae55','#d2e0e2':'#c5f0fa',
    '#9bb78c':'#5bc995','#e9bd66':'#ffcd46','#d59e7b':'#f89b65',
    '#e8c19b':'#ffd08c',
  };
  return equipment(name).replace(/#[\da-f]{6}/gi, color=>colors[color.toLowerCase()]||color);
}

export function arkScene(session, checklist) {
  const items=session.practice?[session.currentItem]:session.items;
  const {ready,practice,level,scattered}=session;
  return `<div class="mission-time-track ark-time-track" aria-hidden="true"><span id="mission-time-fill"></span></div>
    <div class="mission-brief ark-mission-brief"><div class="ark-mission-heading"><span class="ark-mission-mark">${icon('bag')}</span><div><small>${practice?'یک تمرین کوچک، یک سفر بزرگ':'مأموریت تو'}</small><b>${practice?'برای سفر لازم است؟':'کولهٔ سفر را آماده کن'}</b></div><span class="ark-mission-count">${Number(session.metrics.hits).toLocaleString('fa-IR')} / ${Number(session.required.length).toLocaleString('fa-IR')}</span></div>${practice?'':checklist}<details class="companion-guide mission-story"><summary>داستان سفر</summary><p>${session.mission.story}</p></details></div>
    <div class="adventure-scene ark ${level} ark-world ${practice?'practice-scene':''}" data-ready="${ready}">
      <div class="ark-panorama"><img class="world-backdrop" src="/assets/worlds/hope-shore.svg" alt="" aria-hidden="true" decoding="async">${arkAtmosphere()}<div class="ark-shore-sign"><span>به ماجراجویی خوش آمدی</span><strong>ساحل امید</strong><small>${ready?'همه‌چیز آماده‌ست؛ راهی شو!':'کشتی منتظر توست'}</small></div><div class="scene-vehicle ${ready?'vehicle-ready':''}">${arkBoatArt()}${ready?`<span>${icon('check')} آمادهٔ حرکت!</span>`:''}</div></div>
      <div class="scene-heading"><span class="ark-find-cue">${icon('eye')} ${practice?'خوب نگاه کن؛ این وسیله لازم است؟':'وسایل لازم را پیدا کن'}</span><span>${practice?'بردار یا دست نگه دار':`${items.length.toLocaleString('fa-IR')} وسیله در ساحل`}</span></div>
      <div class="object-grid ${level} ${scattered?'scattered-objects':''}" ${scattered?`style="--field-height-desktop:${session.fieldHeights.desktop}px;--field-height-mobile:${session.fieldHeights.mobile}px"`:''} aria-label="وسایل ساحل؛ با کلیدهای جهت حرکت کن">${items.map((item,i)=>`<button type="button" class="scene-object ${item.collected?'collected':''} ${item.rejected?'rejected':''}" data-action="item" data-index="${item.id}" data-equipment="${item.icon}" style="--shore-turn:${(i%5-2)*3}deg;${item.layout?`--object-desktop-x:${item.layout.desktop.x}%;--object-desktop-y:${item.layout.desktop.y}%;--object-mobile-x:${item.layout.mobile.x}%;--object-mobile-y:${item.layout.mobile.y}%;--object-angle:${item.layout.angle}deg;--object-layer:${item.layout.layer}`:''}" aria-label="${item.name}${item.collected?'، در کوله قرار گرفت':item.rejected?'، برای این سفر لازم نبود':''}" ${item.collected||item.rejected?'disabled':''}>${arkEquipment(item.icon)}<span>${item.name}</span>${item.collected?icon('check'):item.rejected?icon('repeat'):''}</button>`).join('')}</div>
      <div class="ark-sand-edge" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>`;
}
