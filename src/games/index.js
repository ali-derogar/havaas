import { createHunt } from './hunt.js';
import { createTraffic } from './traffic.js';
import { createNBack } from './nback.js';
import { createStroop } from './stroop.js';
import { SearchSession } from './search.js';
import { createArk } from './ark.js';
import { createSpace } from './space.js';
export const FACTORIES = { hunt: createHunt, ark: createArk, space: createSpace, traffic: createTraffic, search: options => new SearchSession(options), nback: createNBack, stroop: createStroop };
