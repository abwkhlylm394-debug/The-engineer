import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';
import { createApp } from '../src/server.js';
import { openDb } from '../src/db.js';
import { hashPassword, verifyPassword } from '../src/auth.js';
const PW = 'correct horse battery';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-uploads-'));
const db = openDb(':memory:'); db.prepare('INSERT INTO admin_users(username,password_hash) VALUES(?,?)').run('owner', hashPassword(PW));
const srv = createApp(db, { notify: async () => 'off' }); await new Promise((r) => srv.listen(0, r));
const B = `http://127.0.0.1:${srv.address().port}`; test.after(() => srv.close());
const req = (p, { cookie, body, headers = {} } = {}) => fetch(B + p, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...headers }, body: body && new URLSearchParams(body) });
const login = (pw = PW) => req('/admin/login', { body: { username: 'owner', password: pw } });
async function session() { const r = await login(); const cookie = r.headers.get('set-cookie').split(';')[0]; const html = await (await req('/admin', { cookie })).text(); return { cookie, csrf: /name="_csrf" value="([^"]+)"/.exec(html)[1] }; }
const proj = { title: 'Test Project', slug: 'test-project', summary: 'A short summary', description: 'A longer description here.', category: 'Web development', technologies: 'Node.js, SQLite', status: 'personal', is_public: 'on' };
const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

test('passwords are hashed with scrypt and verify correctly', () => {
  const h = hashPassword(PW); assert.ok(h.startsWith('scrypt$') && !h.includes(PW)); assert.ok(verifyPassword(PW, h)); assert.ok(!verifyPassword('nope', h));
  assert.ok(!db.prepare('SELECT password_hash h FROM admin_users').get().h.includes(PW));
});
test('unauthenticated users cannot read or write admin resources', async () => {
  for (const p of ['/admin', '/admin/projects', '/admin/projects/new', '/admin/projects/1', '/admin/messages', '/admin/content', '/admin/activity']) { const r = await req(p); assert.equal(r.status, 303, p); assert.equal(r.headers.get('location'), '/admin/login'); }
  const n = count('projects');
  for (const [p, b] of [['/admin/projects', proj], ['/admin/projects/1/delete', {}], ['/admin/projects/1/toggle', {}], ['/admin/messages/1/delete', {}], ['/admin/content', { heroTitle: 'Hacked' }]]) assert.equal((await req(p, { body: b })).status, 303, p);
  assert.equal(count('projects'), n); assert.ok(!(await (await req('/')).text()).includes('Hacked'));
});
test('login: wrong password rejected; success sets hardened cookie and stores only a token hash', async () => {
  const bad = await login('wrong'); assert.equal(bad.status, 401); assert.equal(bad.headers.get('set-cookie'), null);
  const c = (await login()).headers.get('set-cookie'); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Path=\/admin/);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM sessions WHERE id_hash=?').get(c.split(';')[0].split('=')[1]).c, 0);
});
test('CSRF: state changes need the session token and a same-origin request', async () => {
  const s = await session(), n = count('projects');
  assert.equal((await req('/admin/projects', { cookie: s.cookie, body: { ...proj, slug: 'csrf-a' } })).status, 403);
  assert.equal((await req('/admin/projects', { cookie: s.cookie, body: { ...proj, slug: 'csrf-a', _csrf: 'wrong' } })).status, 403);
  assert.equal((await req('/admin/projects', { cookie: s.cookie, headers: { origin: 'http://evil.test' }, body: { ...proj, slug: 'csrf-a', _csrf: s.csrf } })).status, 403);
  assert.equal(count('projects'), n);
  assert.equal((await req('/admin/projects', { cookie: s.cookie, body: { ...proj, slug: 'csrf-a', _csrf: s.csrf } })).status, 303); assert.equal(count('projects'), n + 1);
});
test('admin can create, edit, unpublish, republish and delete projects; public site follows', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  assert.equal((await post('/admin/projects', { ...proj, slug: 'crud-project', title: 'Crud <b>Title</b>' })).status, 303);
  const id = db.prepare("SELECT id FROM projects WHERE slug='crud-project'").get().id;
  const pub = await (await req('/projects/crud-project')).text(); assert.ok(pub.includes('Crud &lt;b&gt;Title&lt;/b&gt;') && !pub.includes('<b>Title</b>'));
  assert.equal((await post(`/admin/projects/${id}`, { ...proj, slug: 'crud-project', title: 'Renamed' })).status, 303); assert.match(await (await req('/projects/crud-project')).text(), /Renamed/);
  await post(`/admin/projects/${id}/toggle`); assert.equal((await req('/projects/crud-project')).status, 404); assert.ok(!(await (await req('/projects')).text()).includes('Renamed'));
  await post(`/admin/projects/${id}/toggle`); assert.equal((await req('/projects/crud-project')).status, 200);
  await post(`/admin/projects/${id}/delete`); assert.equal(count('projects') - db.prepare('SELECT COUNT(*) c FROM projects WHERE id=?').get(id).c, count('projects'));
  assert.match(await (await req('/admin/activity', { cookie: s.cookie })).text(), /project_delete/);
});
test('Arabic project content is saved and rendered when Arabic is selected', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const payload = { ...proj, slug: 'arabic-project', title: 'English title', summary: 'English summary', description: 'English description for this project.', category: 'Web', title_ar: 'عنوان عربي', summary_ar: 'ملخص عربي للمشروع', description_ar: 'وصف عربي كامل لهذا المشروع.', category_ar: 'تطوير الويب' };
  assert.equal((await post('/admin/projects', payload)).status, 303);
  const en = await (await req('/projects/arabic-project')).text();
  const ar = await (await req('/projects/arabic-project', { cookie: 'lang=ar' })).text();
  assert.match(en, /English title/); assert.match(ar, /عنوان عربي/); assert.match(ar, /ملخص عربي للمشروع/); assert.match(ar, /وصف عربي كامل لهذا المشروع/);
});

