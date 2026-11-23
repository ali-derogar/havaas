import {numberLocale} from './i18n.js';
import {t as uiText,lt} from './i18n.js';
import { LEVELS,COLOR_NAMES } from './config.js';
import { STROOP_RULES,stroopRules } from './games/stroop.js';
import { EQUIPMENT_REASONS } from './games/adventure.js';

const shape = (name,color='blue',detail=0) => ({shape:name,color,detail});
export function createLesson(gameId, { level='easy', material='shapes', theme='star', trafficMode='circles', targetCount=1,stimulusPlan=null } = {}) {
  if(gameId==='stroop')return stroopRules({stimulusPlan}).flatMap((rule,phase)=>{
    const color=stimulusPlan?.colorsByPhase[phase][0]||'yellow',other=color==='red'?'blue':'red';
    return [true,false].map(expected=>({phase,title:rule.title,prompt:uiText('در این قانون، به این محرک پاسخ می‌دهی؟'),expected,
      stimuli:[phase===0?shape('circle',expected?color:other):{shape:'word',color:phase===2?(expected?other:color):(expected?color:other),word:phase===1?(expected?other:color):(expected?color:other)}],
      explanation:expected?uiText('این محرک با قانون و نمونهٔ همین بخش مطابقت دارد؛ پاسخ بده.'):uiText('این محرک با قانون این بخش مطابق نیست؛ صبر کن.')}));
  });
  if (gameId === 'nback') {
    const n=LEVELS[level].n, values=material==='numbers'?['digit-2','digit-4','digit-8','digit-6']:material==='toys'?['toy-ball','toy-teddy','toy-duck','toy-kite']:['star','circle','triangle','square'];
    return [true,false].map(expected=>({ kind:'memory', n, title:lt`مقایسه با ${n.toLocaleString(numberLocale())} محرک قبل`, prompt:uiText('به محرک آخر نگاه کن. با محرک مشخص‌شده در چند گام قبل یکسان است؟'),
      stimuli:[...values.slice(0,n),expected?values[0]:values[n]].map(name=>shape(name)), reference:0, expected,
      explanation:expected?uiText('محرک فعلی دقیقاً با محرک داخل کادر مرجع یکسان است؛ باید پاسخ بدهی.'):uiText('محرک فعلی با مرجع یکسان نیست؛ باید صبر کنی. در بازی اصلی، مرجع را فقط در حافظه نگه می‌داری.') }));
  }
  if (gameId === 'traffic') return [true,false].map(expected=>({ title:trafficMode==='signs'?uiText('قانون تابلوها'):uiText('قانون چراغ‌ها'), prompt:uiText('با دیدن این نشانه باید حرکت کنی؟'), stimuli:[shape(trafficMode==='signs'?(expected?'oneway':'noentry'):'circle',expected?'green':'red')],expected,
    explanation:expected?uiText('این نشانه اجازهٔ حرکت می‌دهد؛ پاسخ بده.'):uiText('این نشانه توقف است؛ به آن پاسخ نده.') }));
  if (gameId === 'hunt') {
    const name=theme==='shape'?'circle':theme,colors=stimulusPlan?.colorsByPhase[0]||(targetCount===2?['blue','red']:['blue']);
    return colors.flatMap(color=>[true,false].map(expected=>({title:targetCount===2?uiText('هر دو نمونه هدف هستند'):uiText('فقط نمونهٔ دقیق'),
      prompt:targetCount===2?uiText('دو نمونهٔ بدون علامت، هر دو هدف هستند. به این شکل پاسخ می‌دهی؟'):uiText('نمونهٔ هدف بدون علامت است. این شکل هدف است؟'),
      stimuli:[shape(name,color,expected?0:1)],expected,
      explanation:expected?uiText('شکل، رنگ و علامت با یکی از نمونه‌های هدف یکسان‌اند؛ پاسخ بده.'):uiText('رنگ و شکل شبیه هدف‌اند، اما نقطهٔ اضافه دارد؛ این محرک مزاحم است.')})));
  }
  if(gameId==='search'){
    const letter=material==='letters',name=letter?'letter-F':'star',other=letter?'letter-P':'diamond';
    const firstDetail=letter?(level==='hard'?4:1):level==='hard'?10:level==='medium'?4:1,secondDetail=letter?(level==='hard'?6:2):level==='hard'?11:level==='medium'?5:2;
    const samples=[shape(name,'blue',firstDetail),...(targetCount===2?[shape(other,'purple',secondDetail)]:[])];
    return [0,1].map(index=>({kind:'search',memorize:index===1,title:index?uiText('حالا از حافظه کمک بگیر'):uiText('جزئیات، سرنخ تو هستند'),
      prompt:index?uiText('با خیال راحت نمونه را به خاطر بسپار. با زدن دکمه، نمونه پنهان می‌شود و گزینه‌ها را می‌بینی.'):targetCount===2?uiText('به دو نمونه نگاه کن و هر دو را در گزینه‌ها پیدا کن.'):uiText('به نمونه نگاه کن و دقیقاً همان را در گزینه‌ها پیدا کن.'),samples,
      choices:index?[shape(name,'blue',0),...samples,shape(other,'purple',firstDetail===1?3:1)]:[...samples,shape(name,'blue',firstDetail===1?2:1),shape(other,'green',2)],
      explanation:letter?uiText('خود حرف، رنگ و جای خط کوتاه باید هر سه یکسان باشند.'):uiText('شکل، رنگ، علامت و جای زائده باید همگی با نمونه یکی باشند.')}));
  }
  if (gameId === 'ark' || gameId === 'space') {
    const item=gameId==='ark'?'water':'oxygen';
    return [{title:uiText('وسایل ضروری'),prompt:uiText('این وسیله برای سفر لازم است؟'),equipment:item,expected:true,explanation:EQUIPMENT_REASONS[item]},
      {title:uiText('وسایل غیرضروری'),prompt:uiText('این وسیله را باید با خود ببری؟'),equipment:'ball',expected:false,explanation:uiText('توپ برای بازی خوب است، اما جزو تجهیزات ضروری این مأموریت نیست.')}];
  }
  return [];
}
