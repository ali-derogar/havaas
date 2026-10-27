/** @typedef {'easy'|'medium'|'hard'} Difficulty */
/** @typedef {{id:string,title:string,subtitle:string,kind:'reaction'|'adventure'|'search',tags:string[],description:string,rules:string[],color:string,accent:string,time:string}} GameConfig */
/** @typedef {{version:1,protocolVersion:number,gameId:string,level:Difficulty,variant:string,score:number,maxScore:number,hits:number,correctResponses:number,correctRejections:number,omissions:number,falseSelections:number,meanReactionMs:number|null,reactionMeasure:'stimulus-onset'|'search-onset'|'decision-interval',longestStreak:number,durationMs:number,completed:boolean,finishedAt:string,outcomes:Array<{number:number,target:boolean,response:boolean,correct:boolean,reactionMs:number|null,atMs:number}>}} SessionResult */

export const LEVELS = {
  easy: { label: 'آسان', caption: 'با خیال راحت شروع کن', visibleMs: 300, items: 12, required: 4, seconds: 60, obstacles: 2, searchSeconds: 30, n: 1 },
  medium: { label: 'متوسط', caption: 'یک چالش حسابی', visibleMs: 200, items: 18, required: 5, seconds: 45, obstacles: 3, searchSeconds: 20, n: 2 },
  hard: { label: 'سخت', caption: 'آمادهٔ تمرکز بیشتر؟', visibleMs: 100, items: 24, required: 6, seconds: 30, obstacles: 4, searchSeconds: 15, n: 3 },
};
export const PRESENTATION_VERSION = 4;
export const PROTOCOL = { trials: 150, targets: 30, intervalMs: 1000, practiceTrials: 5, previewMs: 2000, searchRounds: 10, penaltyMs: 2000, huntBlocks: [20,50,80] };
export const HUNT_SETTINGS = {
  easy: { sceneItems: 3, nearRatio: 0, size: 86, positions: [{x:25,y:50},{x:50,y:50},{x:75,y:50}], background: 'garden' },
  medium: { sceneItems: 5, nearRatio: 0.5, size: 74, positions: [22,50,78].flatMap(x=>[30,70].map(y=>({x,y}))), background: 'garden' },
  hard: { sceneItems: 7, nearRatio: 0.9, size: 56, positions: [18,50,82].flatMap(x=>[24,50,76].map(y=>({x,y}))), background: 'abstract' },
};
export const THEMES = { star: 'ستاره‌ها', shape: 'شکل‌ها', fish: 'ماهی‌ها', butterfly: 'پروانه‌ها', bird: 'پرنده‌ها' };
export const COLORS = { blue: '#467aca', green: '#33856b', red: '#d9504e', yellow: '#bd8a0d', purple: '#9470b9', pink: '#df7c99' };
export const COLOR_NAMES = { blue: 'آبی', green: 'سبز', red: 'قرمز', yellow: 'زرد', purple: 'بنفش', pink: 'صورتی' };

