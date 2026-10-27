import { GAME_MAP, LEVELS } from '../config.js';

export const CLIENTS_KEY = 'havaas:clients:v1';
const blank = () => ({ version: 1, activeId: null, profiles: [], records: [] });
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function readClients(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(CLIENTS_KEY));
    if (value?.version !== 1 || !Array.isArray(value.profiles) || !Array.isArray(value.records)) return blank();
    const profiles = value.profiles.filter(p => p && typeof p.id === 'string' && typeof p.firstName === 'string' && typeof p.lastName === 'string');
    const records = value.records.filter(r => r && profiles.some(p => p.id === r.profileId) && GAME_MAP[r.result?.gameId] && LEVELS[r.result?.level] && ['baseline', 'training'].includes(r.kind) && Number.isFinite(r.result.score) && Number.isFinite(r.result.maxScore) && Number.isFinite(r.result.hits) && Number.isFinite(r.result.correctResponses) && Number.isFinite(r.result.omissions) && Number.isFinite(r.result.falseSelections));
    return { version: 1, activeId: profiles.some(p => p.id === value.activeId) ? value.activeId : null, profiles, records };
  } catch { return blank(); }
}
export function writeClients(clients, storage) {
  try { (storage ?? globalThis.localStorage).setItem(CLIENTS_KEY, JSON.stringify(clients)); return true; } catch { return false; }
}
export const activeProfile = clients => clients.profiles.find(p => p.id === clients.activeId) ?? null;
export const profileRecords = (clients, id = clients.activeId) => clients.records.filter(r => r.profileId === id);
export const variantOf = result => result.variant || 'standard';
export function latestBaseline(clients, gameId, variant = 'standard') {
  return profileRecords(clients).filter(r => r.kind === 'baseline' && r.result.gameId === gameId && variantOf(r.result) === variant).at(-1)?.result ?? null;
}
export function validateProfile(input, today = new Date()) {
  const profile = Object.fromEntries(['firstName','lastName','birthDate','grade','school','concerns'].map(key => [key, String(input[key] ?? '').trim()]));
  if (!profile.firstName || !profile.lastName || !profile.birthDate || !profile.grade || !profile.school) return { error: 'نام، نام خانوادگی، تاریخ تولد، پایه و مدرسه را کامل کن.' };
  if (Object.values(profile).some(value => value.length > 500)) return { error: 'طول هر بخش باید کمتر از ۵۰۰ نویسه باشد.' };
  const birthday = new Date(`${profile.birthDate}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) || !Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0,10) !== profile.birthDate || birthday > today || birthday.getFullYear() < today.getFullYear() - 100) return { error: 'یک تاریخ تولد معتبر در گذشته وارد کن.' };
  return { profile };
}
export function addRecord(clients, result, kind) {
  if (!activeProfile(clients)) return null;
  const record = { id: uid(), profileId: clients.activeId, kind, result: { ...result } };
  clients.records.push(record);
  return record;
}
export function deleteProfile(clients, id) {
  clients.profiles = clients.profiles.filter(p => p.id !== id);
  clients.records = clients.records.filter(r => r.profileId !== id);
  if (clients.activeId === id) clients.activeId = clients.profiles[0]?.id ?? null;
}
