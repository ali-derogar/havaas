import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const password=randomBytes(24).toString('hex');
try{await writeFile('.env',`POSTGRES_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nAPP_PORT=4173\nAPP_BIND=127.0.0.1\nAPP_ORIGIN=http://localhost:4173\nDATABASE_URL=postgresql://havaas:${password}@127.0.0.1:55432/havaas\n`,{flag:'wx',mode:0o600});console.log('Created .env with independent random secrets.');}catch(error){if(error.code==='EEXIST')console.log('.env already exists; it was not modified.');else throw error;}