/** @type {GameConfig[]} */
export const GAMES = [
  { id: 'hunt', title: 'شکار هدفمند', subtitle: 'چشم‌هات رو تیز کن!', kind: 'reaction', tags: ['attention', 'speed'], skill: 'توجه پایدار و تقسیم‌شده', color: '#e9eedb', accent: '#557246', time: '۲٫۵ دقیقه', description: 'بین شکل‌های رنگارنگ، فقط هدف خودت رو شکار کن. به چشم‌هات اعتماد کن و به‌موقع واکنش نشون بده!', rules: ['اول نمونهٔ هدف رو خوب نگاه کن. در حالت دوهدفه، هر دو نمونه هدف هستن.', 'هر وقت هدف رو دیدی، روی خودش بزن؛ دکمهٔ «پیداش کردم» یا کلید فاصله هم تا شروع نوبت بعد فعاله.', 'در هر نوبت چند شکل با هم دیده می‌شن؛ فقط هدف رو انتخاب کن. روی شکل‌های شبیه به هدف نزن.'] },
  { id: 'ark', title: 'کشتی نوح', subtitle: 'برای یک سفر مهم آماده شو', kind: 'adventure', tags: ['attention', 'speed'], skill: 'توجه و تصمیم‌گیری', color: '#f6e7cd', accent: '#ac7e3a', time: '۳۰ تا ۶۰ ثانیه', description: 'کشتی منتظر توئه! بین وسایل ساحل، چیزهایی رو پیدا کن که برای زنده‌موندن و یک سفر طولانی لازم داری.', rules: ['وسایل ضروری مثل آب، غذا و کمک‌های اولیه رو پیدا کن.', 'روی هر وسیلهٔ لازم بزن تا وارد کوله‌ات بشه؛ وسیلهٔ اشتباه ۲ ثانیه از زمانت کم می‌کنه.', 'وقتی کوله کامل شد، قبل از تمام‌شدن زمان سوار کشتی شو.'] },
  { id: 'space', title: 'سفینهٔ فضایی', subtitle: 'مقصد بعدی: ستاره‌ها', kind: 'adventure', tags: ['attention', 'speed'], skill: 'توجه و حل مسئله', color: '#e9e5f5', accent: '#8c78ad', time: '۳۰ تا ۶۰ ثانیه', description: 'فرمانده، وقت پروازه! تجهیزات لازم رو پیدا کن، موانع رو کنار بزن و سفینه‌ات رو برای سفر آماده کن.', rules: ['وسایل سفر فضایی مثل اکسیژن، لباس فضایی و سوخت رو جمع کن.', 'روی مانع بزن تا کنار بره؛ بعد وسیلهٔ زیرش رو بردار.', 'انتخاب اشتباه ۲ ثانیه جریمه داره. کوله رو کامل کن و دکمهٔ پرتاب رو بزن.'] },
  { id: 'traffic', title: 'چراغ راهنمایی', subtitle: 'سبز یعنی وقت حرکت!', kind: 'reaction', tags: ['attention', 'speed'], skill: 'توجه انتخابی و مهار پاسخ', color: '#f5e0d8', accent: '#bd7760', time: '۲٫۵ دقیقه', description: 'همیشه سریع‌بودن کافی نیست؛ گاهی باید صبر کنی! فقط وقتی چراغ سبز شد، واکنش نشون بده.', rules: ['چراغ سبز: دکمهٔ «حرکت!» رو بزن.', 'چراغ قرمز: صبر کن و هیچ دکمه‌ای نزن.', 'چراغ خیلی کوتاه دیده می‌شه، ولی تا چراغ بعدی فرصت پاسخ داری.'] },
  { id: 'search', title: 'بگرد و پیدا کن', subtitle: 'یک کارآگاه با حافظهٔ خوب', kind: 'search', tags: ['memory', 'attention'], skill: 'حافظهٔ کوتاه‌مدت', color: '#e1edee', accent: '#5f9396', time: '۱۰ دور کوتاه', description: 'شکل رو به خاطر بسپار و بعد بین یک عالمه شکل شبیه به هم پیداش کن. جزئیات کوچیک، سرنخ‌های بزرگن!', rules: ['دو ثانیه به شکل نمونه نگاه کن و جزئیاتش رو به خاطر بسپار.', 'بعد از پنهان‌شدن نمونه، همون شکل رو بین گزینه‌ها پیدا کن.', 'هر کشف درست یک امتیاز داره. برای هر دور زمان محدودی داری.'] },
  { id: 'nback', title: 'حواستو جمع کن', subtitle: 'چند قدم قبل رو یادت هست؟', kind: 'reaction', tags: ['memory', 'speed'], skill: 'حافظهٔ فعال', color: '#efe5d9', accent: '#a88760', time: 'حدود ۲٫۵ دقیقه', description: 'شکل‌ها یکی‌یکی میان و می‌رن. یادت می‌مونه چند شکل قبل چی دیدی؟ حالا نوبت حافظهٔ توئه!', rules: ['در سطح آسان، شکل فعلی رو با یک شکل قبل مقایسه کن.', 'در متوسط دو شکل قبل و در سخت سه شکل قبل رو به خاطر بیار.', 'فقط وقتی دو شکل کاملاً یکسان هستن، دکمهٔ «مثل قبلیه» رو بزن.'] },
  { id: 'stroop', title: 'بازی رنگ و کلمه', subtitle: 'استروپ؛ به قانون دقت کن', kind: 'reaction', tags: ['attention'], skill: 'توجه انتخابی و مهار پاسخ', color: '#f1e4eb', accent: '#a56c8a', time: 'حدود ۲٫۵ دقیقه', description: 'گاهی چیزی که می‌خونی با رنگی که می‌بینی فرق داره! در چهار مرحله، قانون رو دنبال کن و زردها رو پیدا کن.', rules: ['مرحلهٔ اول: فقط دایره‌های زرد رو انتخاب کن.', 'مرحلهٔ دوم: رنگ نوشته باید زرد باشه؛ مرحلهٔ سوم: خود کلمه باید «زرد» باشه.', 'مرحلهٔ آخر: فقط کلمهٔ «زرد» که با رنگ زرد نوشته شده هدفه.'] },
];
export const GAME_PROTOCOLS = Object.fromEntries(GAMES.map(game=>[game.id,game.id==='hunt'?3:2]));
export const GAME_MAP = Object.fromEntries(GAMES.map(game => [game.id, game]));
