// Scripts are shipped as local audio; no account data or microphone access is used.
export const GUIDANCE = Object.freeze({
  hunt:'نمونه رو نگاه کن. فقط شکل آبی، بدون علامت، هدف ماست. همون رو بزن؛ به بقیه دست نزن.',
  'hunt-dual':'این دو نمونه رو نگاه کن. آبی و قرمز، هر دو بدون علامت. هر کدوم رو دیدی بزن؛ به بقیه دست نزن.',
  'hunt-moving':'نمونهٔ آبی، بدون علامت رو نگاه کن. بین شکل‌های متحرک پیداش کن و قبل از رفتنش بزنش.',
  'hunt-moving-dual':'دو نمونه داریم: آبی و قرمز، هر دو بدون علامت. بین شکل‌های متحرک پیداشون کن و قبل از رفتنشون بزن.',
  traffic:'سبز شد؟ حرکت کن! وقتی چراغ سبز رو دیدی، دکمه رو بزن. قرمز شد؟ صبر کن. ماشینت با هر جواب درست جلو می‌ره.',
  'traffic-signs':'فلش آبی رو دیدی؟ دکمه رو بزن. تابلوی قرمز رو دیدی؟ صبر کن و هیچ دکمه‌ای نزن.',
  search:'نمونه رو خوب ببین. به شکل، رنگ و علامتش دقت کن. حالا یادت نگهش دار؛ بعد، دقیقاً همون رو پیدا کن.',
  'search-dual':'هر دو نمونه رو خوب ببین. شکل، رنگ و علامت هر دو رو یادت نگه دار. بعد، هر دو رو پیدا کن.',
  'nback-1':'شکل‌ها یکی‌یکی میان. شکل تازه مثل شکل قبلی بود؟ دکمه رو بزن. فرق داشت؟ صبر کن.',
  'nback-2':'شکل‌ها رو به ترتیب یادت نگه دار. هر شکل تازه رو با شکلِ دو نوبت قبل مقایسه کن. مثل هم بودن؟ بزن. فرق داشتن؟ صبر کن.',
  'nback-3':'شکل‌ها رو به ترتیب یادت نگه دار. هر شکل تازه رو با شکلِ سه نوبت قبل مقایسه کن. مثل هم بودن؟ بزن. فرق داشتن؟ صبر کن.',
  'stroop-0':'این بار دنبال دایرهٔ زرد می‌گردیم. زرد بود؟ بزن. رنگ دیگه‌ای بود؟ صبر کن.',
  'stroop-1':'حالا فقط رنگ نوشته مهمه. رنگش زرد بود؟ دکمه رو بزن. کاری به معنی کلمه نداشته باش.',
  'stroop-2':'حالا خود کلمه رو بخون. کلمهٔ زرد رو دیدی؟ دکمه رو بزن. این بار رنگ نوشته مهم نیست.',
  'stroop-3':'این بار هم کلمه مهمه، هم رنگش. فقط وقتی کلمهٔ زرد با رنگ زرد نوشته شده، دکمه رو بزن.',
  ark:'بریم سفر! اول وسایل لازم رو ببین. بین وسایل ساحل پیداشون کن و توی کوله بذار. کوله که کامل شد، سوار کشتی شو.',
  space:'آمادهٔ سفر فضایی هستی؟ وسایل لازم رو پیدا کن. روی وسیله سنگ بود؟ اول سنگ رو کنار بزن. کوله که کامل شد، پرتاب کن!',
  correct:'آفرین! درست بود. هر وقت آماده بودی، ادامه بده.',
  retry:'بیا دوباره نگاه کنیم. نمونه و جواب درست رو ببین. عجله‌ای نداریم.',
  water:'آب می‌بریم تا توی سفر تشنه نمونیم.',
  food:'برای سفر انرژی می‌خوایم. خوراکی بهمون انرژی می‌ده.',
  medkit:'کسی آسیب دید؟ وسایل کمک‌های اولیه به دردمون می‌خوره.',
  vest:'جلیقهٔ نجات کمک می‌کنه روی آب بمونیم.',
  flashlight:'تاریک شد؟ با چراغ‌قوه می‌تونیم راه رو ببینیم.',
  compass:'قطب‌نما جهت رو نشون می‌ده، تا راهمون رو پیدا کنیم.',
  oxygen:'توی فضا هوا نیست. برای نفس کشیدن، اکسیژن لازم داریم.',
  suit:'لباس فضایی، از بدنمون توی فضا محافظت می‌کنه.',
  fuel:'سفینه برای حرکت، سوخت لازم داره.',
  helmet:'کلاه فضایی، از سرمون محافظت می‌کنه.',
  map:'با نقشهٔ فضایی، مسیر سفر رو پیدا می‌کنیم.',
  'not-needed':'این وسیله برای سفرمون لازم نیست. دیدیش؟ دست نگه دار.',
});
export const GUIDANCE_VOICE = Object.freeze({voice:'fa-IR-DilaraNeural',rate:'-4%',pitch:'+0Hz'});
const equipmentKeys=new Set(['water','food','medkit','vest','flashlight','compass','oxygen','suit','fuel','helmet','map','not-needed']);
export const guidanceRate = key => ['correct','retry'].includes(key)?'+0%':equipmentKeys.has(key)?'-2%':GUIDANCE_VOICE.rate;

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
