import { Session } from '../core/session.js';
import { shuffle } from '../core/random.js';
import { LEVELS, PROTOCOL } from '../config.js';

export const EQUIPMENT = {
  ark: [['water', 'آب آشامیدنی'], ['food', 'خوراک'], ['medkit', 'کمک‌های اولیه'], ['vest', 'جلیقهٔ نجات'], ['flashlight', 'چراغ‌قوه'], ['compass', 'قطب‌نما']],
  space: [['oxygen', 'اکسیژن'], ['suit', 'لباس فضایی'], ['fuel', 'سوخت'], ['helmet', 'کلاه فضایی'], ['food', 'خوراک'], ['map', 'نقشهٔ فضایی']],
};
export const DISTRACTORS = [['ball', 'توپ'], ['guitar', 'گیتار'], ['plant', 'گلدان'], ['notebook', 'دفتر نقاشی'], ['teddy', 'خرس عروسکی'], ['television', 'تلویزیون'], ['kite', 'بادبادک'], ['painting', 'تابلو'], ['chair', 'صندلی'], ['clock', 'ساعت دیواری'], ['skate', 'اسکیت'], ['duck', 'اردک اسباب‌بازی'], ['crown', 'تاج'], ['gift', 'جعبهٔ کادو'], ['lamp', 'آباژور'], ['gamepad', 'دستهٔ بازی'], ['vase', 'گلدان تزئینی'], ['racket', 'راکت']];
export class AdventureSession extends Session {
  constructor(options) {
    super(options); const settings = LEVELS[this.level];
    this.decisionOnset=0;this.reactionMeasure='decision-interval';
    this.required = EQUIPMENT[this.gameId].slice(0, this.practice ? 3 : settings.required);
    const extras = shuffle(DISTRACTORS, this.random).slice(0, this.practice ? 2 : settings.items - settings.required);
    this.items = shuffle([...this.required.map(([icon, name]) => ({ icon, name, required: true })), ...extras.map(([icon, name]) => ({ icon, name, required: false }))], this.random).map((item, index) => ({ ...item, id: index, collected: false, rejected: false, blocked: this.gameId === 'space' && index < (this.practice ? 1 : settings.obstacles) }));
    this.total = this.practice ? 5 : this.required.length; this.maxScore = this.required.length; this.judged = 0; this.penaltyMs = 0; this.limitMs = this.practice ? Infinity : settings.seconds * 1000;
  }
  get currentItem() { return this.items[this.judged]; }
  get score() { return this.metrics.hits; }
  get remainingMs() { return Math.max(0, this.limitMs - this.clock.elapsed - this.penaltyMs); }
  get ready() { return this.metrics.hits === this.required.length; }
  tick() { if (this.done || this.paused) return; if (this.remainingMs <= 0) { this.metrics.misses = this.required.length - this.metrics.hits; this.finish(false); } }
  choose(id) {
    if (this.done || this.paused) return null;
    this.tick(); if (this.done) return null;
    const item = this.items.find(value => value.id === id);
    if (!item || item.collected || item.rejected || this.practice && item !== this.currentItem) return null;
    if (item.blocked) { item.blocked = false; this.decisionOnset=this.clock.elapsed;this.feedback = 'مانع کنار رفت! حالا وسیله رو بررسی کن.'; this.feedbackKind = 'good'; return 'cleared'; }
    this.record(item.required, true, item.required?this.clock.elapsed-this.decisionOnset:null);
    this.decisionOnset=this.clock.elapsed;
    if (item.required) item.collected = true;
    else { item.rejected = true; if (!this.practice) this.penaltyMs += PROTOCOL.penaltyMs; }
    this.feedback = item.required ? `آفرین! ${item.name} لازمت می‌شه.` : this.practice ? `${item.name} برای این سفر ضروری نیست.` : 'این وسیله ضروری نبود؛ ۲ ثانیه کمتر شد.';
    this.feedbackKind = item.required ? 'good' : 'wrong';
    if (this.practice) this.advancePractice(); else this.tick();
    return item.required;
  }
  reject() {
    if (!this.practice || this.done || this.paused || this.currentItem.blocked) return null;
    const item = this.currentItem; this.record(item.required, false);
    this.decisionOnset=this.clock.elapsed;
    item.rejected = true; this.feedback = item.required ? `${item.name} برای این سفر لازم بود.` : 'درسته! این وسیله ضروری نیست.';
    this.feedbackKind = item.required ? 'wrong' : 'good'; this.advancePractice(); return !item.required;
  }
  advancePractice() { this.judged++; if (this.judged === this.total) this.finish(); }
  depart() { this.tick(); if (this.done || this.paused || this.practice || !this.ready) return false; this.finish(true); return true; }
}
