import { mkdirSync, existsSync } from 'node:fs';
import { openDb } from '../src/db.js';
const out = process.argv[2] || `backups/app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
if (existsSync(out)) { console.error('Refusing to overwrite', out); process.exit(1); }
mkdirSync('backups', { recursive: true });
openDb().exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`); console.log('Backup written to', out);
