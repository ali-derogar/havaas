import {getLocale} from './i18n.js';
import {colorAt} from './stimulus-plan.js';
// Scripts are shipped as local audio; no account data or microphone access is used.
const legacyGuidance={
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
};
const modernGuidance={
 'hunt-flex':'نمونهٔ هدف را نگاه کن. فقط شکل و رنگی را بزن که دقیقاً مثل نمونه است. در هر بخش، رنگ هدف عوض می‌شود؛ نمونهٔ تازه را خوب ببین.',
 'hunt-flex-dual':'هر دو نمونه هدف هستند. به رنگ و علامت هر دو دقت کن. در شروع بخش بعد، دو نمونهٔ تازه را نگاه کن.',
 'hunt-moving-flex':'نمونه را نگاه کن. شکل و رنگ هدف را بین شکل‌های متحرک پیدا کن و قبل از رفتنش بزن. در بخش بعد رنگ هدف عوض می‌شود.',
 'hunt-moving-flex-dual':'هر دو نمونه را بین شکل‌های متحرک پیدا کن. قبل از رفتنشان بزن. در هر بخش رنگ نمونه‌ها عوض می‌شود.',
 'traffic-route':'سبز شد؟ حرکت کن. قرمز شد؟ صبر کن و هیچ دکمه‌ای نزن. روی دست‌انداز توقف کن؛ برای حرکت دوباره، به سبز بعدی پاسخ بده.',
 'traffic-signs-route':'فلش یک‌طرفه را دیدی؟ حرکت کن. ورود ممنوع را دیدی؟ صبر کن. روی دست‌انداز بایست و برای حرکت دوباره منتظر فلش تازه باش.',
};
const englishModern={
 'hunt-flex':'Look at the target sample. Tap only the shape and color that match it exactly. The target color changes between sections. Look carefully at each new sample.',
 'hunt-flex-dual':'Both samples are targets. Look carefully at their colors and markings. At the next section, look at the two new samples.',
 'hunt-moving-flex':'Look at the sample. Find its shape and color among the moving pictures. Tap before it leaves. The target color changes at the next section.',
 'hunt-moving-flex-dual':'Find both samples among the moving pictures. Tap them before they leave. The sample colors change between sections.',
 'traffic-route':'Green means go. Red means wait without tapping. Stop at each speed bump. To move again, wait for a new green light and tap.',
 'traffic-signs-route':'See a one-way arrow? Go. See a no-entry sign? Wait without tapping. Stop at each speed bump. Wait for a new arrow, then tap to move again.',
};
for(const [color,name]of Object.entries({blue:'آبی',green:'سبز',red:'قرمز',yellow:'زرد'}))for(let phase=0;phase<4;phase++){
 const key=`stroop-${phase}-${color}`;
 modernGuidance[key]=[`دنبال دایرهٔ ${name} بگرد. فقط اگر دایره ${name} بود، بزن.`,`فقط رنگ نوشته مهم است. اگر رنگ نوشته ${name} بود، بزن. معنی کلمه مهم نیست.`,`فقط خود کلمه مهم است. اگر کلمهٔ ${name} را دیدی، بزن. رنگ نوشته مهم نیست.`,`هم رنگ و هم کلمه مهم است. فقط اگر کلمهٔ ${name} با رنگ ${name} نوشته شده بود، بزن.`][phase];
 englishModern[key]=[`Look for ${color} circles. Tap only when the circle is ${color}.`,`Look at the ink color. Tap only when the ink is ${color}. Ignore what the word says.`,`Read the word. Tap only when it says ${color}. Ignore the ink color.`,`Both the word and the ink color matter. Tap only when the word ${color} is written in ${color} ink.`][phase];
}
export const GUIDANCE=Object.freeze({...legacyGuidance,...modernGuidance});
const englishLegacy={
  "hunt": "Look at the sample. Only the blue shape without a mark is the target. Tap matching shapes and leave the others.",
  "hunt-dual": "Look at both samples. Blue and red shapes without a mark are both targets. Tap either one and leave the others.",
  "hunt-moving": "Look at the blue sample without a mark. Find it among the moving pictures and tap before it leaves.",
  "hunt-moving-dual": "Both the blue and red samples without a mark are targets. Find them among the moving pictures and tap before they leave.",
  "traffic": "Green means go. Tap when you see a green light. Red means wait without tapping. Each correct response moves your car forward.",
  "traffic-signs": "Tap when you see the blue one-way arrow. Wait without tapping when you see the red no-entry sign.",
  "search": "Look carefully at the sample. Remember its shape, color and marking. Then find an exact match.",
  "search-dual": "Look carefully at both samples. Remember their shapes, colors and markings. Then find both exact matches.",
  "nback-1": "The pictures appear one at a time. Does the new picture match the previous picture? Tap. If it is different, wait.",
  "nback-2": "Remember the pictures in order. Compare each new picture with the picture two steps back. If they match, tap. Otherwise, wait.",
  "nback-3": "Remember the pictures in order. Compare each new picture with the picture three steps back. If they match, tap. Otherwise, wait.",
  "stroop-0": "Look for yellow circles. Tap only when the circle is yellow.",
  "stroop-1": "Look at the ink color. Tap only when it is yellow. Ignore what the word says.",
  "stroop-2": "Read the word. Tap only when it says yellow. Ignore the ink color.",
  "stroop-3": "Both the word and ink color matter. Tap only when the word yellow is written in yellow ink.",
  "ark": "Let us get ready for a journey. Look at the supplies you need. Find them on the shore and pack your bag. When your bag is ready, board the ship.",
  "space": "Ready for space? Find the equipment you need. If a rock covers an item, clear the rock first. When everything is packed, launch the spaceship.",
  "correct": "Well done! That was correct. Continue when you are ready.",
  "retry": "Let us look again. Check the sample and the correct answer. Take your time.",
  "water": "Water helps us stay hydrated on our journey.",
  "food": "Food gives us energy for the journey.",
  "medkit": "A first aid kit helps us care for injuries.",
  "vest": "A life jacket helps us stay afloat in the water.",
  "flashlight": "A flashlight helps us see in the dark.",
  "compass": "A compass shows direction and helps us find our way.",
  "oxygen": "There is no air in space. We need oxygen to breathe.",
  "suit": "A spacesuit protects our body outside the spaceship.",
  "fuel": "The spaceship needs fuel to travel.",
  "helmet": "A space helmet protects our head.",
  "map": "A space map helps us plan our route.",
  "not-needed": "We do not need this item for our mission. Wait without choosing it."
};
export const GUIDANCE_EN=Object.freeze({...englishLegacy,...englishModern});
export const GUIDANCE_VOICE = Object.freeze({voice:'fa-IR-FaridNeural',rate:'-4%',pitch:'+0Hz'});
const equipmentKeys=new Set(['water','food','medkit','vest','flashlight','compass','oxygen','suit','fuel','helmet','map','not-needed']);
export const guidanceRate = key => ['correct','retry'].includes(key)?'+0%':equipmentKeys.has(key)?'-2%':GUIDANCE_VOICE.rate;

