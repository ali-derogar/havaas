import { GAMES } from '../config.js';
import { latestBaseline } from './clients.js';
import { recommendLevel } from './reports.js';

export function assessmentSteps(clients) {
  return GAMES.map(game=>{
    const baseline = latestBaseline(clients,game.id,'standard','easy');
    return { game, baseline, recommendation: baseline ? recommendLevel(baseline) : null };
  });
}
export const nextAssessmentGame = clients => assessmentSteps(clients).find(step=>!step.baseline)?.game.id ?? null;
