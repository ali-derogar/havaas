import { rm, mkdir, cp, writeFile } from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServiceWorker} from './pwa.mjs';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'offline.html', 'manifest.webmanifest', 'src', 'assets']) await cp(path, `dist/${path}`, { recursive: true });
await writeFile('dist/sw.js',await createServiceWorker(resolve('dist')));
console.log('Static site built in dist/');
