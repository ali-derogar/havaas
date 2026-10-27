import { AdventureSession } from './adventure.js';
export const createArk = options => new AdventureSession({ ...options, gameId: 'ark' });