export function guidanceKey(options={}){
  const {gameId,level='easy',theme='star',targetCount=1,trafficMode,variant,n,phase=0,moving}=options;
  if(gameId==='hunt')return `hunt${(moving??['fish','bird','butterfly'].includes(theme))?'-moving':''}${(options.experienceVersion??4)>=4?'-flex':''}${targetCount===2?'-dual':''}`;
  if(gameId==='traffic')return `${trafficMode==='signs'||variant==='signs'?'traffic-signs':'traffic'}${(options.experienceVersion??4)>=4?'-route':''}`;
  if(gameId==='search')return targetCount===2?'search-dual':'search';
  if(gameId==='nback')return `nback-${n||({easy:1,medium:2,hard:3}[level])||1}`;
  if(gameId==='stroop')return `stroop-${Math.max(0,Math.min(3,phase))}${(options.experienceVersion??4)>=4?'-'+colorAt(options,phase):''}`;
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
      const audio=new this.AudioClass(`/assets/audio/${getLocale()==='en'?'en/':''}${key}.mp3`);this.audio=audio;this.key=key;audio.volume=.85;
      audio.onended=()=>{if(generation===this.generation){this.audio=null;this.key=null;this.onState('idle',null);}};
      audio.onerror=()=>{if(generation===this.generation){this.audio=null;this.key=null;this.onState('unavailable',null);}};
      await audio.play();if(generation!==this.generation){audio.pause();return false;}this.onState('playing',key);return true;
    }catch{if(generation===this.generation){this.audio=null;this.key=null;this.onState('unavailable',null);}return false;}
  }
}
