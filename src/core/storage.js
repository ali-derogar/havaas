export const STORAGE_KEY = 'havaas:v1';
export function readProgress(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const value = JSON.parse(target.getItem(STORAGE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return { version: 1, games: {}, sound: false };
    return { version: 1, games: value.games && typeof value.games === 'object' && !Array.isArray(value.games) ? value.games : {}, sound: value.sound === true };
  } catch { return { version: 1, games: {}, sound: false }; }
}
export function writeProgress(progress, storage) {
  try { (storage === undefined ? globalThis.localStorage : storage).setItem(STORAGE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
export function saveResult(progress, result) {
  const key = resultKey(result);
  const old = progress.games[key];
  const better = !Number.isFinite(old?.best?.score) || result.score > old.best.score || result.score === old.best.score && result.completed && !old.best.completed;
  progress.games[key] = { last: result, best: better ? result : old.best };
  return progress;
}
export function resultKey(result) {
  const base=`${result.gameId}:${result.level}`;
  return result.variant && result.variant!=='standard' ? `${base}:${result.variant}` : base;
}
