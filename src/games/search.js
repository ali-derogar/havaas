import { Session } from '../core/session.js';
import { pick, shuffle } from '../core/random.js';
import { LEVELS, PROTOCOL } from '../config.js';

export function generateSearch(level, random = Math.random, layout = 'grid', material = 'shapes') {
  const shapes = material === 'letters' ? ['letter-F','letter-E','letter-P','letter-R','letter-L'] : ['star', 'circle', 'diamond', 'square', 'triangle'];
  const target = { shape: pick(shapes, random), color: pick(['blue', 'green', 'purple', 'pink'], random), detail: level === 'easy' ? 0 : Math.floor(random() * 4) };
  const same = a => a.shape === target.shape && a.color === target.color && a.detail === target.detail;
  let pool = shapes.flatMap(shape => ['blue', 'green', 'purple', 'pink'].flatMap(color => [0, 1, 2, 3].map(detail => ({ shape, color, detail }))));
  if (level === 'medium') pool = pool.filter(s => s.shape === target.shape);
  if (level === 'hard') pool = pool.filter(s => s.shape === target.shape && s.color === target.color);
  pool = pool.filter(s => !same(s));
  const options = Array.from({ length: LEVELS[level].items - 1 }, () => ({ ...pick(pool, random), target: false }));
  const choices = shuffle([...options, { ...target, target: true }], random);
  const columns = level === 'hard' ? 5 : 4, rows = Math.ceil(choices.length/columns);
  if (layout === 'scattered') choices.forEach((choice,index)=>{
    choice.position={x:100*(index%columns+.5+(random()-.5)*.12)/columns,y:100*(Math.floor(index/columns)+.5+(random()-.5)*.34)/rows};
    choice.angle=(random()-.5)*4;
  });
  return { target, choices, columns, rows };
}
export class SearchSession extends Session {
  constructor(options) { super({ ...options, gameId:'search',variant: [options.material === 'letters' ? 'letters' : '', options.layout === 'scattered' ? 'scattered' : ''].filter(Boolean).join('-') || 'standard' }); this.material = options.material === 'letters' ? 'letters' : 'shapes'; this.layout=options.layout==='scattered'?'scattered':'grid';this.reactionMeasure='search-onset';this.index = 0; this.total = options.practice ? 5 : PROTOCOL.searchRounds; this.maxScore = this.total; this.newRound(); }
  get score() { return this.metrics.hits; }
  get preview() { return this.clock.elapsed < this.revealAt; }
  get remainingMs() { return Math.max(0, this.deadline - this.clock.elapsed); }
  newRound() { this.current = generateSearch(this.level, this.random, this.layout, this.material); this.rejected = new Set(); this.revealAt = this.clock.elapsed + PROTOCOL.previewMs; this.deadline = this.revealAt + LEVELS[this.level].searchSeconds * 1000; }
  next() { this.index++; if (this.index >= this.total) this.finish(); else this.newRound(); }
  tick() { if (this.done || this.paused) return; if (this.clock.elapsed >= this.deadline) { this.record(true, false, null, { round: this.index + 1 }); this.feedback = 'وقت این دور تموم شد؛ شکل بعدی رو به خاطر بسپار.'; this.feedbackKind = 'wrong'; this.next(); } }
  choose(index) {
    if (this.done || this.paused || this.preview || !Number.isInteger(index)) return null;
    // An input at the expired boundary must not leak into the next round.
    if (this.clock.elapsed >= this.deadline) { this.tick(); return null; }
    if (this.rejected.has(index) || !this.current.choices[index]) return null;
    const target = this.current.choices[index].target;
    this.record(target, true, target ? this.clock.elapsed - this.revealAt : null, { round: this.index + 1, stimulus: this.current.choices[index] });
    this.feedback = target ? 'دقیقاً همون بود! آفرین.' : 'شبیهشه، ولی همون نیست. دوباره نگاه کن!'; this.feedbackKind = target ? 'good' : 'wrong';
    if (target) this.next(); else this.rejected.add(index);
    return target;
  }
}
