import { COLORS, COLOR_NAMES } from './config.js';

const ink = '#34443d';
const svg = (body, viewBox = '0 0 64 64', cls = '') => `<svg class="${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;
export function icon(name, cls = '') {
  const paths = {
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>', back: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>', pause: '<path d="M9 5v14M15 5v14"/>',
    check: '<path d="m5 12 4 4L19 6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    sound: '<path d="m11 4-5 5H3v6h3l5 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 4-5 5H3v6h3l5 5zM16 9l6 6m0-6-6 6"/>',
    home: '<path d="m3 10 9-7 9 7v10h-7v-7h-4v7H3z"/>',
    repeat: '<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10"/>',
    chevron: '<path d="m14 6-6 6 6 6"/>',
  };
  return svg(`<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</g>`, '0 0 24 24', `icon ${cls}`);
}
export const logo = () => svg('<rect width="48" height="48" rx="15" fill="#284e40"/><g stroke="#d8efad" stroke-width="3" stroke-linecap="round"><path d="M13 21v-8h8m6 0h8v8m0 6v8h-8m-6 0h-8v-8"/><circle cx="24" cy="24" r="3.5" fill="#d8efad" stroke="none"/></g>', '0 0 48 48', 'brand-mark');

export function huntBackground(kind,theme='star') {
  const familiar='<rect width="600" height="240" fill="#f4f6eb"/><path d="M0 195q150-50 300 0t300-8v53H0" fill="#e7eddb"/><circle cx="543" cy="40" r="19" fill="#eee6c9"/><g stroke="#ccd7bd" stroke-width="3" fill="#e0e8d3"><path d="M53 188V94m0 42-16-11m16-8 16-12"/><ellipse cx="52" cy="82" rx="26" ry="34"/><path d="M500 202h50m-39-11v-24m28 24v-24M503 163h45v15h-45"/></g>';
  const abstract='<rect width="600" height="240" fill="#f2f0f6"/><g stroke="#dbd5e5" stroke-width="2" fill="none"><path d="m28 32 43-9 25 37-29 32-44-17zM476 168l52-26 45 44-43 34zM241 205l14-23 24 5 2 27-26 9z"/><path d="M372 19q38 29 70 1m-311 165q14-26 35-5m-43-52 30-14 9 26"/></g>';
  const worlds={
    fish:'<rect width="600" height="240" fill="#edf5f3"/><path d="M0 70q75-12 150 0t150 0 150 0 150 0M0 170q100 15 200 0t200 0 200 0" stroke="#d7e7e0" stroke-width="2"/><path d="M0 219q160-24 300 0t300-10v31H0" fill="#e1e9d8"/><g stroke="#cad8c2" stroke-width="3" stroke-linecap="round"><path d="M37 235V166m0 37-13-23m13 9 14-27M553 240v-67m0 32-12-18m12-2 11-18"/></g><g fill="none" stroke="#d5e5dd"><circle cx="84" cy="52" r="7"/><circle cx="100" cy="36" r="4"/><circle cx="523" cy="97" r="6"/></g>',
    bird:'<rect width="600" height="240" fill="#f0f5f5"/><path d="M18 50q5-19 24-13 14-26 33-5 21-4 25 18M445 41q5-14 19-11 12-20 28-3 20-4 24 14" fill="#e3edeb"/><path d="M0 228q150-31 300-5t300-10v27H0" fill="#e3ebd8"/><path d="M0 155q43 16 91-13m-43 12 5-25m0 25 17 15M600 187l-66-12-22-26m22 26-21 10" stroke="#d1dbc6" stroke-width="5" stroke-linecap="round"/>',
    butterfly:'<rect width="600" height="240" fill="#f4f6ec"/><path d="M0 207q150-40 300 0t300-8v41H0" fill="#e6edd9"/><g stroke="#ccd8bd" stroke-width="2" fill="#e0e8d2"><path d="M37 240v-57m0 34-17-12m536 35v-66m0 42 16-14"/><circle cx="37" cy="177" r="11"/><circle cx="556" cy="167" r="12"/><circle cx="91" cy="218" r="6"/></g><circle cx="530" cy="37" r="19" fill="#eee7ca"/>',
    shape:'<rect width="600" height="240" fill="#f6f2e8"/><path d="M0 208h600" stroke="#e4dccb" stroke-width="3"/><g stroke="#d9d1bd" stroke-width="2" fill="#ebe5d4"><rect x="25" y="22" width="47" height="60" rx="4"/><path d="M33 38h29m-29 9h29m-29 9h19M520 209v-45h48v45M527 164v-30h35v30M520 177h48"/></g>',
  };
  return svg(kind==='abstract'?abstract:worlds[theme]||familiar,'0 0 600 240','hunt-background').replace('<svg ','<svg preserveAspectRatio="xMidYMid slice" ');

}

export function symbol(stimulus, cls = '') {
  const { shape = 'star', color = 'blue', detail = 0, word } = stimulus;
  const fill = COLORS[color] || color;
  if (shape === 'word') return `<span class="word-stimulus ${cls}" style="color:${fill}">${COLOR_NAMES[word]}</span>`;
  if (shape.startsWith('digit-')) return svg(`<text x="32" y="48" text-anchor="middle" font-size="48" font-weight="750" fill="${fill}">${shape.slice(6)}</text>`, '0 0 64 64', `symbol ${cls}`);
  if (shape.startsWith('toy-')) return equipment(shape.slice(4)).replace(/class="equipment[^"]*"/, `class="symbol ${cls}"`);
  if (shape.startsWith('letter-')) {
    const letters={F:'M19 52V12H46M19 31H40',E:'M19 52V12H46M19 31H40M19 52H46',L:'M19 12V52H46',P:'M19 52V12H33C52 12 52 33 33 33H19',R:'M19 52V12H33C52 12 52 33 33 33H19M33 33L48 52'};
    const y=[0,14,31,50][detail];
    return svg(`<g fill="none" stroke="${fill}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="${letters[shape.slice(7)]||letters.F}"/>${detail?`<path class="letter-mark" d="M11 ${y}h8"/>`:''}</g>`, '0 0 64 64', `symbol ${cls}`);
  }
  if (shape === 'noentry') return svg('<circle cx="32" cy="32" r="28" fill="#d9504e" stroke="white" stroke-width="3"/><path d="M15 27h34v10H15z" fill="white"/>', '0 0 64 64', `symbol ${cls}`);
  if (shape === 'oneway') return svg('<rect x="5" y="5" width="54" height="54" rx="7" fill="#467aca" stroke="white" stroke-width="3"/><path d="M26 49V29H17l15-16 15 16h-9v20z" fill="white"/>', '0 0 64 64', `symbol ${cls}`);
  let body;
  const shapes = {
    star: '<path d="m32 5 8 17 19 3-14 14 3 19-16-9-17 9 4-19L5 25l19-3z"/>',
    circle: '<circle cx="32" cy="32" r="25"/>',
    square: '<rect x="9" y="9" width="46" height="46" rx="9"/>',
    triangle: '<path d="M29 9a3.5 3.5 0 0 1 6 0l25 43a3.5 3.5 0 0 1-3 5H7a3.5 3.5 0 0 1-3-5z"/>',
    diamond: '<path d="M28 5a5 5 0 0 1 8 0l23 23a5 5 0 0 1 0 8L36 59a5 5 0 0 1-8 0L5 36a5 5 0 0 1 0-8z"/>',
    heart: '<path d="M32 56 10 35C-9 16 17-3 32 17 47-3 73 16 54 35z"/>',
    fish: '<path d="M15 31C24 7 47 9 59 31 47 54 24 55 15 31L3 44V18z"/><circle cx="45" cy="28" r="3" fill="white"/><circle cx="46" cy="28" r="1.5" fill="#34443d"/><path d="m29 27 7 5-7 5" fill="none"/>',
    butterfly: '<path d="M30 29C7-7-11 16 21 34-9 42 7 72 30 41M34 29C57-7 75 16 43 34 73 42 57 72 34 41z"/><path d="M32 20v28m0-26-6-9m6 9 6-9" stroke-width="4"/>',
    bird: '<path d="M8 37C8 18 24 14 36 29 44 8 65 16 54 37 45 56 20 59 8 37L1 28l14 3"/><path d="m54 29 9 4-10 4" fill="#ecc477"/><circle cx="45" cy="27" r="2" fill="#34443d"/><path d="M21 34q13-4 17 6" fill="none"/>',
  };
  if (shape === 'traffic') {
    body = `<rect x="17" y="2" width="30" height="60" rx="11" fill="#34443d"/><circle cx="32" cy="18" r="10" fill="${color === 'red' ? COLORS.red : '#5b6259'}"/><circle cx="32" cy="46" r="10" fill="${color === 'green' ? '#57c78b' : '#5b6259'}"/>`;
  } else {
    body = `<g fill="${fill}" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round">${shapes[shape] || shapes.star}</g>`;
    body += detail === 1 ? '<circle cx="32" cy="30" r="4" fill="#fff8e8" stroke="#34443d" stroke-width="1.5"/>' : detail === 2 ? '<path d="m26 35 12-10" stroke="#fff8e8" stroke-width="4" stroke-linecap="round"/>' : detail === 3 ? '<g fill="#fff8e8" stroke="#34443d" stroke-width="1"><circle cx="26" cy="32" r="3"/><circle cx="38" cy="32" r="3"/></g>' : '';
  }
  return svg(body, '0 0 64 64', `symbol ${cls}`);
}

