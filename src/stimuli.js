import { COLOR_NAMES } from './config.js';

const SHAPE_NAMES = { star:'ستاره',circle:'دایره',triangle:'مثلث',square:'مربع',diamond:'لوزی',heart:'قلب',fish:'ماهی',butterfly:'پروانه',bird:'پرنده' };
const TOY_NAMES = { ball:'توپ',teddy:'خرس عروسکی',kite:'بادبادک',duck:'اردک اسباب‌بازی',skate:'اسکیت',gamepad:'دستهٔ بازی' };
export function describeStimulus(stimulus) {
  if (!stimulus || typeof stimulus.shape !== 'string') return 'محرک';
  const {shape,color,detail=0,word} = stimulus;
  if (shape === 'noentry') return 'تابلوی ورود ممنوع';
  if (shape === 'oneway') return 'تابلوی یک‌طرفه';
  if (shape === 'word') return `کلمهٔ «${COLOR_NAMES[word] || 'رنگ'}» با رنگ ${COLOR_NAMES[color] || ''}`;
  if (shape.startsWith('digit-')) return `عدد ${shape.slice(6)}`;
  if (shape.startsWith('toy-')) return TOY_NAMES[shape.slice(4)] || 'اسباب‌بازی';
  const marks = shape.startsWith('letter-') ? ['بدون خط اضافه','با خط بالایی','با خط میانی','با خط پایینی'] : ['بدون علامت','با یک نقطه','با یک خط','با دو نقطه'];
  const name = shape.startsWith('letter-') ? `حرف ${shape.slice(7)}` : SHAPE_NAMES[shape] || 'شکل';
  return `${name} ${COLOR_NAMES[color] || ''} ${marks[detail] || marks[0]}`;
}
