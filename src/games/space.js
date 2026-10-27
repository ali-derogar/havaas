import { AdventureSession } from './adventure.js';
export const createSpace = options => new AdventureSession({ ...options, gameId: 'space' });
