import { randomUUID } from 'node:crypto';
import { database, migrate, transaction } from '../server/db.js';
import { passwordHash, emailOf, usernameOf } from '../server/security.js';
// JSON is read from stdin, never from command-line password arguments.
let input;
if(process.stdin.isTTY){
  const {createInterface}=await import('node:readline/promises');const {Writable}=await import('node:stream');let hidden=false;
  const output=new Writable({write(chunk,_encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
  const rl=createInterface({input:process.stdin,output,terminal:true});
  const username=await rl.question('Username: '),email=await rl.question('Email (optional): '),name=await rl.question('Name: ');process.stdout.write('Password (12+ characters, hidden): ');hidden=true;const password=await rl.question('');hidden=false;process.stdout.write('\n');rl.close();input={username,email,name,password};
}else{const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Provide a JSON object with username, name and password on stdin.');}}
const username=usernameOf(input.username),email=input.email?emailOf(input.email):null,name=String(input.name||'').trim();if(name.length<2)throw Error('Name is required');
const password=await passwordHash(input.password),pool=database();
try {await migrate(pool);await transaction(pool,async db=>{await db.query('SELECT pg_advisory_xact_lock(82004174)');if((await db.query("SELECT 1 FROM users WHERE role='admin'")).rowCount)throw Error('An administrator already exists. Use account management to reset access.');await db.query("INSERT INTO users(id,username,email,name,role,password_hash) VALUES($1,$2,$3,$4,'admin',$5)",[randomUUID(),username,email,name,password]);});console.log('Administrator created.');} finally {await pool.end();}
