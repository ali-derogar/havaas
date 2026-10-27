import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { database, migrate } from '../../server/db.js';
import { passwordHash } from '../../server/security.js';
export const testPassword='Havaas-test-password-2026!';
export async function testDatabase(source,name){
  const manager=new pg.Pool({connectionString:source}),url=new URL(source);await manager.query(`CREATE DATABASE ${name}`);url.pathname='/'+name;const pool=database(url.href);await migrate(pool);
  return {pool,url:url.href,async close(){await pool.end();await manager.query(`DROP DATABASE ${name} WITH (FORCE)`);await manager.end();}};
}
export async function seedAccounts(pool){
 const hash=await passwordHash(testPassword),users={};
 for(const [key,role,name] of [['admin','admin','مدیر مرکز'],['user','user','کاربر اول'],['otherUser','user','کاربر دوم']]){
   const id=randomUUID(),username=key.toLowerCase(),email=`${username}@example.test`;await pool.query('INSERT INTO users(id,username,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,username,email,name,role,hash]);users[key]={id,username,email,name,role};
 }
 const children=[];
 for(let i=0;i<2;i++){
  const id=randomUUID(),profile={firstName:i?'علی':'سارا',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:`clinical-secret-${i}`};
  await pool.query('INSERT INTO children(id,owner_user_id,profile) VALUES($1,$2,$3)',[id,i?users.otherUser.id:users.user.id,profile]);children.push({id,...profile});
 }
 return {users,children,password:testPassword};
}
