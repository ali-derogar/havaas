import pg from 'pg';
import { readFile } from 'node:fs/promises';
export function database(url=process.env.DATABASE_URL) {
  if(!url)throw Error('DATABASE_URL is required');
  return new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:5000});
}
export async function transaction(pool,fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
export async function migrate(pool){
  await transaction(pool,async db=>{
    await db.query("SELECT pg_advisory_xact_lock(82004173)");
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    if(!(await db.query('SELECT 1 FROM schema_migrations WHERE version=1')).rowCount){
      await db.query(await readFile(new URL('./migrations/001.sql',import.meta.url),'utf8'));
      await db.query('INSERT INTO schema_migrations(version) VALUES(1)');
    }
  });
}
