// Read the authoritative start snapshot rendered by the application.
export const trialMs = page => page.locator('.play-panel').evaluate(node=>Number(node.dataset.intervalMs));
