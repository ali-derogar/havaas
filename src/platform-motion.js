// Presentation-only motion. Game routes never mount this controller.
const platformScreens = new Set(['auth','invitation','registration','password','connecting','connection-error','home','assessment','reports','account','report-links','admin','admin-users','admin-user','invitations','audit','game-settings','public-report','public-report-message']);

export function platformTheme(screen, panel) {
  if (!platformScreens.has(screen)) return '';
  return panel === 'admin' || screen.startsWith('public-report') ? 'calm' : 'explorer';
}

export class PlatformMotion {
  constructor({document, window = document.defaultView} = {}) {
    this.document = document;
    this.window = window;
    this.cleanups = [];
  }

  reset() {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.document.body.classList.remove('platform-paused');
  }

  sync(root) {
    this.reset();
    if (!this.document.body.dataset.platformTheme) return;
    const media = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const nodes = [...root.querySelectorAll('[data-reveal]')];
    // Content is visible by default, including in older browsers and test DOMs.
    if (!media?.matches && this.window?.IntersectionObserver) {
      const observer = new this.window.IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('platform-enter');
          observer.unobserve(entry.target);
        }
      }, {threshold: 0.08});
      nodes.forEach(node => observer.observe(node));
      const clear = () => {
        observer.disconnect();
        nodes.forEach(node => node.classList.remove('platform-enter'));
      };
      this.cleanups.push(clear);
      if (media.addEventListener) {
        media.addEventListener('change', clear);
        this.cleanups.push(() => media.removeEventListener('change', clear));
      }
    }
    const visibility = () => this.document.body.classList.toggle('platform-paused', this.document.hidden);
    visibility();
    this.document.addEventListener('visibilitychange', visibility);
    this.cleanups.push(() => this.document.removeEventListener('visibilitychange', visibility));
  }
}
