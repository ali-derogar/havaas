import { resolve } from 'node:path';
import { database, migrate } from './db.js';
import { createApp } from './app.js';
const pool=database();await migrate(pool);
const app=createApp({pool,staticRoot:resolve(process.env.STATIC_ROOT||'dist')});
const server=app.listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log(`حواس: http://localhost:${server.address().port}`));
async function stop(){server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
