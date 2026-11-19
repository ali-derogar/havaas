export function themeSelector(preference = globalThis.window?.HavaasTheme?.getPreference() || 'system') {
  return `<label class="theme-switcher"><span>ظاهر</span><select data-theme-select aria-label="حالت نمایش">${[['system','سیستم'],['light','روشن'],['dark','تاریک']].map(([value,label]) => `<option value="${value}"${preference === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
}
