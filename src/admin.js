import crypto from 'node:crypto';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { esc, journalArticle } from './views.js';
import { safeUrl } from './validate.js';
import { EDITABLE, DEF, site, services as serviceList } from './config.js';
import { verifyPassword, hashPassword, createSession, getSession, log, SESSION_MS, DUMMY } from './auth.js';
import { loadSettings } from './db.js';

const fails = new Map();
const recent = (k) => { const now = Date.now(), a = (fails.get(k) || []).filter((t) => now - t < 9e5); fails.set(k, a); if (fails.size > 2000) { for (const [key, times] of fails) { const live = times.filter((t) => now - t < 9e5); if (live.length) fails.set(key, live); else fails.delete(key); } } return a; };
const fail = (k) => recent(k).push(Date.now());
const eq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const NAV = [['/admin', 'Dashboard'], ['/admin/projects', 'Projects'], ['/admin/services', 'Services'], ['/admin/articles', 'Articles'], ['/admin/media', 'Media'], ['/admin/messages', 'Messages'], ['/admin/content', 'Site content'], ['/admin/password', 'Password'], ['/admin/activity', 'Activity']];
const fm = (action, csrf, inner, attrs = '') => `<form method="post" action="${action}" ${attrs}><input type="hidden" name="_csrf" value="${esc(csrf)}">${inner}</form>`;
const tr = (c) => `<tr>${c.map((x) => `<td>${x}</td>`).join('')}</tr>`;
const doc = (t, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(t)} | Admin</title><link rel="stylesheet" href="/styles.css"><script src="/app.js"></script></head><body class="adm">${inner}</body></html>`;
const shell = (t, body, s, ok) => doc(t, `<header class="solid"><div class="wrap bar"><strong>THE ENGINEER admin</strong><nav class="anav" aria-label="Admin">${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="/">View site</a></nav>${fm('/admin/logout', s.csrf, '<button class="btn sm ghost">Log out</button>')}</div></header><main class="wrap sec"><h1>${esc(t)}</h1>${ok ? '<p role="status" class="ok">Changes saved.</p>' : ''}${body}</main>`);
const plain = (t, m) => doc(t, `<main class="wrap sec"><h1>${esc(t)}</h1><p>${esc(m)}</p><a href="/admin/login">Admin login</a></main>`);
const loginPage = (err) => doc('Log in', `<main class="wrap sec"><h1>Admin log in</h1>${err ? `<p role="alert" class="err">${esc(err)}</p>` : ''}<form method="post" action="/admin/login" class="form"><p><label for="username">Username</label><input id="username" name="username" autocomplete="username" required></p><p><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></p><button class="btn">Log in</button></form></main>`);

const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function validateProject(f) {
  const t = (k) => String(f[k] ?? '').trim();
  const v = { title: t('title'), title_ar: t('title_ar'), slug: t('slug').toLowerCase(), summary: t('summary'), summary_ar: t('summary_ar'), description: t('description'), description_ar: t('description_ar'), category: t('category'), category_ar: t('category_ar'), technologies: t('technologies'), status: t('status'), demo_url: t('demo_url'), repo_url: t('repo_url'), image_url: t('image_url'), is_public: f.is_public === 'on' ? 1 : 0 };
  const e = {};
  if (v.title.length < 2 || v.title.length > 120) e.title = 'Enter a title (2–120 characters).';
  for (const [k, max] of [['title_ar',120],['summary_ar',240],['description_ar',5000],['category_ar',60]]) if (v[k].length > max) e[k] = `Keep ${k.replace('_ar','')} Arabic content under ${max} characters.`;
  if (!slugRe.test(v.slug) || v.slug.length < 3 || v.slug.length > 60) e.slug = 'Use 3–60 lowercase letters, numbers and single hyphens.';
  if (v.summary.length < 5 || v.summary.length > 240) e.summary = 'Enter a summary (5–240 characters).';
  if (v.description.length < 10 || v.description.length > 5000) e.description = 'Enter a description (10–5000 characters).';
  if (v.category.length < 2 || v.category.length > 60) e.category = 'Enter a category (2–60 characters).';
  if (!['demonstration', 'personal', 'client'].includes(v.status)) e.status = 'Choose a status.';
  for (const k of ['demo_url', 'repo_url']) if (v[k] && !safeUrl(v[k])) e[k] = 'Enter a full http(s) URL, or leave empty.';
  if (v.image_url && !/^\/uploads\/[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(v.image_url)) e.image_url = 'Upload the image in Media and use its local /uploads/ URL. External images are not accepted.';
  const techs = v.technologies.split(',').map((x) => x.trim()).filter(Boolean);
  if (techs.length > 12 || techs.some((x) => x.length > 40)) e.technologies = 'Up to 12 technologies, 40 characters each.';
  v.techJson = JSON.stringify(techs);
  return { v, e };
}
const F = (n, l, v, e, o = {}) => `<p><label for="${n}">${l}</label>${o.area ? `<textarea id="${n}" name="${n}" rows="${o.area}">${esc(v[n])}</textarea>` : o.opts ? `<select id="${n}" name="${n}">${o.opts.map((x) => `<option${x === v[n] ? ' selected' : ''}>${x}</option>`).join('')}</select>` : `<input id="${n}" name="${n}" value="${esc(v[n])}">`}${o.hint ? `<span class="small">${o.hint}</span>` : ''}${e[n] ? `<span class="err" role="alert">${e[n]}</span>` : ''}</p>`;
const projForm = (v, e, s, action, title) => shell(title, fm(action, s.csrf, `<h2>English content</h2>${F('title', 'Title (English)', v, e)}${F('slug', 'Page address (slug)', v, e, { hint: 'Used in the URL, e.g. my-project.' })}${F('summary', 'Short summary (English)', v, e)}${F('description', 'Full description (English)', v, e, { area: 8 })}${F('category', 'Category (English)', v, e)}<h2>Arabic content (optional)</h2>${F('title_ar', 'Title (Arabic)', v, e)}${F('summary_ar', 'Short summary (Arabic)', v, e, { area: 3 })}${F('description_ar', 'Full description (Arabic)', v, e, { area: 8 })}${F('category_ar', 'Category (Arabic)', v, e)}${F('technologies', 'Technologies', v, e, { hint: 'Comma separated.' })}${F('status', 'Project type', v, e, { opts: ['demonstration', 'personal', 'client'], hint: 'Choose "client" only for verified client work.' })}${F('demo_url', 'Live demo URL (optional)', v, e)}${F('repo_url', 'Source repository URL (optional)', v, e)}${F('image_url', 'Project image URL (optional; use a URL copied from Media)', v, e, { hint: 'Use a URL from the Media page, such as /uploads/example.webp.' })}<p><label class="chk"><input type="checkbox" name="is_public"${v.is_public ? ' checked' : ''}> Published (visible on the public site)</label></p><button class="btn">Save project</button> <a href="/admin/projects">Cancel</a>`, 'class="form wide" data-dirty'), s);
const like = (q) => '%' + q.replace(/[\\%_]/g, '\\$&') + '%';

function messagesPage(db, url, s) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100), st0 = url.searchParams.get('status'), st = ['new', 'read', 'archived'].includes(st0) ? st0 : '';
  const pg = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1), per = 20;
  const W = "WHERE ($q='' OR name LIKE $l ESCAPE '\\' OR email LIKE $l ESCAPE '\\' OR subject LIKE $l ESCAPE '\\' OR message LIKE $l ESCAPE '\\') AND ($st='' OR status=$st)", P = { $q: q, $l: like(q), $st: st };
  const total = db.prepare(`SELECT COUNT(*) c FROM contact_messages ${W}`).get(P).c, pages = Math.max(1, Math.ceil(total / per));
  const rows = db.prepare(`SELECT * FROM contact_messages ${W} ORDER BY created_at DESC, id DESC LIMIT ${per} OFFSET $o`).all({ ...P, $o: (pg - 1) * per });
  const qs = (n) => `?q=${encodeURIComponent(q)}&status=${st}&page=${n}`;
  return shell('Messages', `<form method="get" class="inl filt"><input name="q" value="${esc(q)}" placeholder="Search messages" aria-label="Search messages"><select name="status" aria-label="Status"><option value="">All statuses</option>${['new', 'read', 'archived'].map((x) => `<option${x === st ? ' selected' : ''}>${x}</option>`).join('')}</select><button class="btn sm">Filter</button></form>
<p class="small">${total} message(s). Email notification: ${process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.NOTIFY_TO ? 'configured (delivery unverified until tested)' : 'not configured; messages are stored only'}.</p>
<div class="tw"><table><thead><tr><th>Received</th><th>From</th><th>Message</th><th>Email sent?</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((m) => tr([esc(m.created_at), `${esc(m.name)}<br><a href="mailto:${esc(encodeURI(m.email))}">${esc(m.email)}</a>`, `<details><summary>${esc(m.subject)}</summary><p class="pre">${esc(m.message)}</p></details>`, esc(m.notification), fm(`/admin/messages/${m.id}/status`, s.csrf, `<select name="status" aria-label="Status">${['new', 'read', 'archived'].map((x) => `<option${x === m.status ? ' selected' : ''}>${x}</option>`).join('')}</select><button class="lnk">Save</button>`, 'class="inl"'), fm(`/admin/messages/${m.id}/delete`, s.csrf, '<button class="lnk">Delete</button>', 'class="inl" data-confirm="Delete this message permanently?"')])).join('') || tr(['No messages found.', '', '', '', '', ''])}</tbody></table></div>
<p>${pg > 1 ? `<a href="${qs(pg - 1)}">Previous</a> ` : ''}Page ${pg} of ${pages}${pg < pages ? ` <a href="${qs(pg + 1)}">Next</a>` : ''}</p>`, s);
}

const articleForm = (v,s,action) => fm(action,s.csrf,`<h2>English content</h2>${F('title','Title (English)',v,{})}${F('slug','URL slug',v,{},{hint:'lowercase-words-separated-by-hyphens'})}${F('summary','Summary (English)',v,{},{area:3})}${F('body','Article body (English; paragraphs separated by blank lines)',v,{},{area:14})}<h2>Arabic content (optional)</h2>${F('title_ar','Title (Arabic)',v,{})}${F('summary_ar','Summary (Arabic)',v,{},{area:3})}${F('body_ar','Article body (Arabic; paragraphs separated by blank lines)',v,{},{area:14})}<p><label class="chk"><input type="checkbox" name="is_public"${v.is_public?' checked':''}> Published</label></p><button class="btn">Save article</button> <a href="/admin/articles">Cancel</a>`, 'class="form wide" data-dirty');

export async function admin(req, p, url, db, { send, readBody }) {
  const out = (st, b, x = {}) => send(st, b, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store', ...x });
  const go = (loc, x = {}) => send(303, '', 'text/plain', { Location: loc, 'Cache-Control': 'no-store', ...x });
  if (req.method !== 'GET' && req.method !== 'POST') return send(405, 'Method not allowed', 'text/plain', { Allow: 'GET, POST' });
  const ip = req.socket.remoteAddress, prod = process.env.NODE_ENV === 'production';
  let f = {};
  if (req.method === 'POST') {
    const o = req.headers.origin; let bad = false; if (o) { try { bad = new URL(o).host !== req.headers.host; } catch { bad = true; } }
    if (bad) return out(403, plain('Request blocked', 'Cross-origin requests are not accepted.'));
    try { f = Object.fromEntries(new URLSearchParams(await readBody(req, p === '/admin/media' ? 3000000 : 64000))); } catch { return out(413, plain('Request too large', 'Please shorten your input.')); }
  }
  const s = getSession(db, req), cookie = (v, age) => `eng_sid=${v}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${age}${prod ? '; Secure' : ''}`;
  if (p === '/admin/login') {
    if (s) return go('/admin');
    if (req.method === 'GET') return out(200, loginPage());
    const u = String(f.username ?? '').trim().slice(0, 64), pw = String(f.password ?? '').slice(0, 200);
    if (recent(ip).length >= 8 || recent('u:' + u).length >= 8) return out(429, loginPage('Too many attempts. Try again in 15 minutes.'), { 'Retry-After': '900' });
    const user = db.prepare('SELECT * FROM admin_users WHERE username=?').get(u);
    if (!(verifyPassword(pw, user?.password_hash || DUMMY) && user)) { fail(ip); fail('u:' + u); log(db, null, 'login_failed', ip); return out(401, loginPage('Incorrect username or password.')); }
    log(db, user.id, 'login'); return go('/admin', { 'Set-Cookie': cookie(createSession(db, user.id), SESSION_MS / 1000) });
  }
  if (!s) return go('/admin/login');
  if (req.method === 'POST' && !eq(f._csrf ?? '', s.csrf)) return out(403, plain('Security check failed', 'The security token was missing or invalid. Reload the page and try again.'));
  const ok = url.searchParams.get('ok') === '1', uid = s.user_id;
  if (p === '/admin/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE id_hash=?').run(s.hash); log(db, uid, 'logout'); return go('/admin/login', { 'Set-Cookie': cookie('', 0) }); }
  if (p === '/admin' && req.method === 'GET') {
    const c = (q) => db.prepare(q).get().c;
    return out(200, shell('Dashboard', `<ul class="plain"><li>${c('SELECT COUNT(*) c FROM projects WHERE is_public=1')} published project(s), ${c('SELECT COUNT(*) c FROM projects WHERE is_public=0')} draft(s)</li><li>${c("SELECT COUNT(*) c FROM contact_messages WHERE status='new'")} new message(s)</li></ul><p><a href="/admin/messages?status=new">Review new messages</a></p>`, s, ok));
  }
  if (p === '/admin/projects' && req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    return out(200, shell('Projects', `<p><a class="btn sm" href="/admin/projects/new">New project</a></p><div class="tw"><table><thead><tr><th>Title</th><th>Category</th><th>Type</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>${rows.map((r) => tr([esc(r.title), esc(r.category), esc(r.status), r.is_public ? 'Published' : 'Draft', `<a href="/admin/projects/${r.id}">Edit</a> ${fm(`/admin/projects/${r.id}/toggle`, s.csrf, `<button class="lnk">${r.is_public ? 'Unpublish' : 'Publish'}</button>`, 'class="inl"')} ${fm(`/admin/projects/${r.id}/delete`, s.csrf, '<button class="lnk">Delete</button>', 'class="inl" data-confirm="Delete this project permanently?"')}`])).join('') || tr(['No projects yet.', '', '', '', ''])}</tbody></table></div>`, s, ok));
  }
  const blank = { title: '', title_ar: '', slug: '', summary: '', summary_ar: '', description: '', description_ar: '', category: '', category_ar: '', technologies: '', status: 'personal', demo_url: '', repo_url: '', image_url: '', is_public: 0 };
  if (p === '/admin/projects/new' && req.method === 'GET') return out(200, projForm(blank, {}, s, '/admin/projects', 'New project'));
  const save = (id, body) => {
    const { v, e } = validateProject(body);
    if (!Object.keys(e).length) {
      try {
        if (id) db.prepare("UPDATE projects SET slug=?,title=?,summary=?,description=?,category=?,technologies=?,status=?,is_public=?,demo_url=?,repo_url=?,image_url=?,title_ar=?,summary_ar=?,description_ar=?,category_ar=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(v.slug, v.title, v.summary, v.description, v.category, v.techJson, v.status, v.is_public, v.demo_url || null, v.repo_url || null, v.image_url || null, v.title_ar, v.summary_ar, v.description_ar, v.category_ar, id);
        else db.prepare('INSERT INTO projects(slug,title,summary,description,category,technologies,status,is_public,demo_url,repo_url,image_url,title_ar,summary_ar,description_ar,category_ar) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(v.slug, v.title, v.summary, v.description, v.category, v.techJson, v.status, v.is_public, v.demo_url || null, v.repo_url || null, v.image_url || null, v.title_ar, v.summary_ar, v.description_ar, v.category_ar);
        log(db, uid, id ? 'project_update' : 'project_create', v.slug); return null;
      } catch (x) { if (!/UNIQUE/.test(x.message)) throw x; e.slug = 'That slug is already used.'; }
    }
    return { v, e };
  };
  if (p === '/admin/projects' && req.method === 'POST') { const r = save(null, f); return r ? out(422, projForm(r.v, r.e, s, '/admin/projects', 'New project')) : go('/admin/projects?ok=1'); }
  let m = /^\/admin\/projects\/(\d+)(?:\/(toggle|delete))?$/.exec(p);
  if (m) {
    const id = Number(m[1]), row = db.prepare('SELECT * FROM projects WHERE id=?').get(id);
    if (!row) return out(404, plain('Not found', 'That project does not exist.'));
    if (!m[2] && req.method === 'GET') return out(200, projForm({ ...row, technologies: JSON.parse(row.technologies).join(', ') }, {}, s, p, 'Edit project'));
    if (req.method === 'POST') {
      if (!m[2]) { const r = save(id, f); return r ? out(422, projForm(r.v, r.e, s, p, 'Edit project')) : go('/admin/projects?ok=1'); }
      if (m[2] === 'toggle') { db.prepare('UPDATE projects SET is_public=1-is_public,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id); log(db, uid, row.is_public ? 'project_unpublish' : 'project_publish', row.slug); }
      else { db.prepare('DELETE FROM projects WHERE id=?').run(id); log(db, uid, 'project_delete', row.slug); }
      return go('/admin/projects?ok=1');
    }
  }
  if (p === '/admin/messages' && req.method === 'GET') return out(200, messagesPage(db, url, s));
  m = /^\/admin\/messages\/(\d+)\/(status|delete)$/.exec(p);
  if (m && req.method === 'POST') {
    const id = Number(m[1]);
    if (m[2] === 'status') { if (!['new', 'read', 'archived'].includes(f.status)) return out(422, plain('Invalid status', 'Choose new, read or archived.')); db.prepare('UPDATE contact_messages SET status=? WHERE id=?').run(f.status, id); log(db, uid, 'message_status', `${id}:${f.status}`); }
    else { db.prepare('DELETE FROM contact_messages WHERE id=?').run(id); log(db, uid, 'message_delete', id); }
    return go('/admin/messages?ok=1');
  }
  if (p === '/admin/content') {
    const cur = { ...DEF, ...loadSettings(db) }, e = {};
    const form = (vals, errs, okk) => shell('Site content', fm('/admin/content', s.csrf, `<p class="small">Leave a field empty to restore its default text. Changes appear on the public site immediately.</p>${EDITABLE.map(([k, l, max]) => F(k, l, vals, errs, { area: max > 200 ? 4 : 0 })).join('')}<button class="btn">Save changes</button>`, 'class="form wide" data-dirty'), s, okk);
    if (req.method === 'GET') return out(200, form(cur, {}, ok));
    const vals = {};
    for (const [k, l, max] of EDITABLE) {
      const v = String(f[k] ?? '').trim(); vals[k] = v;
      if (v.length > max) e[k] = `Keep this under ${max} characters.`;
      else if (k === 'contactEmail' && v && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) e[k] = 'Enter a valid email address.';
      else if (k === 'contactPhone' && v && !/^\+[0-9]{8,15}$/.test(v)) e[k] = 'Use international format, e.g. +970123456789.';
    }
    if (Object.keys(e).length) return out(422, form(vals, e));
    db.exec('BEGIN');
    try {
      for (const [k] of EDITABLE) { if (!vals[k] || vals[k] === DEF[k]) db.prepare('DELETE FROM site_settings WHERE key=?').run(k); else db.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').run(k, vals[k]); }
      log(db, uid, 'content_update'); db.exec('COMMIT');
    } catch (x) { db.exec('ROLLBACK'); throw x; }
    return go('/admin/content?ok=1');
  }
  if (p === '/admin/password') {
    const form = (err = '') => { const fields = `<p><label for="current">Current password</label><input id="current" type="password" name="current" autocomplete="current-password" required></p><p><label for="next">New password (minimum 12 characters)</label><input id="next" type="password" name="next" autocomplete="new-password" minlength="12" maxlength="200" required></p><p><label for="confirm">Confirm new password</label><input id="confirm" type="password" name="confirm" autocomplete="new-password" minlength="12" maxlength="200" required></p><button class="btn">Update password</button>`; return shell('Change password', `${err ? `<p role="alert" class="err">${esc(err)}</p>` : ''}${fm('/admin/password', s.csrf, fields, 'class="form wide"')}`, s, ok); };
    if (req.method === 'GET') return out(200, form());
    const user = db.prepare('SELECT * FROM admin_users WHERE id=?').get(uid);
    const current = String(f.current || ''), next = String(f.next || ''), confirm = String(f.confirm || '');
    if (!verifyPassword(current, user.password_hash)) return out(422, form('Current password is incorrect.'));
    if (next.length < 12 || next.length > 200) return out(422, form('New password must be 12–200 characters.'));
    if (next !== confirm) return out(422, form('The new passwords do not match.'));
    if (next === current) return out(422, form('Choose a different password.'));
    db.prepare('UPDATE admin_users SET password_hash=? WHERE id=?').run(hashPassword(next), uid);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND id_hash<>?').run(uid, s.hash);
    log(db, uid, 'password_change');
    return go('/admin/password?ok=1');
  }
  if (p === '/admin/media') {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'data/uploads');
    const publicName = (n) => `/uploads/${n}`;
    const files = (() => { try { return readdirSync(uploadDir).filter((n) => /^[a-f0-9-]+\.(png|jpg|jpeg|webp)$/.test(n) && statSync(path.join(uploadDir, n)).isFile()).sort().reverse(); } catch { return []; } })();
    if (req.method === 'GET') return out(200, shell('Media library', `<p>Upload PNG, JPEG, or WebP images up to 2 MB. Images are stored outside the source code and are never executed.</p>${url.searchParams.get('uploaded') ? `<p role="status" class="ok">Uploaded. Image URL: <code>${esc(url.searchParams.get('uploaded'))}</code></p>` : ''}${fm('/admin/media', s.csrf, `<p><label for="image">Choose image</label><input id="image" type="file" accept="image/png,image/jpeg,image/webp" required><input type="hidden" name="image_data" id="image_data"><input type="hidden" name="image_type" id="image_type"></p><p class="small" id="image_status">Choose a supported image to prepare it for upload.</p><button class="btn" type="submit">Upload image</button>`, 'class="form wide" id="media-upload"')}<h2>Uploaded images</h2><div class="grid">${files.map((n) => `<article class="card"><img src="${publicName(n)}" alt="Uploaded media" loading="lazy" class="media-thumb"><p><code>${publicName(n)}</code></p><button class="btn sm ghost" type="button" data-copy="${publicName(n)}">Copy image URL</button></article>`).join('') || '<p>No uploaded images yet.</p>'}</div>`, s, ok));
    if (!f.image_data || !f.image_type) return out(422, plain('Invalid upload', 'Choose an image and try again.'));
    if (String(f.image_data).length > 2800000) return out(413, plain('Image too large', 'Maximum image size is 2 MB.'));
    const allowed = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }, ext = allowed[f.image_type];
    if (!ext) return out(415, plain('Unsupported image', 'Only PNG, JPEG, and WebP are supported.'));
    let buf; try { buf = Buffer.from(f.image_data, 'base64'); } catch { return out(422, plain('Invalid upload', 'The image data could not be read.')); }
    if (!buf.length || buf.length > 2097152 || buf.toString('base64').replace(/=+$/, '') !== String(f.image_data).replace(/=+$/, '')) return out(422, plain('Invalid upload', 'The image data is invalid or too large.'));
    let valid = false, w = 0, h = 0;
    if (ext === 'png' && buf.length > 24 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { valid = true; w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    if (ext === 'jpg' && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[buf.length-2] === 0xff && buf[buf.length-1] === 0xd9) {
      valid = true; let i = 2; while (i + 9 < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const marker = buf[i+1], len = buf.readUInt16BE(i+2); if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && i+9 < buf.length) { h = buf.readUInt16BE(i+5); w = buf.readUInt16BE(i+7); break; } if (len < 2) break; i += 2 + len; }
    }
    if (ext === 'webp' && buf.length > 30 && buf.toString('ascii',0,4)==='RIFF' && buf.toString('ascii',8,12)==='WEBP') { valid = true; if (buf.toString('ascii',12,16)==='VP8X') { w = 1 + buf.readUIntLE(24,3); h = 1 + buf.readUIntLE(27,3); } }
    if (!valid || !w || !h || w > 6000 || h > 6000 || w*h > 20000000) return out(422, plain('Invalid image', 'The file is not a supported image or its dimensions are too large.'));
    mkdirSync(uploadDir, { recursive: true, mode: 0o750 });
    const name = `${crypto.randomUUID()}.${ext}`; writeFileSync(path.join(uploadDir, name), buf, { flag: 'wx', mode: 0o640 });
    log(db, uid, 'media_upload', name);
    return go(`/admin/media?uploaded=${encodeURIComponent(publicName(name))}`);
  }
  if (p === '/admin/services' && req.method === 'GET') {
    const stored = loadSettings(db);
    return out(200, shell('Services', `<p>Edit the descriptions and deliverables shown on the public Services pages.</p><div class="tw"><table><thead><tr><th>Service</th><th>Summary</th><th></th></tr></thead><tbody>${serviceList.map((sv) => { let v = {}; try { v = JSON.parse(stored[`service:${sv.slug}`] || '{}'); } catch {} return tr([esc(v.title || sv.title), esc(v.summary || sv.summary), `<a href="/admin/services/${esc(sv.slug)}">Edit</a>`]); }).join('')}</tbody></table></div>`, s, ok));
  }
  m = /^\/admin\/services\/([a-z0-9-]+)$/.exec(p);
  if (m) {
    const slug = m[1], base = serviceList.find((x) => x.slug === slug);
    if (!base) return out(404, plain('Not found', 'That service does not exist.'));
    let stored = {}; try { stored = JSON.parse(loadSettings(db)[`service:${slug}`] || '{}'); } catch {}
    const initial = { title: stored.title ?? base.title, summary: stored.summary ?? base.summary, solves: (stored.solves ?? base.solves).join('\n'), deliverables: (stored.deliverables ?? base.deliverables).join('\n'), title_ar: stored.title_ar ?? '', summary_ar: stored.summary_ar ?? '', solves_ar: (stored.solves_ar ?? []).join('\n'), deliverables_ar: (stored.deliverables_ar ?? []).join('\n'), future: stored.future ?? Boolean(base.future) };
    const form = (v, err = '') => { const fields = `<h2>English content</h2>${F('title','Service title (English)',v,{})}${F('summary','Summary (English)',v,{},{area:3})}${F('solves','Problems this service solves (one per line)',v,{},{area:5})}${F('deliverables','Typical deliverables (one per line)',v,{},{area:5})}<h2>Arabic content (optional)</h2>${F('title_ar','Service title (Arabic)',v,{})}${F('summary_ar','Summary (Arabic)',v,{},{area:3})}${F('solves_ar','Problems this service solves in Arabic (one per line)',v,{},{area:5})}${F('deliverables_ar','Deliverables in Arabic (one per line)',v,{},{area:5})}<p><label class="chk"><input type="checkbox" name="future"${v.future?' checked':''}> Mark as future capability</label></p><button class="btn">Save service</button> <a href="/admin/services">Cancel</a>`; return shell(`Edit service: ${base.title}`, `${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}${fm(`/admin/services/${slug}`,s.csrf,fields,'class="form wide" data-dirty')}`,s,ok); };
    if (req.method === 'GET') return out(200, form(initial));
    const v = { title: String(f.title||'').trim(), summary: String(f.summary||'').trim(), solves: String(f.solves||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean), deliverables: String(f.deliverables||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean), title_ar: String(f.title_ar||'').trim(), summary_ar: String(f.summary_ar||'').trim(), solves_ar: String(f.solves_ar||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean), deliverables_ar: String(f.deliverables_ar||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean), future: f.future === 'on' };
    const error = v.title.length < 2 || v.title.length > 100 ? 'Title must be 2–100 characters.' : v.summary.length < 5 || v.summary.length > 300 ? 'Summary must be 5–300 characters.' : v.solves.length > 10 || v.solves.some(x=>x.length>180) ? 'Enter up to 10 problem statements, each under 180 characters.' : v.deliverables.length > 10 || v.deliverables.some(x=>x.length>180) ? 'Enter up to 10 deliverables, each under 180 characters.' : v.title_ar.length>100 || v.summary_ar.length>300 || v.solves_ar.length>10 || v.solves_ar.some(x=>x.length>180) || v.deliverables_ar.length>10 || v.deliverables_ar.some(x=>x.length>180) ? 'Arabic content exceeds the allowed length.' : ''; 
    if (error) return out(422,form({...v,solves:v.solves.join('\n'),deliverables:v.deliverables.join('\n'),solves_ar:v.solves_ar.join('\n'),deliverables_ar:v.deliverables_ar.join('\n')},error));
    db.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').run(`service:${slug}`,JSON.stringify(v)); log(db,uid,'service_update',slug); return go('/admin/services?ok=1');
  }
  if (p === '/admin/articles/new' && req.method === 'GET') return out(200, shell('New article', articleForm({title:'',title_ar:'',slug:'',summary:'',summary_ar:'',body:'',body_ar:'',is_public:0},s,'/admin/articles'), s));
  if (p === '/admin/articles') {
    if (req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC,id DESC').all();
      return out(200, shell('Articles', `<p><a class="btn sm" href="/admin/articles/new">New article</a></p><div class="tw"><table><thead><tr><th>Title</th><th>URL slug</th><th>Visibility</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows.map((r) => tr([esc(r.title), esc(r.slug), r.is_public ? 'Published' : 'Draft', esc(r.updated_at), `<a href="/admin/articles/${r.id}">Edit</a> ${fm(`/admin/articles/${r.id}/toggle`,s.csrf,`<button class="lnk">${r.is_public?'Unpublish':'Publish'}</button>`,'class="inl"')} ${fm(`/admin/articles/${r.id}/delete`,s.csrf,'<button class="lnk">Delete</button>','class="inl" data-confirm="Delete this article permanently?"')}`])).join('') || tr(['No articles yet.','','','',''])}</tbody></table></div><p class="small">Published articles appear on the public Journal page. Drafts are visible only in this dashboard.</p>`, s, ok));
    }
    if (req.method === 'POST' && p === '/admin/articles') {
      const title = String(f.title||'').trim(), titleAr = String(f.title_ar||'').trim(), slug = String(f.slug||'').trim().toLowerCase(), summary = String(f.summary||'').trim(), summaryAr = String(f.summary_ar||'').trim(), body = String(f.body||'').trim(), bodyAr = String(f.body_ar||'').trim(), pub = f.is_public === 'on' ? 1 : 0;
      const errors = []; if (title.length < 2 || title.length > 140) errors.push('Title must be 2–140 characters.'); if (!slugRe.test(slug) || slug.length < 3 || slug.length > 80) errors.push('Slug must use lowercase letters, numbers, and hyphens.'); if (summary.length < 5 || summary.length > 300) errors.push('Summary must be 5–300 characters.'); if (body.length < 20 || body.length > 15000) errors.push('Body must be 20–15000 characters.');
      if (titleAr.length > 140 || summaryAr.length > 300 || bodyAr.length > 15000) errors.push('Arabic title, summary, or body exceeds the allowed length.');
      if (errors.length) return out(422, shell('New article', `${errors.map((e)=>`<p class="err">${esc(e)}</p>`).join('')}${articleForm(f,s,'/admin/articles')}`, s));
      try { db.prepare('INSERT INTO articles(slug,title,summary,body,is_public,title_ar,summary_ar,body_ar) VALUES(?,?,?,?,?,?,?,?)').run(slug,title,summary,body,pub,titleAr,summaryAr,bodyAr); log(db,uid,'article_create',slug); } catch (e) { if (/UNIQUE/.test(e.message)) return out(422,shell('New article',`<p class="err">That slug is already in use.</p>${articleForm(f,s,'/admin/articles')}`,s)); throw e; }
      return go('/admin/articles?ok=1');
    }
  }
  m = /^\/admin\/articles\/(\d+)(?:\/(toggle|delete|preview))?$/.exec(p);
  if (m) {
    const id = Number(m[1]), row = db.prepare('SELECT * FROM articles WHERE id=?').get(id); if (!row) return out(404,plain('Not found','That article does not exist.'));
    if (m[2] === 'preview' && req.method === 'GET') return out(200,journalArticle(row),{ 'X-Robots-Tag': 'noindex, nofollow' });
    if (!m[2] && req.method === 'GET') return out(200,shell('Edit article',`${articleForm(row,s,p)}<p><a href="/admin/articles/${id}/preview" target="_blank" rel="noopener noreferrer">Preview this article</a></p>`,s));
    if (req.method === 'POST') {
      if (m[2] === 'preview') return out(405,plain('Preview is read-only','Use the preview link with GET.'),{ Allow: 'GET' });
      if (m[2] === 'toggle') db.prepare('UPDATE articles SET is_public=1-is_public,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
      else if (m[2] === 'delete') db.prepare('DELETE FROM articles WHERE id=?').run(id);
      else { const title=String(f.title||'').trim(),titleAr=String(f.title_ar||'').trim(),slug=String(f.slug||'').trim().toLowerCase(),summary=String(f.summary||'').trim(),summaryAr=String(f.summary_ar||'').trim(),body=String(f.body||'').trim(),bodyAr=String(f.body_ar||'').trim(),pub=f.is_public==='on'?1:0; const errs=[]; if(title.length<2||title.length>140)errs.push('Title must be 2–140 characters.'); if(!slugRe.test(slug)||slug.length<3||slug.length>80)errs.push('Slug must use lowercase letters, numbers, and hyphens.'); if(summary.length<5||summary.length>300)errs.push('Summary must be 5–300 characters.'); if(body.length<20||body.length>15000)errs.push('Body must be 20–15000 characters.'); if(titleAr.length>140||summaryAr.length>300||bodyAr.length>15000)errs.push('Arabic title, summary, or body exceeds the allowed length.'); if(errs.length)return out(422,shell('Edit article',`${errs.map(e=>`<p class="err">${esc(e)}</p>`).join('')}${articleForm(f,s,p)}`,s)); try{db.prepare('UPDATE articles SET slug=?,title=?,summary=?,body=?,is_public=?,title_ar=?,summary_ar=?,body_ar=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(slug,title,summary,body,pub,titleAr,summaryAr,bodyAr,id);}catch(e){if(/UNIQUE/.test(e.message))return out(422,shell('Edit article',`<p class="err">That slug is already in use.</p>${articleForm(f,s,p)}`,s));throw e;} }
      log(db,uid,m[2]==='toggle'?(row.is_public?'article_unpublish':'article_publish'):m[2]==='delete'?'article_delete':'article_update',row.slug); return go('/admin/articles?ok=1');
    }
  }
  if (p === '/admin/activity' && req.method === 'GET') {
    const rows = db.prepare('SELECT a.*,u.username FROM activity_log a LEFT JOIN admin_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100').all();
    return out(200, shell('Activity', `<div class="tw"><table><thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows.map((r) => tr([esc(r.created_at), esc(r.username || '-'), esc(r.action), esc(r.detail)])).join('')}</tbody></table></div>`, s));
  }
  return out(404, plain('Not found', 'That admin page does not exist.'));
}