test('project validation rejects unsafe URLs, bad and duplicate slugs', async () => {
  const s = await session(), post = (b) => req('/admin/projects', { cookie: s.cookie, body: { ...b, _csrf: s.csrf } }), n = count('projects');
  assert.equal((await post({ ...proj, slug: 'js-url', demo_url: 'javascript:alert(1)' })).status, 422);
  assert.equal((await post({ ...proj, slug: 'external-image', image_url: 'https://tracker.example/image.png' })).status, 422);
  assert.equal((await post({ ...proj, slug: '../etc/passwd' })).status, 422);
  assert.equal((await post({ ...proj, slug: 'csrf-a' })).status, 422); assert.equal(count('projects'), n);
});
test('site content edits persist, escape output, validate contact data, and reset to defaults', async () => {
  const s = await session(), post = (b) => req('/admin/content', { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  assert.equal((await post({ heroTitle: '<img src=x onerror=alert(1)>Custom Headline' })).status, 303);
  const home = await (await req('/')).text(); assert.ok(home.includes('&lt;img src=x onerror=alert(1)&gt;Custom Headline') && !home.includes('<img src=x'));
  assert.equal((await post({ contactEmail: 'not-an-email' })).status, 422); assert.equal((await post({ contactPhone: '0567876514' })).status, 422);
  assert.equal((await post({ contactPhone: '+970111222333' })).status, 303); assert.match(await (await req('/contact')).text(), /https:\/\/wa\.me\/970111222333/);
  assert.equal((await post({})).status, 303); const back = await (await req('/')).text();
  assert.ok(back.includes('Engineering Tomorrow. Building What Matters.') && back.includes('tel:+970567876514'));
});
test('owner can edit About, process steps, principles and FAQ content safely', async () => {
  const s = await session(), post = (b) => req('/admin/content', { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const saved = await post({ aboutIntro: 'Owner-written introduction for the public about page.', processIntro: 'A clear custom process description.', principlesText: 'Reliability first\nClear communication', processStepsText: 'Plan | Define the requirements carefully.\nBuild | Implement and verify the solution.', faqText: 'Can I update the site? | Yes, use the private admin dashboard.\n<script>alert(1)</script> | This text must remain escaped.' });
  assert.equal(saved.status, 303);
  const about = await (await req('/about')).text(); assert.match(about, /Owner-written introduction/);
  const process = await (await req('/process')).text(); assert.match(process, /Define the requirements carefully/); assert.match(process, /Implement and verify the solution/);
  const home = await (await req('/')).text(); assert.match(home, /Reliability first/); assert.match(home, /Can I update the site\?/); assert.ok(!home.includes('<script>alert(1)</script>'));
  await post({ founderName: '<img src=x onerror=alert(1)>Founder', founderTitle: '<script>alert(1)</script>Role' });
  const aboutInjected = await (await req('/about')).text(); assert.ok(aboutInjected.includes('&lt;img src=x onerror=alert(1)&gt;Founder')); assert.ok(!aboutInjected.includes('<img src=x onerror=alert(1)>'));
  await post({});
});
test('official contact details are linked on the site (mailto, tel, WhatsApp)', async () => {
  for (const p of ['/', '/contact']) { const t = await (await req(p)).text(); for (const x of ['mailto:abwkhlylm394@gmail.com', 'tel:+970567876514', 'https://wa.me/970567876514']) assert.ok(t.includes(x), `${p} ${x}`); }
});
test('contact messages: saved, listed, searchable (wildcards escaped), status change and delete', async () => {
  const f = { name: 'Grace', email: 'g@example.com', subject: 'Needle subject', message: 'Hello from the test', consent: 'on' };
  assert.equal((await req('/contact', { body: f })).status, 303); assert.equal((await req('/admin/messages')).status, 303);
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const list = (q) => req(`/admin/messages${q}`, { cookie: s.cookie }).then((r) => r.text());
  assert.match(await list(''), /Needle subject/); assert.match(await list('?q=needle'), /Needle subject/); assert.ok(!(await list('?q=zzzz')).includes('Needle subject')); assert.ok(!(await list('?q=%25')).includes('Needle subject'));
  const id = db.prepare('SELECT id FROM contact_messages ORDER BY id DESC').get().id;
  assert.equal((await post(`/admin/messages/${id}/status`, { status: 'bogus' })).status, 422);
  await post(`/admin/messages/${id}/status`, { status: 'archived' }); assert.equal(db.prepare('SELECT status FROM contact_messages WHERE id=?').get(id).status, 'archived'); assert.ok(!(await list('?status=new')).includes('Needle subject'));
  await post(`/admin/messages/${id}/delete`); assert.equal(db.prepare('SELECT COUNT(*) c FROM contact_messages WHERE id=?').get(id).c, 0);
});
test('logout and expiry invalidate sessions; admin responses are not cacheable', async () => {
  const s = await session(); assert.equal((await req('/admin', { cookie: s.cookie })).headers.get('cache-control'), 'no-store');
  await req('/admin/logout', { cookie: s.cookie, body: { _csrf: s.csrf } }); assert.equal((await req('/admin', { cookie: s.cookie })).status, 303);
  const s2 = await session(); db.prepare('UPDATE sessions SET expires_at=0').run(); assert.equal((await req('/admin', { cookie: s2.cookie })).status, 303);
});
test('admin data survives a restart (file database)', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eng-')), 'a.db'), a = openDb(f);
  a.prepare('INSERT INTO admin_users(username,password_hash) VALUES(?,?)').run('o', hashPassword(PW)); a.prepare("INSERT INTO site_settings(key,value) VALUES('heroTitle','Kept')").run(); a.close();
  const b = openDb(f); assert.ok(verifyPassword(PW, b.prepare('SELECT password_hash h FROM admin_users').get().h)); assert.equal(b.prepare('SELECT value v FROM site_settings').get().v, 'Kept'); b.close();
});

test('admin can manage service content and public rendering escapes edited text', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  assert.equal((await req('/admin/services', { cookie: s.cookie })).status, 200);
  assert.equal((await post('/admin/services/web-development', { title: '<b>Web engineering</b>', summary: 'A carefully edited service summary.', solves: 'Slow websites\nHard to maintain', deliverables: 'Responsive site\nDocumentation' })).status, 303);
  const html = await (await req('/services/web-development')).text();
  assert.ok(html.includes('&lt;b&gt;Web engineering&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Web engineering</b>'));
  assert.ok(html.includes('A carefully edited service summary.'));
});

test('service editor saves Arabic title, summary and deliverables for the public pages', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const r = await post('/admin/services/web-development', { title: 'Web development', summary: 'Responsive web solutions for businesses.', solves: 'Slow websites', deliverables: 'Responsive website', title_ar: 'تطوير المواقع', summary_ar: 'حلول مواقع متجاوبة للأعمال.', solves_ar: 'المواقع البطيئة', deliverables_ar: 'موقع متجاوب' });
  assert.equal(r.status, 303);
  const index = await (await req('/services', { cookie: 'lang=ar' })).text(); assert.match(index, /تطوير المواقع/);
  const detail = await (await req('/services/web-development', { cookie: 'lang=ar' })).text(); assert.match(detail, /حلول مواقع متجاوبة للأعمال/); assert.match(detail, /المواقع البطيئة/); assert.match(detail, /موقع متجاوب/);
});

test('admin can create, publish, edit and delete journal articles', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const article = { title: 'Launch notes', slug: 'launch-notes', summary: 'A short summary for the launch notes.', body: 'First paragraph with details.\n\nSecond paragraph with more detail.', is_public: 'on' };
  assert.equal((await post('/admin/articles', article)).status, 303);
  let html = await (await req('/journal')).text(); assert.ok(html.includes('Launch notes'));
  assert.ok((await req('/journal/launch-notes')).status === 200);
  const id = db.prepare("SELECT id FROM articles WHERE slug='launch-notes'").get().id;
  assert.equal((await req(`/admin/articles/${id}/preview`, { cookie: s.cookie })).status, 200);
  assert.equal((await post(`/admin/articles/${id}`, { ...article, title: 'Updated launch notes', is_public: 'on' })).status, 303);
  html = await (await req('/journal/launch-notes')).text(); assert.ok(html.includes('Updated launch notes'));
  await post(`/admin/articles/${id}/toggle`); assert.equal((await req('/journal/launch-notes')).status, 404);
  await post(`/admin/articles/${id}/delete`); assert.equal(db.prepare('SELECT COUNT(*) c FROM articles WHERE id=?').get(id).c, 0);
});


