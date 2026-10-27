import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { database,migrate } from '../server/db.js';
import { accountTransaction } from '../server/accounts.js';
import { token,digest } from '../server/security.js';
const rl=createInterface({input:process.stdin,output:process.stdout});const identifier=(await rl.question('Administrator username (or legacy email): ')).trim().toLowerCase();rl.close();
const pool=database();try{
 await migrate(pool);const raw=token();
 await accountTransaction(pool,async db=>{
  const user=(await db.query("SELECT id FROM users WHERE (lower(username)=$1 OR (legacy_email_login AND lower(email)=$1)) AND role='admin' AND active=true FOR UPDATE",[identifier])).rows[0];if(!user)throw Error('Active administrator not found');
  await db.query('UPDATE invitations SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);
  await db.query("INSERT INTO invitations(id,token_hash,role,purpose,created_by,user_id,expires_at) VALUES($1,$2,'admin','reset',$3,$3,now()+interval '30 minutes')",[randomUUID(),digest(raw),user.id]);
 });console.log(`${process.env.APP_ORIGIN||'http://localhost:4173'}/#invite/${raw}`);
}finally{await pool.end();}
