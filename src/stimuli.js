import {localized,t as uiText,lt} from './i18n.js';
import { COLOR_NAMES } from './config.js';

const SHAPE_NAMES = localized({ star:'ستاره',circle:'دایره',triangle:'مثلث',square:'مربع',diamond:'لوزی',heart:'قلب',fish:'ماهی',butterfly:'پروانه',bird:'پرنده' });
const TOY_NAMES = localized({ ball:'توپ',teddy:'خرس عروسکی',kite:'بادبادک',duck:'اردک اسباب‌بازی',skate:'اسکیت',gamepad:'دستهٔ بازی' });
const labelOf=(labels,key,fallback='')=>typeof key==='string'&&Object.hasOwn(labels,key)?labels[key]:fallback;
export function describeStimulus(stimulus) {
  if (!stimulus || typeof stimulus.shape !== 'string') return uiText('محرک');
  const {shape,color,detail=0,word} = stimulus;
  if (shape === 'noentry') return uiText('تابلوی ورود ممنوع');
  if (shape === 'oneway') return uiText('تابلوی یک‌طرفه');
  if (shape === 'word') return lt`کلمهٔ «${labelOf(COLOR_NAMES,word,uiText('رنگ'))}» با رنگ ${labelOf(COLOR_NAMES,color)}`;
  if (shape.startsWith('digit-')) return lt`عدد ${shape.slice(6)}`;
  if (shape.startsWith('toy-')) return labelOf(TOY_NAMES,shape.slice(4),uiText('اسباب‌بازی'));
  const marks = shape.startsWith('letter-') ? [uiText('بدون خط اضافه'),uiText('با خط بالایی'),uiText('با خط میانی'),uiText('با خط پایینی'),uiText('با دو خط بالا و میانه'),uiText('با دو خط میانه و پایین'),uiText('با دو خط بالا و پایین')] : [uiText('بدون علامت'),uiText('با یک نقطه'),uiText('با یک خط'),uiText('با دو نقطه'),uiText('با زائدهٔ بالا'),uiText('با زائدهٔ کناری'),uiText('با زائدهٔ بالا و نقطه'),uiText('با زائدهٔ کناری و خط'),uiText('با زائدهٔ پایین'),uiText('با زائدهٔ چپ'),uiText('با زائدهٔ پایین و نقطه'),uiText('با زائدهٔ چپ و خط')];
  const name = shape.startsWith('letter-') ? lt`حرف ${shape.slice(7)}` : labelOf(SHAPE_NAMES,shape,uiText('شکل'));
  const mark=Number.isInteger(detail)&&detail>=0&&detail<marks.length?marks[detail]:marks[0];
  return `${name} ${labelOf(COLOR_NAMES,color)} ${mark}`;
}