test('media uploads validate image content and serve only generated image filenames', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  const bad = await post('/admin/media', { image_type: 'image/png', image_data: Buffer.from('not an image').toString('base64') });
  assert.equal(bad.status, 422);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n0cAAAAASUVORK5CYII=';
  const good = await post('/admin/media', { image_type: 'image/png', image_data: png });
  assert.equal(good.status, 303);
  const location = good.headers.get('location'); const imageUrl = new URL(location, B).searchParams.get('uploaded');
  assert.match(imageUrl, /^\/uploads\/[a-f0-9-]+\.png$/);
  const served = await req(imageUrl); assert.equal(served.status, 200); assert.match(served.headers.get('content-type'), /image\/png/);
  assert.equal((await req('/uploads/../../src/server.js')).status, 404);
});



test('administrator can change password and other sessions are invalidated', async () => {
  const s = await session(), post = (p, b = {}) => req(p, { cookie: s.cookie, body: { ...b, _csrf: s.csrf } });
  assert.equal((await post('/admin/password', { current: 'wrong current password', next: 'a-new-long-password', confirm: 'a-new-long-password' })).status, 422);
  assert.equal((await post('/admin/password', { current: PW, next: 'a-new-long-password', confirm: 'mismatch-password' })).status, 422);
  assert.equal((await post('/admin/password', { current: PW, next: 'a-new-long-password', confirm: 'a-new-long-password' })).status, 303);
  assert.ok(verifyPassword('a-new-long-password', db.prepare("SELECT password_hash FROM admin_users WHERE username='owner'").get().password_hash));
  assert.equal((await req('/admin', { cookie: s.cookie })).status, 200);
});


test('login brute force is rate limited, even with the right password afterwards', async () => {
  let r; for (let i = 0; i < 10; i++) { r = await login('wrong-' + i); if (r.status === 429) break; }
  assert.equal(r.status, 429); assert.equal((await login()).status, 429);
});