const drawings = {
  notebook: '<rect x="12" y="5" width="42" height="54" rx="5" fill="#b7c7ad"/><path d="M21 5v54M8 15h9M8 26h9M8 37h9M8 48h9"/><path d="m30 43 4-11 13-13 6 6-13 13z" fill="#e7bf78"/>',
  water: '<path d="M24 5h16v10l5 8v34H19V23l5-8z" fill="#b8dfe5"/><path d="M24 5h16v9H24z" fill="#6c9bab"/><path d="M20 34q12-8 24 0v21H20" fill="#77b8cd"/><path d="M25 22v10" stroke="white" stroke-width="4"/>',
  food: '<rect x="8" y="15" width="48" height="41" rx="12" fill="#e7bb7b"/><path d="M11 24h42M24 17l-5 13m19-13-5 13"/><path d="M16 42h32" stroke="#f9e9bc" stroke-width="9"/>',
  medkit: '<rect x="6" y="19" width="52" height="37" rx="8" fill="#f5e8d5"/><path d="M23 19v-9h18v9"/><path d="M27 27h10v7h8v10h-8v7H27v-7h-8V34h8z" fill="#d97769" stroke="none"/>',
  vest: '<path d="m17 8 12 6h6l12-6 12 18-7 30H12L5 26z" fill="#e8a45e"/><path d="M32 15v41M11 29h42M11 44h42"/><path d="M18 18v27m28-27v27" stroke="#fae1a4" stroke-width="6"/>',
  flashlight: '<path d="m21 7 30 12-11 19-18-7z" fill="#eec477"/><path d="m25 32 12 5-11 25-12-5z" fill="#82ad99"/><path d="m19 9-7 8m3-14-8 2" stroke="#eec477"/>',
  compass: '<circle cx="32" cy="34" r="24" fill="#e8bd76"/><circle cx="32" cy="34" r="19" fill="#fbf6e9"/><path d="m38 19-3 18-12 12 5-18z" fill="#d77f6a"/><circle cx="32" cy="34" r="3" fill="#34443d"/><path d="M28 10V4h8v6"/>',
  oxygen: '<rect x="20" y="11" width="25" height="47" rx="10" fill="#a6cbd1"/><path d="M27 11V5h11v6M21 28h23M21 43h23"/><path d="M45 17c18 0 15 22 6 22"/><text x="32" y="40" text-anchor="middle" font-size="13" fill="#34443d" stroke="none">O₂</text>',
  suit: '<path d="m20 14-14 9 5 16 10-5-3 25h13l1-18 2 18h13l-4-25 10 5 5-16-14-9z" fill="#eee9d9"/><path d="M24 6h16v12H24z" fill="#b3cbd2"/><rect x="24" y="22" width="17" height="12" rx="3" fill="#9bbcb2"/><path d="M20 46h10m5 0h10"/>',
  fuel: '<rect x="14" y="16" width="37" height="43" rx="6" fill="#e4a46a"/><path d="M24 16V6h17v10M21 25l24 25M45 25 21 50"/><path d="M15 18 8 7l9-4 9 13" fill="#e4a46a"/>',
  helmet: '<path d="M9 34C9-1 55-1 55 34v18H9z" fill="#f4f0df"/><rect x="15" y="16" width="34" height="25" rx="12" fill="#8dacc3"/><path d="m23 22-3 9" stroke="#dce7ed" stroke-width="4"/><rect x="13" y="48" width="38" height="11" rx="4" fill="#acb5a9"/>',
  map: '<path d="m5 15 17-8 20 8 17-8v43l-17 8-20-8-17 8z" fill="#d5e1bc"/><path d="M22 7v43m20-35v43"/><path d="m12 33 9-8 11 12 12-12 8 1" stroke="#9479b1" stroke-width="3" stroke-dasharray="4 4"/>',
  ball: '<circle cx="32" cy="32" r="26" fill="#d9ad75"/><path d="M8 22q24 0 47 23M22 8q0 24 23 47M10 48q7-27 38-38"/>',
  guitar: '<path d="m37 29 13-23 8 5-14 24c16 26-20 35-27 16-12-9 0-32 20-22z" fill="#dfad72"/><circle cx="32" cy="42" r="7" fill="#725344"/><path d="m23 53 30-44" stroke="#f4dec2" stroke-width="3"/>',
  plant: '<path d="M32 39V17m0 13C7 32 5 5 31 19c0-25 29-18 7 1" fill="#9dbb83"/><path d="M16 36h32l-5 24H21z" fill="#d99c7d"/>',
  cake: '<path d="M9 33h46v25H9z" fill="#e2b0bd"/><path d="M9 32q0-18 23-18t23 18q-9 12-17 1-10 13-15 0-7 13-14-1" fill="#f7e5c4"/><path d="M22 7v12m20-12v12"/><path d="M6 59h52"/>',
  teddy: '<g fill="#bb926f"><circle cx="15" cy="14" r="9"/><circle cx="49" cy="14" r="9"/><ellipse cx="32" cy="45" rx="18" ry="17"/><circle cx="32" cy="24" r="19"/><circle cx="13" cy="43" r="8"/><circle cx="51" cy="43" r="8"/></g><ellipse cx="32" cy="30" rx="9" ry="7" fill="#e5c69c"/><path d="M22 23h1m18 0h1M30 29h4" stroke-width="3"/>',
  television: '<rect x="5" y="15" width="54" height="37" rx="6" fill="#b3a2c6"/><rect x="10" y="20" width="37" height="26" rx="3" fill="#d6e0de"/><path d="m20 4 12 11L44 4M16 59l5-7m27 7-5-7M52 28h1m-1 10h1"/>',
  kite: '<path d="m32 3 23 24-23 23L9 27z" fill="#e6b172"/><path d="m32 3 0 47M9 27h46M32 50q-13 7-3 12"/><path d="m32 3 23 24H32z" fill="#9bb6c5"/>',
  painting: '<rect x="5" y="8" width="54" height="48" rx="3" fill="#d4aa76"/><path d="M11 14h42v36H11z" fill="#d2e0e2"/><path d="m11 48 16-18 10 13 7-9 9 14" fill="#9bb78c"/><circle cx="42" cy="24" r="6" fill="#e9bd66"/>',
  chair: '<rect x="16" y="5" width="33" height="30" rx="6" fill="#d59e7b"/><path d="M10 35h45v10H10z" fill="#e8c19b"/><path d="M16 45v17m33-17v17M27 12v15m11-15v15"/>',
  clock: '<circle cx="32" cy="32" r="26" fill="#b9cba2"/><circle cx="32" cy="32" r="21" fill="#fff5df"/><path d="M32 17v15l12 6M32 10v3m22 19h-3M32 54v-3M10 32h3"/>',
  skate: '<path d="M17 6h18v20l21 13v12H8V30h9z" fill="#c0a8c9"/><path d="M16 49h37" stroke-width="5"/><g fill="#708884"><circle cx="17" cy="57" r="5"/><circle cx="45" cy="57" r="5"/></g><path d="M21 17h11m-11 8h11"/>',
  duck: '<path d="M10 34q4 5 14 4c-16-30 26-35 24-10l10 6-14 4c4 23-39 28-38 2z" fill="#e7bf66"/><path d="m48 28 10 6-12 2" fill="#d79463"/><circle cx="38" cy="20" r="2" fill="#34443d"/><path d="M18 42q8 13 19 0"/>',
  crown: '<path d="m7 15 14 12L32 7l11 20 14-12-7 39H14z" fill="#e8be65"/><path d="M13 43h38"/><circle cx="32" cy="37" r="4" fill="#c48d9f"/>',
  gift: '<rect x="10" y="27" width="44" height="32" rx="3" fill="#b7c89c"/><rect x="6" y="19" width="52" height="13" rx="3" fill="#cbd9b2"/><path d="M27 19h10v40H27z" fill="#cc8c84"/><path d="M32 18C5 19 17-7 32 18c15-25 27 1 0 0" fill="#cc8c84"/>',
  lamp: '<path d="m20 6 24 0 12 30H8z" fill="#dec299"/><path d="M32 36v22M19 59h26M16 36v10"/><path d="M9 35h46"/>',
  gamepad: '<path d="M17 18h30c12 0 22 38 9 39L41 43H23L9 57C-5 57 4 18 17 18z" fill="#b1baca"/><path d="M14 29v12m-6-6h12" stroke-width="4"/><circle cx="45" cy="29" r="3" fill="#d68b88"/><circle cx="51" cy="38" r="3" fill="#e4c36b"/>',
  vase: '<path d="M22 5h20l-4 17c29 34 6 40-6 40S-3 56 26 22z" fill="#b5a8c6"/><path d="M18 37h28M17 49h30M24 14h16"/>',
  racket: '<ellipse cx="38" cy="23" rx="19" ry="22" transform="rotate(30 38 23)" fill="#b9cbb0"/><path d="m25 40-16 22" stroke-width="7"/><path d="m29 7 18 32M40 4l15 27M21 17l31 9M21 28l24 7" stroke="#e8efdd" stroke-width="2"/>',
  obstacle: '<path d="m4 47 8-23 16-13 20 6 13 31-16 10H15z" fill="#a9a4b4"/><path d="m13 25 18 9 17-16M31 34l-6 22m8-22 18 13"/>',
};
export function equipment(name, cls = '') { return svg(`<g stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${drawings[name] || drawings.gift}</g>`, '0 0 64 64', `equipment ${cls}`); }

