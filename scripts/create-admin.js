import readline from 'node:readline';
import { openDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
const username = process.argv[2];
if (!/^[A-Za-z0-9._-]{3,32}$/.test(username || '')) { console.error('Usage: npm run create-admin -- <username>  (3-32 chars: letters, numbers . _ -)'); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
let muted = false; rl._writeToOutput = (s) => { if (!muted) process.stdout.write(s); };
const lines = rl[Symbol.asyncIterator]();
const ask = async (q) => { process.stdout.write(q); muted = true; const { value } = await lines.next(); muted = false; process.stdout.write('\n'); return value ?? ''; };
const pw = await ask('Password (min 12 characters): '), again = await ask('Repeat password: '); rl.close();
if (pw.length < 12 || pw !== again) { console.error('Passwords must match and be at least 12 characters.'); process.exit(1); }
const db = openDb();
try { db.prepare('INSERT INTO admin_users(username,password_hash) VALUES(?,?)').run(username, hashPassword(pw)); console.log(`Administrator "${username}" created.`); }
catch (e) { console.error(/UNIQUE/.test(e.message) ? 'That username already exists.' : 'Could not create administrator.'); process.exit(1); }
