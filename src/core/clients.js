import { GAME_MAP, GAME_PROTOCOLS, LEVELS } from '../config.js';

export const CLIENTS_KEY = 'havaas:clients:v1';
const blank = () => ({ version: 1, activeId: null, profiles: [], records: [] });
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function isValidText(value){
  if(typeof value!=='string'||value.includes('\0'))return false;
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i);
    if(code>=0xd800&&code<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}
    else if(code>=0xdc00&&code<=0xdfff)return false;
  }
  return true;
}
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
export function latestBaseline(clients, gameId, variant = 'standard', level = null) {
  return profileRecords(clients).filter(r => r.kind === 'baseline' && (!level || r.result.level === level) && r.result.gameId === gameId && (r.result.protocolVersion || 2) === GAME_PROTOCOLS[gameId] && variantOf(r.result) === variant).at(-1)?.result ?? null;
}
export function validateProfile(input, today = new Date()) {
  const keys=['firstName','lastName','birthDate','grade','school','concerns'];
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'ساختار اطلاعات مشخصات معتبر نیست.'};
  if(keys.some(key=>input[key]!==undefined&&input[key]!==null&&typeof input[key]!=='string'))return {error:'نام، تاریخ و سایر مشخصات باید به‌صورت متن وارد شوند.'};
  const profile = Object.fromEntries(keys.map(key => [key, (input[key] ?? '').trim()]));
  if(Object.values(profile).some(value=>!isValidText(value)))return {error:'متن مشخصات شامل نویسهٔ نامعتبر است؛ آن بخش را دوباره وارد کنید.'};
  if (!profile.firstName || !profile.lastName || !profile.birthDate || !profile.grade || !profile.school) return { error: 'نام، نام خانوادگی، تاریخ تولد، پایه و مدرسه را کامل کن.' };
  if (Object.values(profile).some(value => value.length > 500)) return { error: 'طول هر بخش باید کمتر از ۵۰۰ نویسه باشد.' };
  const birthday = new Date(`${profile.birthDate}T12:00:00Z`);
  const todayDate = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) || !Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0,10) !== profile.birthDate || profile.birthDate > todayDate || birthday.getUTCFullYear() < today.getFullYear() - 100) return { error: 'یک تاریخ تولد معتبر در گذشته وارد کن.' };
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