export function art(id, cls = '') {
  const bodies = {
    hunt: '<circle cx="156" cy="91" r="62" fill="#c3d3a8"/><circle cx="156" cy="91" r="44" fill="#f4f1d8"/><circle cx="156" cy="91" r="27" fill="#aac18f"/><circle cx="156" cy="91" r="11" fill="#f4f1d8"/><path d="m156 91 74-55m-21 0 21 0-4 21" stroke-width="5"/><path d="m81 39 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" fill="#ddb95f"/><path d="M225 114c-6-32 38-32 18-4 35-9 26 32 0 15-18 24-41-5-18-11" fill="#d9a38a"/><path d="M231 112v25"/>',
    ark: '<path d="M0 137q40-13 80 0t80 0 80 0 80 0v43H0" fill="#b3d6d8" stroke="none"/><path d="m61 98 23 39h139l29-39z" fill="#b78259"/><path d="M82 112h149M93 125h128"/><path d="M111 98V52h70v46" fill="#edcc91"/><path d="m100 53 45-30 48 30z" fill="#bc8667"/><rect x="128" y="66" width="21" height="32" rx="10" fill="#755d4a"/><path d="M180 56h39v42h-39z" fill="#e8bc78"/><path d="m174 57 25-25 28 25z" fill="#a7755e"/><circle cx="249" cy="35" r="14" fill="#e9bf68" stroke="none"/><path d="M44 54q10-10 20 0m0 0q10-10 20 0M12 153q22 10 45 0m197 6q22 10 45 0"/>',
    space: '<circle cx="232" cy="57" r="32" fill="#d4cbe5" stroke="none"/><ellipse cx="232" cy="57" rx="49" ry="11" transform="rotate(-20 232 57)" stroke="#a998bd" stroke-width="3"/><g transform="translate(92 9) rotate(20 55 80)"><path d="m35 119-10 26 25-15 26 15-10-26" fill="#e8bc71"/><path d="M27 93 6 116l29-3m40-20 21 23-29-3" fill="#b697bf"/><path d="M33 118C16 68 29 31 51 7c23 24 36 61 19 111z" fill="#f9f4e6"/><path d="M34 29 51 7l18 22z" fill="#c5a9c9"/><circle cx="51" cy="64" r="15" fill="#92b4be"/><path d="m46 55-4 8" stroke="#e5eeec" stroke-width="4"/><path d="M32 104h39"/></g><g fill="#ddba6b" stroke="none"><path d="m60 32 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="m256 126 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/></g><circle cx="211" cy="136" r="3" fill="#a998bd"/><circle cx="44" cy="100" r="3" fill="#a998bd"/>',
    traffic: '<path d="M32 161h255" stroke="#c79782"/><path d="M153 118v43" stroke-width="10"/><rect x="120" y="13" width="66" height="113" rx="21" fill="#40584d"/><circle cx="153" cy="39" r="16" fill="#c77865"/><circle cx="153" cy="70" r="16" fill="#d5b468"/><circle cx="153" cy="101" r="16" fill="#b5d494"/><path d="m146 101 5 5 9-10" stroke="#496447" stroke-width="3"/><path d="M212 81h34v44h-34z" fill="#f6eddb"/><path d="m220 98 7-7 8 7m-8-7v25"/><path d="M229 125v34"/><path d="M63 109v50m-14-36 14-14 14 14" stroke="#8aab88" stroke-width="4"/>',
    search: '<rect x="63" y="22" width="161" height="124" rx="17" fill="#f7f2df"/><g fill="#b0c6c4"><rect x="78" y="38" width="26" height="26" rx="6"/><rect x="115" y="38" width="26" height="26" rx="6"/><rect x="152" y="38" width="26" height="26" rx="6"/><rect x="78" y="76" width="26" height="26" rx="6"/><rect x="115" y="76" width="26" height="26" rx="6"/><rect x="78" y="113" width="26" height="19" rx="5"/></g><circle cx="195" cy="104" r="43" fill="#dce9e2" fill-opacity=".9"/><circle cx="195" cy="104" r="34" stroke="#779c98" stroke-width="3"/><path d="m225 135 30 29" stroke-width="18"/><path d="m184 104 8 8 15-17" stroke="#739b78" stroke-width="5"/>',
    nback: '<g transform="rotate(-13 104 90)"><rect x="49" y="35" width="82" height="111" rx="12" fill="#c8cdb4"/><circle cx="90" cy="88" r="20" fill="#f5edcf"/></g><g transform="rotate(6 158 88)"><rect x="112" y="22" width="82" height="111" rx="12" fill="#f6e9ce"/><path d="m153 48 8 17 19 3-14 13 3 19-16-8-17 8 4-19-14-13 19-3z" fill="#d7b26c"/></g><g transform="rotate(19 211 100)"><rect x="178" y="45" width="82" height="111" rx="12" fill="#b6cdd0"/><circle cx="219" cy="98" r="20" fill="#f1edda"/></g><path d="M112 163q43 15 76 0m-9-4 9 4-5 9" stroke="#998161" stroke-width="2"/>',
    stroop: '<g transform="rotate(-9 120 70)"><rect x="54" y="24" width="133" height="62" rx="14" fill="#eddbb2"/><text x="120" y="65" text-anchor="middle" fill="#6d9a83" stroke="none" font-size="30" font-weight="800">قرمز</text></g><g transform="rotate(8 196 117)"><rect x="131" y="82" width="133" height="62" rx="14" fill="#c7d6be"/><text x="196" y="123" text-anchor="middle" fill="#c67d77" stroke="none" font-size="30" font-weight="800">آبی</text></g><circle cx="77" cy="124" r="22" fill="#c0b2cd"/><path d="m68 124 6 6 12-13" stroke="#fff6e4" stroke-width="4"/><path d="m250 31 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#e4bc6a" stroke="none"/>',
  };
  return svg(`<g stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${bodies[id] || bodies.hunt}</g>`, '0 0 320 180', `game-art ${cls}`);
}

