import { LEVELS } from './config.js';
import { STROOP_RULES } from './games/stroop.js';
import { EQUIPMENT_REASONS } from './games/adventure.js';

const shape = (name,color='blue',detail=0) => ({shape:name,color,detail});
export function createLesson(gameId, { level='easy', material='shapes', theme='star', trafficMode='circles', targetCount=1 } = {}) {
  if (gameId === 'stroop') return STROOP_RULES.flatMap((rule,phase)=>[
    { title:rule.title, prompt:'در این قانون، به این محرک پاسخ می‌دهی؟', stimuli:[phase===0?shape('circle','yellow'):{shape:'word',color:phase===2?'red':'yellow',word:phase===1?'red':'yellow'}], expected:true,
      explanation:phase===0?'دایره زرد است؛ باید پاسخ بدهی.':phase===1?'رنگ نوشته زرد است؛ معنای «قرمز» مهم نیست.':phase===2?'معنای کلمه «زرد» است؛ رنگ قرمز مهم نیست.':'هم معنای کلمه و هم رنگ آن زرد است؛ هر دو شرط درست‌اند.' },
    { title:rule.title, prompt:'حالا به این یکی پاسخ می‌دهی؟', stimuli:[phase===0?shape('circle','blue'):{shape:'word',color:phase===2?'yellow':'red',word:phase===1?'yellow':phase===2?'red':'yellow'}], expected:false,
      explanation:phase===0?'این دایره زرد نیست؛ باید صبر کنی.':phase===1?'رنگ نوشته قرمز است؛ خواندن کلمهٔ «زرد» نباید باعث پاسخ شود.':phase===2?'خود کلمه «قرمز» است؛ رنگ زرد نباید باعث پاسخ شود.':'کلمه «زرد» است، اما رنگ آن قرمز است؛ هر دو شرط هم‌زمان برقرار نیستند.' },
  ]);
  if (gameId === 'nback') {
    const n=LEVELS[level].n, values=material==='numbers'?['digit-2','digit-4','digit-8','digit-6']:material==='toys'?['toy-ball','toy-teddy','toy-duck','toy-kite']:['star','circle','triangle','square'];
    return [true,false].map(expected=>({ title:`مقایسه با ${n.toLocaleString('fa-IR')} محرک قبل`, prompt:'به محرک آخر نگاه کن. با محرک مشخص‌شده در چند گام قبل یکسان است؟',
      stimuli:[...values.slice(0,n),expected?values[0]:values[n]].map(name=>shape(name)), reference:0, expected,
      explanation:expected?'محرک فعلی دقیقاً با محرک داخل کادر مرجع یکسان است؛ باید پاسخ بدهی.':'محرک فعلی با مرجع یکسان نیست؛ باید صبر کنی. در بازی اصلی، مرجع را فقط در حافظه نگه می‌داری.' }));
  }
  if (gameId === 'traffic') return [true,false].map(expected=>({ title:trafficMode==='signs'?'قانون تابلوها':'قانون چراغ‌ها', prompt:'با دیدن این نشانه باید حرکت کنی؟', stimuli:[shape(trafficMode==='signs'?(expected?'oneway':'noentry'):'circle',expected?'green':'red')],expected,
    explanation:expected?'این نشانه اجازهٔ حرکت می‌دهد؛ پاسخ بده.':'این نشانه توقف است؛ به آن پاسخ نده.' }));
  if (gameId === 'hunt') {
    const name=theme==='shape'?'circle':theme,colors=targetCount===2?['blue','red']:['blue'];
    return colors.flatMap(color=>[true,false].map(expected=>({title:targetCount===2?'هر دو نمونه هدف هستند':'فقط نمونهٔ دقیق',
      prompt:targetCount===2?'آبی و قرمزِ بدون علامت، هر دو هدف هستند. به این شکل پاسخ می‌دهی؟':'نمونهٔ هدف آبی و بدون علامت است. این شکل هدف است؟',
      stimuli:[shape(name,color,expected?0:1)],expected,
      explanation:expected?'شکل، رنگ و علامت با یکی از نمونه‌های هدف یکسان‌اند؛ پاسخ بده.':'رنگ و شکل شبیه هدف‌اند، اما نقطهٔ اضافه دارد؛ این محرک مزاحم است.'})));
  }
  if(gameId==='search'){
    const letter=material==='letters',name=letter?'letter-F':'star',other=letter?'letter-P':'diamond';
    const samples=[shape(name,'blue',1),...(targetCount===2?[shape(other,'purple',2)]:[])];
    return [0,1].map(index=>({kind:'search',memorize:index===1,title:index?'حالا از حافظه کمک بگیر':'جزئیات، سرنخ تو هستند',
      prompt:index?'با خیال راحت نمونه را به خاطر بسپار. با زدن دکمه، نمونه پنهان می‌شود و گزینه‌ها را می‌بینی.':targetCount===2?'به دو نمونه نگاه کن و هر دو را در گزینه‌ها پیدا کن.':'به نمونه نگاه کن و دقیقاً همان را در گزینه‌ها پیدا کن.',samples,
      choices:index?[shape(name,'blue',0),...samples,shape(other,'purple',1)]:[...samples,shape(name,'blue',2),shape(other,'green',2)],
      explanation:letter?'خود حرف، رنگ و جای خط کوتاه باید هر سه یکسان باشند.':'شکل، رنگ و علامت داخل آن باید هر سه با نمونه یکی باشند.'}));
  }
  if (gameId === 'ark' || gameId === 'space') {
    const item=gameId==='ark'?'water':'oxygen';
    return [{title:'وسایل ضروری',prompt:'این وسیله برای سفر لازم است؟',equipment:item,expected:true,explanation:EQUIPMENT_REASONS[item]},
      {title:'وسایل غیرضروری',prompt:'این وسیله را باید با خود ببری؟',equipment:'ball',expected:false,explanation:'توپ برای بازی خوب است، اما جزو تجهیزات ضروری این مأموریت نیست.'}];
  }
  return [];
}
