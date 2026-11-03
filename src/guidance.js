// Scripts are shipped as local audio; no account data or microphone access is used.
export const GUIDANCE = Object.freeze({
  hunt:'نمونه رو خوب نگاه کن. فقط شکل آبیِ بدون علامت رو بزن. به بقیه دست نزن.',
  'hunt-dual':'دو نمونه رو خوب نگاه کن. آبی و قرمزِ بدون علامت، هر دو هدف هستن. فقط همین دو تا رو بزن.',
  'hunt-moving':'شکل‌ها حرکت می‌کنن. شکل آبیِ بدون علامت رو، قبل از اینکه بره، پیدا کن و بزن.',
  'hunt-moving-dual':'شکل‌ها حرکت می‌کنن. آبی و قرمزِ بدون علامت رو، قبل از اینکه برن، پیدا کن و بزن.',
  traffic:'سبز یعنی حرکت! وقتی سبز دیدی، دکمه رو بزن. قرمز یعنی صبر. با هر جواب درست، ماشین جلو می‌ره.',
  'traffic-signs':'فلش آبی یعنی حرکت. وقتی فلش آبی دیدی، دکمه رو بزن. تابلوی قرمز یعنی صبر.',
  search:'نمونه رو خوب نگاه کن. شکل، رنگ و جزئیاتش رو یادت نگه دار. بعد، دقیقاً همون رو پیدا کن و بزن.',
  'search-dual':'هر دو نمونه رو خوب نگاه کن. شکل، رنگ و جزئیات هر دو رو یادت نگه دار. بعد، هر دو رو پیدا کن و بزن.',
  'nback-1':'شکل‌ها رو یکی‌یکی ببین. اگه شکل تازه، مثل شکل قبلی بود، دکمه رو بزن. اگه فرق داشت، صبر کن.',
  'nback-2':'شکل‌ها رو به ترتیب یادت نگه دار. هر شکل تازه رو با شکلِ دو نوبت قبل مقایسه کن. اگه مثل هم بودن، دکمه رو بزن. اگه فرق داشتن، صبر کن.',
  'nback-3':'شکل‌ها رو به ترتیب یادت نگه دار. هر شکل تازه رو با شکلِ سه نوبت قبل مقایسه کن. اگه مثل هم بودن، دکمه رو بزن. اگه فرق داشتن، صبر کن.',
  'stroop-0':'فقط دایرهٔ زرد رو بزن. اگه رنگ دیگه‌ای دیدی، صبر کن.',
  'stroop-1':'این بار فقط رنگِ نوشته مهمه. اگه رنگش زرد بود، دکمه رو بزن. مهم نیست چه کلمه‌ای نوشته شده.',
  'stroop-2':'این بار خودِ کلمه رو بخون. فقط وقتی کلمهٔ زرد رو دیدی، دکمه رو بزن. رنگِ نوشته مهم نیست.',
  'stroop-3':'هم رنگ مهمه، هم کلمه. فقط وقتی کلمهٔ زرد، با رنگِ زرد نوشته شده، دکمه رو بزن.',
  ark:'بریم سفر با کشتی! به وسایل لازم نگاه کن. بین بقیه پیداشون کن و بردار. وقتی کوله کامل شد، سوار کشتی شو.',
  space:'وسایل لازم برای سفر فضایی رو پیدا کن. اگه روی وسیله سنگ بود، اول سنگ رو کنار بزن. وقتی کوله کامل شد، دکمهٔ پرتاب رو بزن.',
  correct:'آفرین، درست بود! هر وقت آماده شدی، ادامه بده.',
  retry:'بیا با هم دوباره نگاه کنیم. نمونه و جواب درست رو ببین. عجله نکن.',
  water:'توی سفر تشنه می‌شیم. آب کمک می‌کنه تشنگی‌مون برطرف بشه.',
  food:'برای بازی و سفر انرژی لازم داریم. خوراکی به ما انرژی می‌ده.',
  medkit:'اگه کسی آسیب دید، با وسایل کمک‌های اولیه می‌تونیم بهش کمک کنیم.',
  vest:'جلیقهٔ نجات کمک می‌کنه روی آب بمونیم.',
  flashlight:'توی تاریکی، با چراغ‌قوه راه رو می‌بینیم.',
  compass:'قطب‌نما جهت رو نشون می‌ده و کمک می‌کنه راه رو پیدا کنیم.',
  oxygen:'توی فضا هوا نیست. برای نفس کشیدن اکسیژن لازم داریم.',
  suit:'لباس فضایی از بدنمون توی فضا محافظت می‌کنه.',
  fuel:'سفینه برای حرکت کردن سوخت لازم داره.',
  helmet:'کلاه فضایی از سرمون محافظت می‌کنه.',
  map:'نقشهٔ فضایی کمک می‌کنه مسیر سفر رو پیدا کنیم.',
  'not-needed':'این وسیله برای سفرمون لازم نیست. وقتی چنین وسیله‌ای دیدی، دست نگه دار.',
});

export function guidanceKey(options={}){
  const {gameId,level='easy',theme='star',targetCount=1,trafficMode,variant,n,phase=0,moving}=options;
  if(gameId==='hunt')return `hunt${(moving??['fish','bird','butterfly'].includes(theme))?'-moving':''}${targetCount===2?'-dual':''}`;
  if(gameId==='traffic')return trafficMode==='signs'||variant==='signs'?'traffic-signs':'traffic';
  if(gameId==='search')return targetCount===2?'search-dual':'search';
  if(gameId==='nback')return `nback-${n||({easy:1,medium:2,hard:3}[level])||1}`;
  if(gameId==='stroop')return `stroop-${Math.max(0,Math.min(3,phase))}`;
  return Object.hasOwn(GUIDANCE,gameId)?gameId:'retry';
}
export function lessonGuidanceKey(gameId,step,options={}){
  if(step.equipment)return Object.hasOwn(GUIDANCE,step.equipment)?step.equipment:'not-needed';
  return guidanceKey({...options,gameId,n:step.n,phase:step.phase??0});
}

export class GuidancePlayer {
  constructor({AudioClass=globalThis.Audio,onState=()=>{}}={}){this.AudioClass=AudioClass;this.onState=onState;this.audio=null;this.key=null;this.generation=0;}
  stop(){this.generation++;if(this.audio){this.audio.pause();this.audio=null;}this.key=null;this.onState('idle',null);}
  async play(key){
    this.stop();if(!Object.hasOwn(GUIDANCE,key)||!this.AudioClass){this.onState('unavailable');return false;}
    const generation=this.generation;
    try{
      const audio=new this.AudioClass(`/assets/audio/${key}.mp3`);this.audio=audio;this.key=key;audio.volume=.85;
      audio.onended=()=>{if(generation===this.generation){this.audio=null;this.key=null;this.onState('idle',null);}};
      audio.onerror=()=>{if(generation===this.generation){this.audio=null;this.key=null;this.onState('unavailable',null);}};
      await audio.play();if(generation!==this.generation){audio.pause();return false;}this.onState('playing',key);return true;
    }catch{if(generation===this.generation){this.audio=null;this.key=null;this.onState('unavailable',null);}return false;}
  }
}
