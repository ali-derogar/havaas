// Inspect rendered text against its actual composed CSS surface, including
// translucent cards. Scored stimulus colors are deliberately excluded.
export function contrastIssues() {
  const rgba = value => {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return [0, 0, 0, 0];
    const values = match[1].split(/[, /]+/).map(Number);
    return [values[0], values[1], values[2], values[3] ?? 1];
  };
  const mix = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
  const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const path = node => {
    const parts = [];
    for (let el = node; el && parts.length < 4; el = el.parentElement) {
      if (el.id) {parts.unshift('#' + el.id);break;}
      parts.unshift(el.tagName.toLowerCase() + [...el.classList].slice(0, 3).map(name => '.' + name).join(''));
    }
    return parts.join(' > ');
  };
  const issues = [];
  for (const node of document.querySelectorAll('body *')) {
    // These labels are painted over SVG scenes; CSS backgroundColor cannot
    // describe their backdrop. Their contrast is checked in screenshots.
    if (node.closest('svg,[aria-hidden=true],.sr-only,[disabled],.symbol,.word-stimulus,.equipment,.hunt-outcome,.memory-outcome,.stroop-outcome,.traffic-outcome,.search-outcome')) continue;
    const placeholder = node.matches('input,textarea') && !node.value && node.placeholder;
    const text = node.matches('select') ? node.selectedOptions[0]?.textContent : node.matches('input,textarea') ? node.value || placeholder : [...node.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
    if (!text || !node.getClientRects().length) continue;
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    if (style.visibility !== 'visible' || rect.width < 2 || rect.height < 2 || !node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) continue;
    let back = [255, 255, 255], transparent = false;
    const chain = [];
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) chain.unshift(ancestor);
    for (const ancestor of chain) {
      const ancestorStyle = getComputedStyle(ancestor);
      if (Number(ancestorStyle.opacity) === 0) transparent = true;
      back = mix(rgba(ancestorStyle.backgroundColor), back);
      if (!ancestorStyle.backgroundImage.includes('url(')) {
        const solid = ancestorStyle.backgroundImage.match(/rgba?\([^)]+\)/g)?.map(rgba).find(color => color[3] === 1);
        if (solid) back = mix(solid, back);
      }
    }
    if (transparent) continue;
    const foreground = placeholder ? getComputedStyle(node, '::placeholder').color : style.color;
    const fore = mix(rgba(foreground), back), a = luminance(fore), b = luminance(back);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700;
    if (ratio + .01 < (large ? 3 : 4.5)) issues.push({selector: path(node), text: text.slice(0, 90), ratio: Number(ratio.toFixed(2)), color: style.color, background: back.map(Math.round)});
  }
  return issues;
}
