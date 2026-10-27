import { rm, mkdir, cp } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'src', 'assets']) await cp(path, `dist/${path}`, { recursive: true });
console.log('Static site built in dist/');
