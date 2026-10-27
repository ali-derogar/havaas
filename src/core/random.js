export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export const pick = (values, random = Math.random) => values[Math.floor(random() * values.length)];
export const targetMask = (count, targets, random = Math.random) => shuffle(Array.from({ length: count }, (_, i) => i < targets), random);
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value += 0x6d2b79f5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
