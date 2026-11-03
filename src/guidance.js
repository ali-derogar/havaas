// Scripts are shipped as local audio; no account data or microphone access is used.
export const GUIDANCE = Object.freeze({
  hunt:'نمونه را خوب نگاه کن. فقط شکل آبی بدون علامت را بزن. به بقیه دست نزن.',
  'hunt-dual':'دو نمونه را خوب نگاه کن. آبی و قرمز بدون علامت، هر دو هدف هستند. فقط همین دو را بزن.',
  'hunt-moving':'شکل ها حرکت می کنند. فقط شکل آبی بدون علامت را، پیش از رفتنش پیدا کن و بزن.',
  'hunt-moving-dual':'شکل ها حرکت می کنند. آبی و قرمز بدون علامت را، پیش از رفتنشان پیدا کن و بزن.',
  traffic:'سبز یعنی حرکت. وقتی سبز دیدی، دکمه را بزن. قرمز یعنی صبر. با هر پاسخ درست، ماشین جلو می رود.',
  'traffic-signs':'فلش آبی یعنی حرکت. وقتی فلش آبی دیدی، دکمه را بزن. تابلوی قرمز یعنی صبر.',
  search:'شکل نمونه را نگاه کن. رنگ و علامت و برآمدگی آن را به خاطر بسپار. بعد، همان شکل را پیدا کن و بزن.',
  'search-dual':'هر دو نمونه را نگاه کن. شکل و رنگ و علامت هر دو را به خاطر بسپار. بعد هر دو را پیدا کن و بزن.',
  'nback-1':'اول یک شکل را به خاطر بسپار. بعد اگر شکل تازه، مثل یک شکل قبل بود، دکمه را بزن. اگر فرق داشت، صبر کن.',
  'nback-2':'دو شکل را به ترتیب به خاطر بسپار. هر شکل تازه را با دو شکل قبل مقایسه کن. اگر یکسان بود، دکمه را بزن.',
  'nback-3':'سه شکل را به ترتیب به خاطر بسپار. هر شکل تازه را با سه شکل قبل مقایسه کن. اگر یکسان بود، دکمه را بزن.',
  'stroop-0':'فقط دایره زرد را بزن. اگر رنگ دیگری دیدی، صبر کن.',
  'stroop-1':'فقط رنگ نوشته مهم است. اگر رنگ نوشته زرد بود، دکمه را بزن. مهم نیست چه کلمه ای نوشته شده.',
  'stroop-2':'این بار خود کلمه را بخوان. فقط برای کلمه زرد دکمه را بزن. رنگ نوشته مهم نیست.',
  'stroop-3':'هم رنگ و هم کلمه مهم است. فقط اگر کلمه زرد با رنگ زرد نوشته شده بود، دکمه را بزن.',
  ark:'برای سفر با کشتی آماده شو. به وسایل لازم نگاه کن. آنها را میان بقیه وسایل پیدا کن و بردار. وقتی کوله کامل شد، سوار کشتی شو.',
  space:'وسایل لازم برای سفر فضایی را پیدا کن. اگر سنگ روی وسیله بود، اول سنگ را کنار بزن. کوله را کامل کن و دکمه پرتاب را بزن.',
  correct:'آفرین! درست بود. وقتی آماده شدی، ادامه بده.',
  retry:'دوباره با هم نگاه کنیم. نمونه و پاسخ درست را ببین. عجله نکن.',
  water:'آب برای رفع تشنگی در سفر لازم است. آن را بردار.',
  food:'خوراک برای انرژی در سفر لازم است. آن را بردار.',
  medkit:'کمک های اولیه برای رسیدگی به آسیب لازم است. آن را بردار.',
  vest:'جلیقه نجات برای ایمنی روی آب لازم است. آن را بردار.',
  flashlight:'چراغ قوه برای دیدن در تاریکی لازم است. آن را بردار.',
  compass:'قطب نما برای پیدا کردن راه لازم است. آن را بردار.',
  oxygen:'در فضا هوا نیست. اکسیژن برای نفس کشیدن لازم است. آن را بردار.',
  suit:'لباس فضایی از بدن تو محافظت می کند. آن را بردار.',
  fuel:'سوخت برای حرکت سفینه لازم است. آن را بردار.',
  helmet:'کلاه فضایی از سر تو محافظت می کند. آن را بردار.',
  map:'نقشه فضایی برای پیدا کردن مسیر لازم است. آن را بردار.',
  'not-needed':'این وسیله برای این سفر لازم نیست. دکمه دست نگه دار را بزن.',
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

export class GuidancePlayer {
  constructor({AudioClass=globalThis.Audio,onState=()=>{}}={}){this.AudioClass=AudioClass;this.onState=onState;this.audio=null;this.generation=0;}
  stop(){this.generation++;if(this.audio){this.audio.pause();this.audio=null;}this.onState('idle');}
  async play(key){
    this.stop();if(!Object.hasOwn(GUIDANCE,key)||!this.AudioClass){this.onState('unavailable');return false;}
    const generation=this.generation;
    try{
      const audio=new this.AudioClass(`/assets/audio/${key}.mp3`);this.audio=audio;audio.volume=.85;
      audio.onended=()=>{if(generation===this.generation){this.audio=null;this.onState('idle');}};
      audio.onerror=()=>{if(generation===this.generation){this.audio=null;this.onState('unavailable');}};
      await audio.play();if(generation!==this.generation){audio.pause();return false;}this.onState('playing');return true;
    }catch{if(generation===this.generation){this.audio=null;this.onState('unavailable');}return false;}
  }
}
