import {getLocale,translate} from '../i18n.js';
import {numberLocale} from '../i18n.js';
import {t as uiText,lt} from '../i18n.js';
import {timingKey} from '../game-timing.js';
import { GAME_MAP } from '../config.js';
import { variantOf } from './clients.js';

export function performanceOf(result) {
  const hits = result.hits || 0, misses = result.omissions || 0, wrong = result.falseSelections || 0, correct = result.correctResponses || 0;
  const count = correct + misses + wrong;
  return { count, accuracy: count ? correct / count : 0, recall: result.maxScore > 0 ? hits / result.maxScore : hits + misses ? hits / (hits + misses) : 0, errorRate: count ? wrong / count : 0 };
}
export function needsMorePractice(result) {
  const p = performanceOf(result);
  return p.recall < .6 || p.accuracy < .65 || p.errorRate > .25 || !result.completed;
}
export function recommendLevel(result) {
  const levels = ['easy','medium','hard'], index = Math.max(0, levels.indexOf(result.level));
  const p = performanceOf(result), kind = GAME_MAP[result.gameId]?.kind;
  const speedLimit = kind === 'reaction' ? 650 : kind === 'search' ? 5000 : 6000;
  const fast = Number.isFinite(result.meanReactionMs) && result.meanReactionMs <= speedLimit;
  const streak = result.longestStreak >= Math.min(10, p.count);
  if (needsMorePractice(result)) return { level: levels[Math.max(0,index-1)], reason: uiText('تمرین در این سطح کمک می‌کند هدف‌ها را بهتر پیدا کنی و کمتر اشتباه کنی.') };
  if (p.count >= 5 && p.recall >= .85 && p.accuracy >= .9 && p.errorRate <= .1 && fast && streak) return { level: levels[Math.min(2,index+1)], reason: uiText('پاسخ‌ها دقیق و سریع بودند. این سطح برای ادامهٔ تمرین پیشنهاد می‌شود.') };
  return { level: levels[index], reason: uiText('بهتر است کمی بیشتر در همین سطح تمرین کنی تا دقت و سرعتت بهتر شود.') };
}
export const stimulusFamilyOf = result => {
  if(result.gameId!=='hunt')return '';
  const family=result.stimulusFamily||result.settingsSnapshot?.theme;
  return typeof family==='string'&&family?family:'unknown';
};
export function comparableRecords(records, reference = records.at(-1)) {
  if (!reference) return [];
  const last = reference.result;
  return records.filter(r => r.result.gameId === last.gameId && (last.gameId!=='stroop'||(r.result.locale||'fa')===(last.locale||'fa')) && (r.result.experienceVersion??1) === (last.experienceVersion??1) && ((r.result.experienceVersion??1)<3||Boolean(r.result.timing&&last.timing&&timingKey(r.result.timing)===timingKey(last.timing))) && r.result.level === last.level && variantOf(r.result) === variantOf(last) && stimulusFamilyOf(r.result) === stimulusFamilyOf(last) && (r.result.feedbackMode||'continuous') === (last.feedbackMode||'continuous') && (r.result.roundFlow||'continuous') === (last.roundFlow||'continuous') && (r.result.stimulusVersion||1) === (last.stimulusVersion||1) && (r.result.protocolVersion || 2) === (last.protocolVersion || 2) && r.kind === reference.kind);
}
export function observations(result) {
  const p = performanceOf(result), strengths = [], practice = [];
  if (p.recall >= .8 && result.hits > 0) strengths.push(uiText('بیشتر هدف‌ها درست پیدا شده‌اند.'));
  else practice.push(uiText('در تمرین بعد، به نمونهٔ هدف بیشتر دقت کنید تا هدف‌های کمتری از دست بروند.'));
  if (result.falseSelections === 0 && result.hits > 0) strengths.push(uiText('انتخاب اشتباه ثبت نشده است.'));
  if (result.falseSelections > 0) practice.push(uiText('قبل از انتخاب، یک بار دیگر به قانون بازی و گزینه‌ها نگاه کنید.'));
  if (result.longestStreak >= Math.min(10,p.count) && p.count >= 5) strengths.push(uiText('چند تصمیم درست پشت سر هم ثبت شده است.'));
  if (!result.completed) practice.push(uiText('برای تمام‌کردن بازی پیش از پایان زمان، دوباره در همین سطح یا سطح آسان‌تر تمرین کنید.'));
  if (!strengths.length) strengths.push(uiText('می‌توان نتیجهٔ این جلسه را با تمرین‌های بعدی مقایسه کرد.'));
  return { strengths, practice };
}
export function progressText(records, reference = records.at(-1),locale=getLocale()) {
  const comparable = comparableRecords(records, reference);
  if(locale==='en'){if(comparable.length<2)return 'At least two sessions with matching game, level and conditions are needed to compare progress.';const delta=Math.round((performanceOf(comparable.at(-1).result).accuracy-performanceOf(comparable[0].result).accuracy)*100);return delta?`Accuracy is ${Math.abs(delta)} percentage points ${delta>0?'higher':'lower'} than in the first comparable session.`:'Accuracy is unchanged from the first comparable session.';}
  if (comparable.length < 2) return uiText('برای مقایسهٔ نتیجه‌ها، باید دست‌کم دو جلسه از همین بازی با سطح و شرایط یکسان ثبت شود.');
  const first = performanceOf(comparable[0].result).accuracy, last = performanceOf(comparable.at(-1).result).accuracy;
  const delta = Math.round((last-first)*100);
  return delta > 0 ? lt`دقت نسبت به نخستین جلسهٔ هم‌سطح ${delta.toLocaleString(numberLocale())} واحد درصد بیشتر شده است.` : delta < 0 ? lt`دقت نسبت به نخستین جلسهٔ هم‌سطح ${Math.abs(delta).toLocaleString(numberLocale())} واحد درصد کمتر شده است؛ با تمرین‌های بیشتر، مقایسه دقیق‌تر می‌شود.` : uiText('دقت در نخستین و آخرین جلسهٔ هم‌سطح برابر بوده است.');
}

