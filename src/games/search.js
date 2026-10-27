import { Session } from '../core/session.js';
import { pick, shuffle } from '../core/random.js';
import { LEVELS, PROTOCOL } from '../config.js';

export const searchVariant = ({ material, layout, targetCount } = {}) => [material === 'letters' ? 'letters' : '', layout === 'scattered' ? 'scattered' : '', targetCount === 2 ? 'dual' : ''].filter(Boolean).join('-') || 'standard';
const sameStimulus = (a, b) => a.shape === b.shape && a.color === b.color && a.detail === b.detail;
export function generateSearch(level, random = Math.random, layout = 'grid', material = 'shapes', targetCount = 1) {
  const shapes = material === 'letters' ? ['letter-F','letter-E','letter-P','letter-R','letter-L'] : ['star', 'circle', 'diamond', 'square', 'triangle'];
  const colors = ['blue', 'green', 'purple', 'pink'];
  const target = { shape: pick(shapes, random), color: pick(colors, random), detail: level === 'easy' ? 0 : Math.floor(random() * 4) };
  const targets = [target];
  if (targetCount === 2) targets.push(level === 'hard' ? { ...target, detail: (target.detail + 1 + Math.floor(random() * 3)) % 4 } : {
    shape: level === 'medium' ? target.shape : pick(shapes.filter(shape=>shape!==target.shape), random),
    color: pick(colors.filter(color=>color!==target.color), random), detail: level === 'easy' ? 0 : Math.floor(random() * 4),
  });
  let pool = shapes.flatMap(shape => colors.flatMap(color => [0, 1, 2, 3].map(detail => ({ shape, color, detail }))));
  if (level === 'medium') pool = pool.filter(s => s.shape === target.shape);
  if (level === 'hard') pool = pool.filter(s => s.shape === target.shape && s.color === target.color);
  pool = pool.filter(s => !targets.some(target=>sameStimulus(s,target)));
  const options = Array.from({ length: LEVELS[level].items - targets.length }, () => ({ ...pick(pool, random), target: false }));
  const choices = shuffle([...options, ...targets.map((stimulus,targetIndex)=>({ ...stimulus, target: true, targetIndex }))], random);
  const columns = level === 'hard' ? 5 : 4, rows = Math.ceil(choices.length/columns);
  if (layout === 'scattered') choices.forEach((choice,index)=>{
    choice.position={x:100*(index%columns+.5+(random()-.5)*.12)/columns,y:100*(Math.floor(index/columns)+.5+(random()-.5)*.34)/rows};
    choice.angle=(random()-.5)*4;
  });
  return { target, targets, choices, columns, rows };
}
export class SearchSession extends Session {
  constructor(options) {
    super({ ...options, gameId:'search', variant:searchVariant(options) });
    this.material = options.material === 'letters' ? 'letters' : 'shapes';
    this.layout = options.layout === 'scattered' ? 'scattered' : 'grid';
    this.targetCount = options.targetCount === 2 ? 2 : 1;
    this.reactionMeasure = 'search-onset'; this.index = 0;
    this.total = options.practice ? PROTOCOL.practiceTrials : PROTOCOL.searchRounds;
    this.maxScore = this.total * this.targetCount; this.newRound();
  }
  get score() { return this.metrics.hits; }
  get preview() { return this.clock.elapsed < this.revealAt; }
  get remainingMs() { return Math.max(0, this.deadline - this.clock.elapsed); }
  newRound() {
    this.current = generateSearch(this.level, this.random, this.layout, this.material, this.targetCount);
    this.rejected = new Set(); this.found = new Set();
    this.revealAt = this.clock.elapsed + PROTOCOL.previewMs;
    this.deadline = this.revealAt + LEVELS[this.level].searchSeconds * 1000;
  }
  next() { this.index++; if (this.index >= this.total) this.finish(); else this.newRound(); }
  tick() {
    if (this.done || this.paused || this.clock.elapsed < this.deadline) return;
    for (const [index,stimulus] of this.current.choices.entries()) if (stimulus.target && !this.found.has(index)) this.record(true, false, null, { round: this.index + 1, stimulus });
    this.feedback = 'وقت این دور تموم شد؛ نمونهٔ بعدی رو به خاطر بسپار.'; this.feedbackKind = 'wrong'; this.next();
  }
  choose(index) {
    if (this.done || this.paused || this.preview || !Number.isInteger(index)) return null;
    if (this.clock.elapsed >= this.deadline) { this.tick(); return null; }
    if (this.rejected.has(index) || this.found.has(index) || !this.current.choices[index]) return null;
    const stimulus = this.current.choices[index], target = stimulus.target;
    this.record(target, true, target ? this.clock.elapsed - this.revealAt : null, { round: this.index + 1, stimulus });
    this.feedback = target ? 'دقیقاً همون بود! آفرین.' : 'شبیهشه، ولی همون نیست. دوباره نگاه کن!'; this.feedbackKind = target ? 'good' : 'wrong';
    if (target) {
      this.found.add(index);
      if (this.found.size === this.targetCount) this.next();
      else this.feedback = 'یکی رو پیدا کردی! حالا هدف دوم رو پیدا کن.';
    } else this.rejected.add(index);
    return target;
  }
  get result() { return { ...super.result, targetsPerRound: this.targetCount, rounds: this.total }; }
}
