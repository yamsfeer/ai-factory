import { openDb, seedDb } from './db.ts';

const db = openDb(process.env.DB_PATH ?? 'data/app.db');
seedDb(db, process.argv.includes('--reset'));
console.log('seed done');