export const heroArt = () => svg(`
  <ellipse cx="263" cy="352" rx="166" ry="25" fill="#e7e7dc"/>
  <path d="M97 236 270 181l157 66-168 75z" fill="#e8c9a3" stroke="#34443d" stroke-width="2"/>
  <path d="M97 236v27l162 83v-24m0 24 168-73v-26" fill="#e1b78f" stroke="#34443d" stroke-width="2"/>
  <path d="m130 237 137-42 125 53-133 58z" fill="#f5e4c8"/>
  <g stroke="#34443d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M181 217v-88c0-110 166-110 166 0v94" fill="#b6c9a1"/>
    <path d="M207 215v-86c0-75 114-75 114 0v86" fill="#edf0dc"/>
    <path d="M230 214v-84c0-45 69-45 69 0v84" fill="#d9c6d9"/>
    <ellipse cx="265" cy="262" rx="66" ry="27" fill="#bba4c5"/>
    <path d="M214 236c-23-66 8-99 47-99 47 0 72 41 52 99-14 40-79 42-99 0" fill="#cbbbce"/>
    <path d="M217 171c-17 4-21 20-14 34l13 1m94-35c16 4 20 20 13 34l-13 1" fill="#dfaa7c"/>
    <path d="M211 175c0-66 105-66 105 0" stroke="#d49d73" stroke-width="13"/>
    <ellipse cx="239" cy="195" rx="4" ry="6" fill="#34443d"/><ellipse cx="283" cy="195" rx="4" ry="6" fill="#34443d"/>
    <path d="M250 210q12 12 23-1" fill="none"/>
    <path d="M218 231q-21 2-23-21m113 19q22-5 24-23" fill="none" stroke-width="9" stroke="#cbbbce"/>
    <path d="m232 265-7 15m66-17 8 14" stroke-width="12" stroke="#bba4c5"/>
  </g>
  <g class="hero-float-a" stroke="#34443d" stroke-width="1.8" stroke-linejoin="round">
    <rect x="65" y="112" width="88" height="86" rx="20" fill="#f2e4c5" transform="rotate(-12 110 155)"/>
    <path d="m105 127 8 17 18 3-13 13 3 18-16-8-16 8 3-18-13-13 18-3z" fill="#e4bd70"/>
    <circle cx="414" cy="159" r="40" fill="#dce7c7"/>
    <path d="m397 159 11 11 22-25" stroke="#52694a" stroke-width="6" stroke-linecap="round"/>
  </g>
  <g class="hero-float-b" stroke="#34443d" stroke-width="1.8">
    <rect x="344" y="52" width="73" height="62" rx="15" fill="#e4d6e4" transform="rotate(13 380 83)"/>
    <path d="m359 80 11 10 24-17" stroke="#91799f" stroke-width="5" stroke-linecap="round"/>
    <circle cx="135" cy="292" r="23" fill="#a9c4c5"/><path d="m128 292 5 5 10-11" stroke="#f4f2df" stroke-width="4"/>
  </g>
  <g fill="#dcb774"><path d="m157 57 4 11 11 4-11 4-4 11-4-11-11-4 11-4z"/><path d="m410 302 4 11 11 4-11 4-4 11-4-11-11-4 11-4z"/></g>
  <g fill="#789487"><circle cx="69" cy="236" r="4"/><circle cx="289" cy="44" r="4"/><circle cx="453" cy="223" r="3"/></g>
`, '0 0 510 390', 'hero-illustration');

