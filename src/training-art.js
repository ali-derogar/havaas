// Original exercise emblems, drawn for Havaas in the visual language of classic training games.
const marks = {
  hunt: '<circle cx="50" cy="50" r="25"/><circle cx="50" cy="50" r="12"/><path d="m50 50 24-24m-14 0h14v14"/><circle cx="26" cy="28" r="4" fill="currentColor" stroke="none"/><circle cx="75" cy="72" r="4" fill="currentColor" stroke="none"/>',
  ark: '<path d="m20 57 12 18h39l12-18zM34 57V37h31v20M29 37l21-15 21 15M49 46v11M19 82q8-6 16 0t16 0 16 0 16 0"/>',
  space: '<path d="M39 65c-7-22-3-39 11-52 14 13 18 30 11 52zM39 49 26 68l15-4m20-15 13 19-15-4M45 74l5 13 5-13"/><circle cx="50" cy="42" r="8"/><path d="M23 22v8m-4-4h8m48 7v8m-4-4h8"/>',
  traffic: '<rect x="36" y="15" width="28" height="62" rx="10"/><circle cx="50" cy="30" r="6" fill="currentColor" stroke="none"/><circle cx="50" cy="47" r="6"/><circle cx="50" cy="64" r="6"/><path d="M50 77v10M39 87h22"/>',
  search: '<rect x="22" y="22" width="13" height="13" rx="2"/><rect x="44" y="22" width="13" height="13" rx="2"/><rect x="66" y="22" width="13" height="13" rx="2"/><rect x="22" y="44" width="13" height="13" rx="2"/><rect x="22" y="66" width="13" height="13" rx="2"/><circle cx="59" cy="59" r="17"/><path d="m72 72 12 12m-32-25 5 5 10-11"/>',
  nback: '<rect x="16" y="26" width="24" height="39" rx="4" opacity=".55"/><rect x="38" y="34" width="24" height="39" rx="4" opacity=".8"/><rect x="60" y="26" width="24" height="39" rx="4"/><circle cx="28" cy="46" r="5" fill="currentColor" stroke="none"/><circle cx="72" cy="46" r="5" fill="currentColor" stroke="none"/><path d="m29 79 21 9 21-9m-7-3 7 3-3 7"/>',
  stroop: '<circle cx="35" cy="35" r="16" fill="currentColor" stroke="none" opacity=".5"/><rect x="49" y="20" width="31" height="31" rx="5"/><path d="m30 62 14 22H16zM58 66h24m-12-8v25"/>',
};

export function exerciseEmblem(gameId) {
  return `<span class="exercise-emblem" aria-hidden="true"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none"><g stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${marks[gameId] || marks.hunt}</g></svg></span>`;
}