export function parentNarrative(record, records,locale=getLocale()) {
  const r=record.result,p=performanceOf(r),fa=value=>Number(value).toLocaleString(numberLocale());
  if(locale==='en'){const response=r.meanReactionMs===null?'No correct-response time was recorded.':`Mean correct-response time was ${r.meanReactionMs} milliseconds.`;return `In ${translate(GAME_MAP[r.gameId].title,'en')}, ${r.hits} of ${r.maxScore} targets were identified and ${r.correctResponses} of ${p.count} decisions were correct. There were ${r.omissions} missed targets and ${r.falseSelections} incorrect selections. The longest correct streak was ${r.longestStreak}. ${response} ${progressText(records,record,locale)}`;}
  const response=r.meanReactionMs===null?uiText('زمان پاسخ درست برای این جلسه ثبت نشده است.'):lt`میانگین زمان ${r.reactionMeasure==='decision-interval'?uiText('انتخاب درست'):uiText('واکنش درست')} ${fa(r.meanReactionMs)} میلی‌ثانیه بود.`;
  return lt`در ${record.kind==='baseline'?uiText('ارزیابی اولیهٔ'):uiText('تمرین')} ${GAME_MAP[r.gameId].title}، ${fa(r.hits)} هدف از ${fa(r.maxScore)} هدف شناسایی شد و ${fa(r.correctResponses)} تصمیم از ${fa(p.count)} تصمیم درست بود. ${fa(r.omissions)} هدف بدون پاسخ و ${fa(r.falseSelections)} انتخاب اشتباه ثبت شد. بیشترین تعداد تصمیم درست پشت سر هم ${fa(r.longestStreak)} بود. ${response} ${progressText(records,record)}`;
}
