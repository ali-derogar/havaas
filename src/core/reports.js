import { GAME_MAP } from '../config.js';
import { variantOf } from './clients.js';

export function performanceOf(result) {
  const hits = result.hits || 0, misses = result.omissions || 0, wrong = result.falseSelections || 0, correct = result.correctResponses || 0;
  const count = correct + misses + wrong;
  return { count, accuracy: count ? correct / count : 0, recall: result.maxScore > 0 ? hits / result.maxScore : hits + misses ? hits / (hits + misses) : 0, errorRate: count ? wrong / count : 0 };
}
export function recommendLevel(result) {
  const levels = ['easy','medium','hard'], index = Math.max(0, levels.indexOf(result.level));
  const p = performanceOf(result), kind = GAME_MAP[result.gameId]?.kind;
  const speedLimit = kind === 'reaction' ? 650 : kind === 'search' ? 5000 : 6000;
  const fast = Number.isFinite(result.meanReactionMs) && result.meanReactionMs <= speedLimit;
  const streak = result.longestStreak >= Math.min(10, p.count);
  if (p.recall < .6 || p.accuracy < .65 || p.errorRate > .25 || !result.completed) return { level: levels[Math.max(0,index-1)], reason: 'برای تمرین تشخیص هدف و کاهش خطا، این سطح پیشنهاد می‌شود.' };
  if (p.count >= 5 && p.recall >= .85 && p.accuracy >= .9 && p.errorRate <= .1 && fast && streak) return { level: levels[Math.min(2,index+1)], reason: 'پاسخ‌های درست، سرعت مناسب و زنجیرهٔ پاسخ‌ها نشان می‌دهند که برای چالش بعدی آماده‌ای.' };
  return { level: levels[index], reason: 'ادامه در همین سطح به تمرین سرعت، دقت و پاسخ‌های پیوسته کمک می‌کند.' };
}
export const stimulusFamilyOf = result => {
  if(result.gameId!=='hunt')return '';
  const family=result.stimulusFamily||result.settingsSnapshot?.theme;
  return typeof family==='string'&&family?family:'unknown';
};
export function comparableRecords(records, reference = records.at(-1)) {
  if (!reference) return [];
  const last = reference.result;
  return records.filter(r => r.result.gameId === last.gameId && r.result.level === last.level && variantOf(r.result) === variantOf(last) && stimulusFamilyOf(r.result) === stimulusFamilyOf(last) && (r.result.feedbackMode||'continuous') === (last.feedbackMode||'continuous') && (r.result.roundFlow||'continuous') === (last.roundFlow||'continuous') && (r.result.stimulusVersion||1) === (last.stimulusVersion||1) && (r.result.protocolVersion || 2) === (last.protocolVersion || 2) && r.kind === reference.kind);
}
export function observations(result) {
  const p = performanceOf(result), strengths = [], practice = [];
  if (p.recall >= .8 && result.hits > 0) strengths.push('بیشتر هدف‌ها به‌درستی شناسایی شده‌اند.');
  else practice.push('در نوبت بعد، روی شناسایی هدف و کمتر جاانداختن آن تمرین کنید.');
  if (result.falseSelections === 0 && result.hits > 0) strengths.push('انتخاب اشتباه ثبت نشده است.');
  if (result.falseSelections > 0) practice.push('پیش از انتخاب، قانون و جزئیات محرک را دوباره بررسی کنید.');
  if (result.longestStreak >= Math.min(10,p.count) && p.count >= 5) strengths.push('چند تصمیم درست به‌صورت پیوسته ثبت شده است.');
  if (!result.completed) practice.push('برای کامل‌کردن سفر در زمان تعیین‌شده، دوباره در همین سطح یا سطح آسان‌تر تمرین کنید.');
  if (!strengths.length) strengths.push('این جلسه نقطهٔ شروعی برای مقایسه با تمرین‌های بعدی است.');
  return { strengths, practice };
}
export function progressText(records, reference = records.at(-1)) {
  const comparable = comparableRecords(records, reference);
  if (comparable.length < 2) return 'برای بررسی روند، دست‌کم دو جلسه در یک بازی، سطح و حالت لازم است.';
  const first = performanceOf(comparable[0].result).accuracy, last = performanceOf(comparable.at(-1).result).accuracy;
  const delta = Math.round((last-first)*100);
  return delta > 0 ? `دقت نسبت به نخستین جلسهٔ هم‌سطح ${delta.toLocaleString('fa-IR')} واحد درصد بیشتر شده است.` : delta < 0 ? `دقت نسبت به نخستین جلسهٔ هم‌سطح ${Math.abs(delta).toLocaleString('fa-IR')} واحد درصد کمتر شده است؛ یک تمرین دیگر روند را روشن‌تر می‌کند.` : 'دقت در نخستین و آخرین جلسهٔ هم‌سطح برابر بوده است.';
}

export function parentNarrative(record, records) {
  const r=record.result,p=performanceOf(r),fa=value=>Number(value).toLocaleString('fa-IR');
  const response=r.meanReactionMs===null?'در این جلسه زمان واکنشِ درست قابل محاسبه نبود.':`میانگین زمان ${r.reactionMeasure==='decision-interval'?'انتخاب درست':'واکنش درست'} ${fa(r.meanReactionMs)} میلی‌ثانیه بود.`;
  return `در ${record.kind==='baseline'?'ارزیابی اولیهٔ':'تمرین'} ${GAME_MAP[r.gameId].title}، ${fa(r.hits)} هدف از ${fa(r.maxScore)} هدف شناسایی شد و ${fa(r.correctResponses)} تصمیم از ${fa(p.count)} تصمیم درست بود. ${fa(r.omissions)} هدف بدون پاسخ و ${fa(r.falseSelections)} انتخاب اشتباه ثبت شد. طولانی‌ترین زنجیرهٔ تصمیم‌های درست ${fa(r.longestStreak)} بود. ${response} ${progressText(records,record)}`;
}
