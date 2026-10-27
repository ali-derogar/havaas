import { database,migrate } from '../server/db.js';
const pool=database();try{await migrate(pool);console.log('Database migrations applied.');}finally{await pool.end();}
