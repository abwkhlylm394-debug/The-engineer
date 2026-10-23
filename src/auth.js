import crypto from 'node:crypto';
export const SESSION_MS = 8 * 3600 * 1000;
const P = { N: 16384, r: 8, p: 1 };
export const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
export const hashPassword = (pw) => { const s = crypto.randomBytes(16); return `scrypt$${s.toString('base64')}$${crypto.scryptSync(pw, s, 64, P).toString('base64')}`; };
export const verifyPassword = (pw, stored) => {
  const [a, s, h] = String(stored).split('$'); if (a !== 'scrypt' || !s || !h) return false;
  const exp = Buffer.from(h, 'base64'); return crypto.timingSafeEqual(crypto.scryptSync(pw, Buffer.from(s, 'base64'), exp.length, P), exp);
};
export const DUMMY = hashPassword(crypto.randomBytes(8).toString('hex')); // equalises timing for unknown users
export function createSession(db, userId) {
  const tok = crypto.randomBytes(32).toString('base64url'), csrf = crypto.randomBytes(24).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
  db.prepare('INSERT INTO sessions(id_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)').run(sha(tok), userId, csrf, Date.now() + SESSION_MS);
  return tok;
}
export function getSession(db, req) {
  const m = /(?:^|;\s*)eng_sid=([\w-]{20,})/.exec(req.headers.cookie || ''); if (!m) return null;
  const h = sha(m[1]), row = db.prepare('SELECT s.user_id,s.csrf,s.expires_at,u.username FROM sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.id_hash=?').get(h);
  if (!row) return null;
  if (row.expires_at < Date.now()) { db.prepare('DELETE FROM sessions WHERE id_hash=?').run(h); return null; }
  return { ...row, hash: h };
}
export const log = (db, uid, action, detail = '') => db.prepare('INSERT INTO activity_log(user_id,action,detail) VALUES(?,?,?)').run(uid, action, String(detail).slice(0, 200));