export const trophyArt = () => svg('<ellipse cx="100" cy="158" rx="59" ry="9" fill="#e6e8d9"/><g stroke="#34443d" stroke-width="2.5" stroke-linejoin="round"><path d="M62 24h76v49c0 47-76 47-76 0z" fill="#e6be75"/><path d="M62 37H36v19q0 30 30 32m72-51h26v19q0 30-30 32"/><path d="M100 109v34m-29 10h58l-8-13H79z" fill="#c7d8b2"/><path d="m100 42 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2z" fill="#fcf3cf"/></g><g fill="#b7cbb0"><path d="m29 104 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="m166 13 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/></g>', '0 0 200 180', 'trophy-art');

export const sceneBackground = (gameId,level='easy') => gameId === 'space' ? `<svg class="scene-backdrop" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="1000" height="500" fill="#eeebf5"/><g fill="#b6aacb"><circle cx="90" cy="64" r="3"/><circle cx="210" cy="35" r="2"/><circle cx="440" cy="75" r="3"/><circle cx="720" cy="35" r="2"/><circle cx="880" cy="95" r="3"/><circle cx="570" cy="25" r="2"/></g><circle cx="900" cy="70" r="50" fill="#ddd4e9"/><ellipse cx="900" cy="70" rx="80" ry="14" transform="rotate(-20 900 70)" fill="none" stroke="#baaccc" stroke-width="6"/><path d="M0 425Q250 345 500 430t500-10v80H0" fill="#d7cfe3"/><ellipse cx="200" cy="461" rx="60" ry="12" fill="#bfb2cf"/><ellipse cx="700" cy="480" rx="35" ry="7" fill="#bfb2cf"/></svg>` : `<svg class="scene-backdrop" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="1000" height="500" fill="${level==='hard'?'#e4e7f1':level==='medium'?'#f3e4d7':'#f7ecd8'}"/>${level==='hard'?'<path d="M907 29a37 37 0 1 0 16 56 31 31 0 0 1-16-56" fill="#f4efda"/><g fill="#c1c8d9"><circle cx="675" cy="44" r="3"/><circle cx="768" cy="81" r="2"/><circle cx="950" cy="119" r="3"/></g>':'<circle cx="890" cy="65" r="38" fill="#edcf8f"/>'}<path d="M0 360q200-50 400 0t600 0v140H0" fill="#bed8d5"/><path d="M0 398q200-40 400 0t600 0" fill="none" stroke="#a2c5c4" stroke-width="4"/><path d="M0 435q400-65 1000 15v50H0" fill="#edd8b5"/><path d="m90 430 8-8 8 8m70 26 6-6 6 6m660-14 8-8 8 8" fill="none" stroke="#c2a980" stroke-width="3"/></svg>`;

