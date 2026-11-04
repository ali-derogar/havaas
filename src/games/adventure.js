import { Session } from '../core/session.js';
import { shuffle } from '../core/random.js';
import { LEVELS, LEGACY_ITEM_COUNTS, PROTOCOL } from '../config.js';

export const EQUIPMENT = {
  ark: [['water', 'آب آشامیدنی'], ['food', 'خوراک'], ['medkit', 'کمک‌های اولیه'], ['vest', 'جلیقهٔ نجات'], ['flashlight', 'چراغ‌قوه'], ['compass', 'قطب‌نما']],
  space: [['oxygen', 'اکسیژن'], ['suit', 'لباس فضایی'], ['fuel', 'سوخت'], ['helmet', 'کلاه فضایی'], ['food', 'خوراک'], ['map', 'نقشهٔ فضایی']],
};
export const EQUIPMENT_REASONS = {
  water: 'در سفر به آب آشامیدنی نیاز داری.', food: 'خوراک برای انرژی در طول سفر لازم است.',
  medkit: 'برای رسیدگی به آسیب‌های کوچک، جعبهٔ کمک‌های اولیه همراهت باشد.',
  vest: 'جلیقهٔ نجات برای ایمنی سفر روی آب لازم است.', flashlight: 'با چراغ‌قوه می‌توانی در تاریکی راه را ببینی.',
  compass: 'قطب‌نما کمک می‌کند جهت حرکت کشتی را پیدا کنی.', oxygen: 'در فضا هوای قابل‌تنفس وجود ندارد؛ اکسیژن همراهت ببر.',
  suit: 'لباس فضایی برای بیرون‌رفتن از سفینه لازم است.', fuel: 'سفینه برای حرکت به سوخت نیاز دارد.',
  helmet: 'کلاه فضایی بخشی از تجهیزات محافظ سفر است.', map: 'نقشهٔ فضایی برای پیدا‌کردن مسیر به کار می‌آید.',
};
export const EQUIPMENT_NEEDS = {water:'رفع تشنگی',food:'انرژی سفر',medkit:'رسیدگی به آسیب',vest:'ایمنی روی آب',flashlight:'دیدن در تاریکی',compass:'جهت‌یابی',oxygen:'هوای قابل‌تنفس',suit:'محافظت بیرون سفینه',fuel:'حرکت سفینه',helmet:'محافظت از سر',map:'یافتن مسیر'};
export const JOURNEYS = {
  ark:{easy:'هوا روشن است. آب در حال بالا آمدن است؛ برای یک سفر کوتاه و امن آماده شو.',medium:'کشتی نزدیک غروب حرکت می‌کند. برای سفر و تاریکیِ پیش رو آماده شو.',hard:'سفری شبانه در مسیر ناآشنا در پیش است. هم ایمنی و هم پیدا‌کردن راه مهم‌اند.'},
  space:{easy:'یک پرواز کوتاه مداری در پیش است. تجهیزات حرکت و محافظت در فضا را آماده کن.',medium:'پرواز طولانی‌تر شده است. علاوه بر تجهیزات پرواز، به انرژی برای ادامهٔ سفر نیاز داری.',hard:'مقصدی دور در مسیری ناآشنا منتظر توست. برای پرواز، ادامهٔ سفر و یافتن مسیر آماده شو.'},
};
export const MISSIONS = {
  ark: { title: 'نجات در ساحل امید', story: 'آب بالا می‌آید و کشتی به‌زودی حرکت می‌کند. از بین وسایل ساحل، وسایل ضروری سفر را انتخاب کن و به‌موقع سوار شو.', success: 'وسایل ضروری همراهت است و پیش از پایان زمان سوار کشتی شدی. سفر امنی داشته باشی!' },
  space: { title: 'آماده‌سازی سفر فضایی', story: 'فرصت پرتاب محدود است. تجهیزات سفر را پیدا کن؛ بعضی وسایل لازم پشت مانع هستند. مانع را کنار بزن، وسیله را بردار و سفینه را پرتاب کن.', success: 'موانع را کنار زدی، تجهیزات سفر را کامل کردی و به‌موقع به فضا رفتی!' },
};
const LEGACY_DISTRACTORS = [['ball', 'توپ'], ['guitar', 'گیتار'], ['plant', 'گلدان'], ['notebook', 'دفتر نقاشی'], ['teddy', 'خرس عروسکی'], ['television', 'تلویزیون'], ['kite', 'بادبادک'], ['painting', 'تابلو'], ['chair', 'صندلی'], ['clock', 'ساعت دیواری'], ['skate', 'اسکیت'], ['duck', 'اردک اسباب‌بازی'], ['crown', 'تاج'], ['gift', 'جعبهٔ کادو'], ['lamp', 'آباژور'], ['gamepad', 'دستهٔ بازی'], ['vase', 'گلدان تزئینی'], ['racket', 'راکت']];
export const DISTRACTORS = [...LEGACY_DISTRACTORS,['book','کتاب داستان'],['camera','دوربین'],['umbrella','چتر'],['shoe','کفش'],['puzzle','پازل'],['glasses','عینک آفتابی'],['radio','رادیو'],['cap','کلاه آفتابی'],['bucket','سطل'],['telescope','تلسکوپ'],['watch','ساعت مچی'],['violin','ویولن']];
function scatter(count,width,height,gap,random){
  const positions=[];
  for(let attempt=0;positions.length<count&&attempt<30000;attempt++){
    const point={x:28+random()*(width-56),y:28+random()*(height-56)};
    if(positions.every(p=>Math.hypot(point.x-p.x,point.y-p.y)>=gap))positions.push(point);
  }
  // A bounded fallback keeps all controls reachable even for an unusual random source.
  if(positions.length<count){
    const columns=width<400?4:8,rows=Math.ceil(count/columns);
    return shuffle(Array.from({length:count},(_,i)=>({x:width*(i%columns+.5)/columns,y:height*(Math.floor(i/columns)+.5)/rows})),random);
  }
  return positions;
}
export class AdventureSession extends Session {
  constructor(options) {
    super(options);this.clock.pause(); const settings = LEVELS[this.level];
    this.mission = {...MISSIONS[this.gameId],story:JOURNEYS[this.gameId][this.level]}; this.clearedObstacles = 0; this.events = [];
    this.decisionOnset=0;this.reactionMeasure='decision-interval';
    this.required = EQUIPMENT[this.gameId].slice(0, this.practice ? 3 : settings.required);
    const revised=this.stimulusVersion>=6;
    const extras = shuffle(revised?DISTRACTORS:LEGACY_DISTRACTORS, this.random).slice(0, this.practice ? 2 : (revised?settings.items:LEGACY_ITEM_COUNTS[this.level]) - settings.required);
    this.items = shuffle([...this.required.map(([icon, name]) => ({ icon, name, required: true })), ...extras.map(([icon, name]) => ({ icon, name, required: false }))], this.random).map((item, index) => ({ ...item, id: index, collected: false, rejected: false, blocked: false }));
    if (this.gameId === 'space') {
      const blocked = this.practice ? [this.items[0]] : shuffle(this.items.filter(item=>item.required),this.random).slice(0,settings.obstacles);
      for (const item of blocked) item.blocked = true;
    }
    this.scattered=revised&&!this.practice&&this.level!=='easy';
    if(this.scattered){
      this.fieldHeights=this.stimulusVersion>=8?{desktop:Math.max(440,this.items.length*9+140),mobile:this.items.length*16+42}:{desktop:Math.max(440,this.items.length*10+180),mobile:this.items.length*20+60};
      const desktop=scatter(this.items.length,900,this.fieldHeights.desktop,80,this.random),mobile=scatter(this.items.length,300,this.fieldHeights.mobile,52,this.random);
      this.items.forEach((item,i)=>{item.layout={desktop:{x:desktop[i].x/9,y:desktop[i].y/this.fieldHeights.desktop*100},mobile:{x:mobile[i].x/3,y:mobile[i].y/this.fieldHeights.mobile*100},angle:(this.random()-.5)*(this.level==='hard'?30:18),layer:1+Math.floor(this.random()*4)};});
    }
    this.total = this.practice ? 5 : this.required.length; this.maxScore = this.required.length; this.judged = 0; this.penaltyMs = 0; this.limitMs = this.practice ? Infinity : settings.seconds * 1000;this.clock.resume();
  }
  get currentItem() { return this.items[this.judged]; }
  get score() { return this.metrics.hits; }
  get remainingMs() { return Math.max(0, this.limitMs - this.clock.elapsed - this.penaltyMs); }
  get ready() { return this.metrics.hits === this.required.length; }
  tick() { if (this.done || this.paused) return; if (this.remainingMs <= 0) { for (const item of this.items.filter(item => item.required && !item.collected)) this.record(true, false, null, { item: item.name, itemId:item.id }); this.finish(false); } }
  choose(id) {
    if (this.done || this.paused) return null;
    this.tick(); if (this.done) return null;
    const item = this.items.find(value => value.id === id);
    if (!item || item.collected || item.rejected || this.practice && item !== this.currentItem) return null;
    if (item.blocked) { item.blocked = false; this.events.push({kind:'clear',itemId:item.id,atMs:Math.round(this.clock.elapsed)}); this.clearedObstacles++; this.decisionOnset=this.clock.elapsed;this.feedback = 'مانع کنار رفت! حالا وسیله رو بررسی کن.'; this.feedbackKind = 'good'; return 'cleared'; }
    this.record(item.required, true, item.required?this.clock.elapsed-this.decisionOnset:null, { item: item.name, itemId:item.id });
    this.decisionOnset=this.clock.elapsed;
    if (item.required) item.collected = true;
    else { item.rejected = true; if (!this.practice) this.penaltyMs += PROTOCOL.penaltyMs; }
    this.feedback = item.required ? `آفرین! ${item.name}: ${EQUIPMENT_REASONS[item.icon]}` : this.practice ? `${item.name} برای این سفر ضروری نیست.` : 'این وسیله ضروری نبود؛ ۲ ثانیه کمتر شد.';
    this.feedbackKind = item.required ? 'good' : 'wrong';
    if (this.practice) this.advancePractice(); else this.tick();
    return item.required;
  }
  reject() {
    if (!this.practice || this.done || this.paused || this.currentItem.blocked) return null;
    const item = this.currentItem; this.record(item.required, false, null, { item: item.name, itemId:item.id });
    this.decisionOnset=this.clock.elapsed;
    item.rejected = true; this.feedback = item.required ? `${item.name} لازم بود: ${EQUIPMENT_REASONS[item.icon]}` : 'درسته! این وسیله ضروری نیست.';
    this.feedbackKind = item.required ? 'wrong' : 'good'; this.advancePractice(); return !item.required;
  }
  advancePractice() { if(this.reviewEnabled){this.beginReview({kind:'adventure',item:{...this.currentItem},outcome:this.outcomes.at(-1)});return;}this.advanceDecision(); }
  advanceDecision(){this.judged++;if(this.judged===this.total)this.finish();}
  continueReview(){if(!this.review)return;this.review=null;this.clock.resume();this.decisionOnset=this.clock.elapsed;this.advanceDecision();}
  get result() { return { ...super.result, events:this.events.map(event=>({...event})), mission: this.mission.title, obstaclesCleared: this.clearedObstacles, departed: !this.practice && this.completed, inventory: this.items.filter(item=>item.collected).map(item=>item.name) }; }
  depart() { this.tick(); if (this.done || this.paused || this.practice || !this.ready) return false; this.events.push({kind:'depart',atMs:Math.round(this.clock.elapsed)}); this.finish(true); return true; }
}
