import { writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { testDatabase,seedAccounts } from '../tests/helpers/database.mjs';
import { createApp } from '../server/app.js';
import express from 'express';
const db=await testDatabase(process.env.DATABASE_URL,`havaas_e2e_${process.pid}`),seed=await seedAccounts(db.pool);
process.env.APP_ORIGIN='http://127.0.0.1:4181';
await mkdir('.local/verification',{recursive:true});await writeFile('.local/e2e-credentials.json',JSON.stringify(seed),{mode:0o600});
const app=express();app.disable('x-powered-by');let pwaRelease=0;
// Simulate deployment without creating temporary files in the user's assets.
app.post('/__e2e/pwa-release',(_req,res)=>res.json({release:++pwaRelease}));
app.use((req,res,next)=>{
 if(req.path==='/sw.js'&&pwaRelease){const release=pwaRelease,send=res.send.bind(res);res.send=body=>send(typeof body==='string'?body.replace(/const RELEASE='([^']+)';/,(_match,version)=>`const RELEASE='${version}-e2e-${release}';`):body);}
 next();
});
app.use(createApp({pool:db.pool,loginLimit:200,secret:'e2e-session-secret-with-at-least-thirty-two-characters',staticRoot:resolve('.')}));
const server=app.listen(4181,'127.0.0.1',()=>console.log('E2E ready http://127.0.0.1:4181'));
async function stop(){await new Promise(r=>{server.close(r);server.closeAllConnections();});await db.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
