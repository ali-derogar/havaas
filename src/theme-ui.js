import {lt,t as uiText} from './i18n.js';
export function themeSelector(preference = globalThis.window?.HavaasTheme?.getPreference() || 'system') {
  return lt`<label class="theme-switcher"><span>ظاهر</span><select data-theme-select aria-label="حالت نمایش">${[['system',uiText('سیستم')],['light',uiText('روشن')],['dark',uiText('تاریک')]].map(([value,label]) => `<option value="${value}"${preference === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
}
