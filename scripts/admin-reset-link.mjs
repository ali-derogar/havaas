import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { database,migrate } from '../server/db.js';
import { emailOf,token,digest } from '../server/security.js';
const rl=createInterface({input:process.stdin,output:process.stdout});const email=emailOf(await rl.question('Administrator email: '));rl.close();
const pool=database();try{await migrate(pool);const user=(await pool.query("SELECT id FROM users WHERE email=$1 AND role='admin' AND active=true",[email])).rows[0];if(!user)throw Error('Active administrator not found');const raw=token();await pool.query("INSERT INTO invitations(id,token_hash,email,role,purpose,created_by,expires_at) VALUES($1,$2,$3,'admin','reset',$4,now()+interval '30 minutes')",[randomUUID(),digest(raw),email,user.id]);console.log(`${process.env.APP_ORIGIN||'http://localhost:4173'}/#invite/${raw}`);}finally{await pool.end();}
