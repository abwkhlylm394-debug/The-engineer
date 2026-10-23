import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { defaultNotify } from './mail.js';
import { openDb, addMessage, setNotification, loadSettings, listProjects, getProject, ping } from './db.js';
import { services, site, applySettings, applyServiceSettings } from './config.js';
import { admin } from './admin.js';
import { validateContact } from './validate.js';
import * as v from './views.js';

const css = readFileSync(new URL('../public/styles.css', import.meta.url));
const js = readFileSync(new URL('../public/app.js', import.meta.url));
const SEC = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(process.env.NODE_ENV === 'production' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
};
const readBody = (req, max = 20000) => new Promise((ok, no) => {
  let n = 0; const c = [];
  req.on('data', (d) => { n += d.length; if (n <= max) c.push(d); });
  req.on('end', () => (n > max ? no(Object.assign(new Error('big'), { code: 413 })) : ok(Buffer.concat(c).toString())));
  req.on('error', no);
});

export function createApp(db = openDb(), { notify = defaultNotify } = {}) {
  const hits = new Map();
  const limited = (ip) => { const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < 6e5); a.push(now); hits.set(ip, a); if (hits.size > 2000) { for (const [key, times] of hits) { const live = times.filter((t) => now - t < 6e5); if (live.length) hits.set(key, live); else hits.delete(key); } } return a.length > 5; };
  return http.createServer(async (req, res) => {
    const send = (status, body, type = 'text/html; charset=utf-8', extra = {}) => { res.writeHead(status, { 'Content-Type': type, ...SEC, ...extra }); res.end(req.method === 'HEAD' ? undefined : body); };
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : '/';
      const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => { const i = part.indexOf('='); if (i < 0) return ['', '']; const key = part.slice(0, i).trim(), raw = part.slice(i + 1).trim(); let value = raw; try { value = decodeURIComponent(raw); } catch {} return [key, value]; }).filter(([k]) => k));
      const locale = cookies.lang === 'ar' ? 'ar' : 'en';
      if (p === '/language' && req.method === 'GET') {
        const chosen = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
        const target = url.searchParams.get('return') || '/';
        const safeTarget = target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') && !/[\r\n]/.test(target) ? target : '/';
        const cookie = `lang=${chosen}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        return send(303, '', 'text/plain; charset=utf-8', { Location: safeTarget, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
      }
      try { const settings = loadSettings(db); applySettings(settings); applyServiceSettings(settings); } catch { /* fall back to defaults */ }
      if (p.startsWith('/uploads/')) {
        const name = p.slice('/uploads/'.length);
        if (!/^[a-f0-9-]+\.(?:png|jpg|jpeg|webp)$/.test(name)) return send(404, 'Not found', 'text/plain');
        const file = path.resolve(process.env.UPLOAD_DIR || 'data/uploads', name);
        if (!existsSync(file)) return send(404, 'Not found', 'text/plain');
        const type = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        return send(200, readFileSync(file), type, { 'Cache-Control': 'public, max-age=604800, immutable', 'Content-Disposition': 'inline' });
      }
      if (p === '/admin' || p.startsWith('/admin/')) return await admin(req, p, url, db, { send, readBody });
      if (req.method === 'POST' && p === '/api/assistant') {
        // Rate limiting: 5 requests per 10 minutes
        if (limited(req.socket.remoteAddress)) {
          return send(429, JSON.stringify({ error: 'rate limit exceeded' }), 'application/json', { 'Retry-After': '600' });
        }
        // Parse JSON body
        let raw, body;
        try {
          raw = await readBody(req);
          body = JSON.parse(raw);
        } catch (e) {
          return send(400, JSON.stringify({ error: 'invalid JSON' }), 'application/json');
        }
        // Validate message field
        if (!body.message || typeof body.message !== 'string') {
          return send(400, JSON.stringify({ error: 'message required' }), 'application/json');
        }
        if (body.message.length > 2000) {
          return send(400, JSON.stringify({ error: 'message too long' }), 'application/json');
        }
        // Demo response logic based on keywords
        const msg = body.message.toLowerCase();
        let reply = '';
        if (msg.includes('service') || msg.includes('capabilit') || msg.includes('what do you do')) {
          reply = 'THE ENGINEER offers 12 core services spanning software engineering, web and application development, artificial intelligence, cybersecurity, cloud infrastructure, data engineering, automation, API integration, UX design, system architecture, and technical consulting. Each service focuses on solving real problems with maintainable, security-conscious solutions. Would you like details about a specific area?';
        } else if (msg.includes('project') || msg.includes('portfolio') || msg.includes('work')) {
          reply = 'Our projects page showcases 6 demonstration platforms: AETHER AI (knowledge management), SENTINEL (security dashboard), NEXUS (cloud infrastructure), ORBIT (data analytics), PULSE (workflow automation), and ATLAS (this website). Each demonstrates core engineering principles and is labeled transparently. Visit /projects to explore them.';
        } else if (msg.includes('process') || msg.includes('methodolog') || msg.includes('how do you work')) {
          reply = 'We follow a deliberate 9-phase process: Discover (understand the problem), Define (clarify requirements), Architect (design the solution), Engineer (implement with tests), Integrate (connect components), Validate (verify functionality and security), Secure (harden against threats), Deploy (release responsibly), and Evolve (maintain and improve). Each phase has clear deliverables and checkpoints.';
        } else if (msg.includes('contact') || msg.includes('hire') || msg.includes('start') || msg.includes('price') || msg.includes('cost')) {
          reply = 'To discuss a project, use the contact form at /contact or reach out directly via email (abwkhlylm394@gmail.com) or phone (+970567876514). Every engagement starts with understanding your problem and constraints. Pricing and scope are discussed case by case after the initial conversation.';
        } else if (msg.includes('about') || msg.includes('founder') || msg.includes('who') || msg.includes('mohammed')) {
          reply = 'THE ENGINEER is an emerging software engineering brand founded by Mohammed, a software engineering student focused on reliable digital products, modern web applications, AI, and security-conscious development. The brand has no claimed operating history; projects are transparently labeled as demonstration, personal, or client work.';
        } else if (msg.includes('technolog') || msg.includes('stack') || msg.includes('tool')) {
          reply = 'Our primary stack is Node.js, SQLite, vanilla JavaScript, and CSS — chosen for simplicity, performance, and zero external dependencies. We also work with Docker, Nginx, Git, and standard web APIs. For AI work, we use local inference and vector search. For cloud, we prefer portable patterns over vendor lock-in. The right tool depends on the problem.';
        } else {
          reply = "Hello! I'm the ENGINEER INTELLIGENCE assistant (demonstration mode). I can answer questions about our services, projects, methodology, pricing, founder, and technology stack. What would you like to know?";
        }
        return send(200, JSON.stringify({ reply, mode: 'demonstration' }), 'application/json');
      }
      if (req.method === 'POST' && p === '/contact') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return send(403, v.notice('Request blocked', 'Cross-origin form submissions are not accepted.', locale));
        if (limited(req.socket.remoteAddress)) return send(429, v.notice('Too many messages', 'Please wait a few minutes before sending another message.', locale), undefined, { 'Retry-After': '600' });
        let raw; try { raw = await readBody(req); } catch { return send(413, v.notice('Message too large', 'Please shorten your message.', locale)); }
        const f = Object.fromEntries(new URLSearchParams(raw));
        if (f.website) return send(400, v.notice('Request rejected', 'The submission could not be accepted.', locale));
        const { values, errors } = validateContact(f);
        if (Object.keys(errors).length) return send(422, v.contact({ values, errors }, locale));
        let id; try { id = addMessage(db, values).lastInsertRowid; } catch { console.error('contact_save_failed'); return send(503, v.contact({ values, failed: true }, locale)); }
        let n = 'failed'; try { n = await notify(values); } catch {}
        if (!['sent', 'off'].includes(n)) n = 'failed';
        try { setNotification(db, id, n); } catch { console.error('notification_status_failed'); }
        return send(303, '', 'text/plain', { Location: `/contact?sent=1&n=${n}` });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed', 'text/plain', { Allow: 'GET, HEAD, POST' });
      const s = p.startsWith('/services/') && services.find((x) => x.slug === p.slice(10));
      const pr = p.startsWith('/projects/') && getProject(db, p.slice(10));
      if (p === '/') return send(200, v.home(listProjects(db), locale));
      if (p === '/about') return send(200, v.about(locale));
      if (p === '/services') return send(200, v.servicesIndex(locale));
      if (s) return send(200, v.service(s, locale));
      if (p === '/projects') { const all = listProjects(db), c = url.searchParams.get('category'); const cat = (x) => locale === 'ar' ? (x.category_ar || x.category) : x.category; return send(200, v.projectsIndex(c ? all.filter((x) => cat(x) === c) : all, [...new Set(all.map(cat))], c, locale)); }
      if (p === '/journal') { const rows = db.prepare('SELECT * FROM articles WHERE is_public=1 ORDER BY updated_at DESC,id DESC').all(); return send(200, v.journalIndex(rows, locale)); }
      if (p.startsWith('/journal/')) { const a = db.prepare('SELECT * FROM articles WHERE slug=? AND is_public=1').get(p.slice('/journal/'.length)); if (a) return send(200, v.journalArticle(a, locale)); }
      if (pr) return send(200, v.project(pr, locale));
      if (p === '/process') return send(200, v.processPage(locale));
      if (p === '/contact') return send(200, v.contact({ sent: url.searchParams.get('sent') === '1', mail: url.searchParams.get('n') }, locale));
      if (p === '/privacy') return send(200, v.legal('Privacy', '/privacy', v.privacyBody, locale));
      if (p === '/terms') return send(200, v.legal('Terms', '/terms', v.termsBody, locale));
      if (p === '/styles.css') return send(200, css, 'text/css', { 'Cache-Control': 'public, max-age=3600' });
      if (p === '/favicon.svg') return send(200, v.favicon, 'image/svg+xml');
      if (p === '/logo.svg') return send(200, v.logoSvg, 'image/svg+xml');
      if (p === '/app.js') return send(200, js, 'text/javascript', { 'Cache-Control': 'public, max-age=3600' });
      if (p === '/robots.txt') return send(200, `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`, 'text/plain');
      if (p === '/health') { let ok = false; try { ok = ping(db); } catch {} return send(ok ? 200 : 503, JSON.stringify({ status: ok ? 'ok' : 'degraded' }), 'application/json'); }
      if (p === '/sitemap.xml') {
        const paths = ['/', '/about', '/services', '/projects', '/process', '/contact', '/privacy', '/terms', '/journal', ...db.prepare('SELECT slug FROM articles WHERE is_public=1').all().map((a) => `/journal/${a.slug}`), ...services.map((x) => `/services/${x.slug}`), ...listProjects(db).map((x) => `/projects/${x.slug}`)];
        return send(200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((x) => `<url><loc>${v.esc(site.baseUrl + x)}</loc></url>`).join('')}</urlset>`, 'application/xml');
      }
      return send(404, v.notice('Page not found', 'That page does not exist.', locale));
    } catch (e) { console.error('unhandled', e.message); return send(500, v.notice('Something went wrong', 'Please try again later.', 'en')); }
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`THE ENGINEER listening on :${port}`));
}