export function missionOutcomeArt(gameId, completed) {
  const space=gameId==='space';
  const scene=space?'<rect width="480" height="180" rx="24" fill="#efebf6"/><g fill="#a99abc"><circle cx="48" cy="42" r="2"/><circle cx="169" cy="26" r="2"/><circle cx="378" cy="41" r="3"/><circle cx="410" cy="109" r="2"/></g><circle cx="96" cy="105" r="34" fill="#d9cde8"/><ellipse cx="96" cy="105" rx="53" ry="9" transform="rotate(-20 96 105)" stroke="#b6a4ca" stroke-width="4"/><path d="M0 164q160-24 480 0v16H0" fill="#d4c8e2"/>' : '<rect width="480" height="180" rx="24" fill="#f7efdc"/><circle cx="385" cy="40" r="23" fill="#ead394"/><path d="M0 130q60-18 120 0t120 0 120 0 120 0v50H0" fill="#bcd9d8"/><path d="M0 154q60-15 120 0t120 0 120 0 120 0" stroke="#8fbaba" stroke-width="3"/>';
  const vehicle=space?'<g stroke="#435149" stroke-width="2" stroke-linejoin="round"><path class="launch-flame" d="m230 129 10 38 11-38" fill="#e7bd6a"/><path d="m224 110-17 26 24-7m25-19 18 26-24-7" fill="#ae91bc"/><path d="M224 129c-11-40-4-68 16-94 21 26 28 54 16 94z" fill="#fcf8ed"/><path d="m224 58 16-23 16 23" fill="#c0a3c8"/><circle cx="240" cy="90" r="13" fill="#90b6bf"/><path d="m235 84-3 7" stroke="#f7fcf9" stroke-width="3"/></g>' : '<g stroke="#435149" stroke-width="2" stroke-linejoin="round"><path d="m161 115 20 28h118l22-28z" fill="#bc8c65"/><path d="M181 128h117M205 115V79h55v36" fill="#edcf99"/><path d="m199 79 34-23 34 23z" fill="#b38368"/><rect x="226" y="92" width="15" height="23" rx="7" fill="#775e4a"/><path d="M262 89h28v26h-28z" fill="#e7c081"/></g>';
  return svg(`${scene}<g class="outcome-vehicle">${vehicle}</g>${completed?'<g class="arrival-check" stroke="#5d7d47" stroke-width="3"><circle cx="406" cy="127" r="20" fill="#f3f8e8"/><path d="m396 127 7 7 13-15"/></g>':''}`, '0 0 480 180', `mission-outcome-art ${space?'space':'ark'} ${completed?'departed':'waiting'}`);
}
