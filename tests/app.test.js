import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { openDb } from '../src/db.js';
const db = openDb(':memory:');
const srv = createApp(db); await new Promise((r) => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;
test.after(() => srv.close());
const post = (b, h = {}) => fetch(base + '/contact', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...h }, body: new URLSearchParams(b) });
const ok = { name: 'Ada', email: 'ada@example.com', subject: 'Hello there', message: 'I would like a website.', consent: 'on' };
test('public pages render', async () => {
  for (const p of ['/', '/about', '/services', '/services/web-development', '/services/artificial-intelligence', '/projects', '/projects/the-engineer-website', '/process', '/contact', '/privacy', '/terms', '/robots.txt', '/sitemap.xml'])
    assert.equal((await fetch(base + p)).status, 200, p);
  assert.match(await (await fetch(base + '/')).text(), /Engineering Intelligence\. Building What Comes Next\./);
});
test('Arabic language preference sets a safe persistent cookie and renders RTL', async () => {
  const choose = await fetch(base + '/language?lang=ar&return=%2Fcontact', { redirect: 'manual' });
  assert.equal(choose.status, 303);
  assert.equal(choose.headers.get('location'), '/contact');
  assert.match(choose.headers.get('set-cookie'), /lang=ar/);
  assert.match(choose.headers.get('set-cookie'), /HttpOnly/);
  const cookie = choose.headers.get('set-cookie').split(';')[0];
  const homeAr = await (await fetch(base + '/', { headers: { cookie } })).text();
  assert.match(homeAr, /<html lang="ar" dir="rtl">/);
  assert.match(homeAr, /هندسة الذكاء\. نبني ما سيأتي بعد ذلك\./);
  assert.match(homeAr, /العربية|English/);
  const contactAr = await (await fetch(base + '/contact', { headers: { cookie } })).text();
  assert.match(contactAr, /href="\/privacy"/);
  assert.match(contactAr, /mailto:abwkhlylm394@gmail.com/);
  const blocked = await fetch(base + '/language?lang=ar&return=https%3A%2F%2Fevil.test', { redirect: 'manual' });
  assert.equal(blocked.headers.get('location'), '/');
  const english = await fetch(base + '/language?lang=en&return=%2F', { redirect: 'manual' });
  assert.match(english.headers.get('set-cookie'), /lang=en/);
});
test('unknown service, project and page return 404', async () => {
  for (const p of ['/services/nope', '/projects/nope', '/nope']) assert.equal((await fetch(base + p)).status, 404, p);
});
test('security headers set; health reveals no secrets', async () => {
  const r = await fetch(base + '/health'); assert.deepEqual(await r.json(), { status: 'ok' });
  assert.ok(r.headers.get('content-security-policy'));
});
test('invalid contact is rejected and not stored', async () => {
  const r = await post({ ...ok, email: 'bad', consent: '' });
  assert.equal(r.status, 422); assert.match(await r.text(), /valid email/);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM contact_messages').get().c, 0);
});
test('cross-origin and honeypot submissions are blocked', async () => {
  assert.equal((await post(ok, { origin: 'http://evil.test' })).status, 403);
  assert.equal((await post({ ...ok, website: 'x' })).status, 400);
});
test('valid contact is persisted; XSS stays escaped', async () => {
  const r = await post({ ...ok, name: '<script>alert(1)</script>' });
  assert.equal(r.status, 303);
  const row = db.prepare('SELECT * FROM contact_messages').get(); assert.equal(row.status, 'new');
  const bad = await post({ ...ok, name: '"><img src=x>', email: 'x' });
  assert.ok(!(await bad.text()).includes('"><img'));
});
test('database failure is reported honestly', async () => {
  const broken = createApp({ prepare() { throw new Error('down'); } }); await new Promise((r) => broken.listen(0, r));
  const r = await fetch(`http://127.0.0.1:${broken.address().port}/contact`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(ok) });
  assert.equal(r.status, 503); broken.close();
});
test('rate limiting kicks in', async () => {
  let last; for (let i = 0; i < 8; i++) last = await post({ ...ok, email: 'x' });
  assert.equal(last.status, 429);
});
import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';
test('assets, logo and favicon are served', async () => {
  for (const [p, t] of [['/app.js', 'javascript'], ['/logo.svg', 'svg'], ['/favicon.svg', 'svg'], ['/styles.css', 'css']]) { const r = await fetch(base + p); assert.equal(r.status, 200, p); assert.match(r.headers.get('content-type'), new RegExp(t)); }
});
test('responsive stylesheet includes laptop, phone, reduced-motion and contrast support', async () => {
  const css = await (await fetch(base + '/styles.css')).text();
  assert.match(css, /@media\s*\(max-width:\s*820px\)/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /prefers-contrast:\s*more/);
});
test('project category filter works and empty state shows', async () => {
  const hit = await (await fetch(base + '/projects?category=Web%20development')).text(); assert.match(hit, /THE ENGINEER website/);
  const miss = await (await fetch(base + '/projects?category=%3Cb%3Ex')).text(); assert.match(miss, /No projects in this category/); assert.ok(!miss.includes('<b>x'));
});
test('email outcome is recorded and never overstated', async () => {
  const run = async (notify) => { const d = openDb(':memory:'), s = createApp(d, { notify }); await new Promise((r) => s.listen(0, r));
    const r = await fetch(`http://127.0.0.1:${s.address().port}/contact`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(ok) }); s.close();
    return [r.headers.get('location'), d.prepare('SELECT notification n FROM contact_messages').get().n]; };
  assert.deepEqual(await run(async () => 'sent'), ['/contact?sent=1&n=sent', 'sent']);
  assert.deepEqual(await run(async () => { throw new Error('x'); }), ['/contact?sent=1&n=failed', 'failed']);
  assert.deepEqual(await run(), ['/contact?sent=1&n=off', 'off']);
  const t = await (await fetch(base + '/contact?sent=1&n=off')).text(); assert.match(t, /Email notification is unavailable/); assert.ok(!/delivered/.test(t));
});
test('messages and projects persist across restart', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eng-')), 'a.db');
  const a = openDb(f); a.prepare("INSERT INTO contact_messages(name,email,subject,message) VALUES('A','a@b.co','Subj','Hello hello')").run(); a.close();
  const b = openDb(f); assert.equal(b.prepare('SELECT COUNT(*) c FROM contact_messages').get().c, 1); assert.equal(b.prepare('SELECT COUNT(*) c FROM projects').get().c, 7); b.close();
});
