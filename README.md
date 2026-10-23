# THE ENGINEER

Zero-dependency Node 22 (>=22.5) site: server-rendered pages, SQLite (`node:sqlite`), private admin dashboard. This project is separate from any other project folder or archive.

## Install and run
    npm start                          # http://localhost:3000; creates data/app.db and applies migrations on boot
    npm test                           # 30 tests
    npm run create-admin -- <username> # prompts for a password (min 12 chars, hidden input); never put it on the command line
    npm run backup                     # consistent copy to backups/app-<time>.db (refuses to overwrite)

No build step and no npm dependencies, so there are no packages to audit. Update by upgrading Node and read the Node security releases.

## Language selection
The public site includes an English/Arabic switch that stores a language preference in an HttpOnly, SameSite cookie and sets Arabic pages to `lang=ar` and `dir=rtl`. Common interface labels and default site copy have Arabic translations. Content created or edited in the admin (project names, article text, and customized service descriptions) is not automatically translated; write the corresponding content in the language you want to display before treating the site as fully bilingual.

## Admin dashboard (`/admin`)
Log in, then manage projects (create, edit, publish/unpublish, delete, and assign uploaded images), services (edit summaries, problem statements, deliverables, and future-capability labels), journal articles (create, edit, publish/unpublish, delete), uploaded images, contact messages (search, filter, paginate, status, delete), site text, founder details, About/Process/FAQ content, public contact details, password changes, and the activity log. There is no public registration; administrators exist only if created with `create-admin` on the server. Sessions are server-side (8 h), cookie is HttpOnly + SameSite=Strict (+Secure when `NODE_ENV=production`), every POST requires a CSRF token and same-origin check, 8 failed logins per 15 min per IP/username locks login. Passwords use scrypt.

## Environment (`.env.example`)
`PORT`, `SITE_URL` (public https URL), `DATABASE_FILE` (keep outside web-served folders), `UPLOAD_DIR` (private disk directory for uploaded image originals), `NODE_ENV=production`, and optional `RESEND_API_KEY`, `MAIL_FROM` (verified sender), `NOTIFY_TO`. Load them with your process manager or `node --env-file=.env src/server.js`. Never commit `.env`.

## Email
Messages are always stored first. Notification goes through Resend only if all three variables are set; the outcome (sent / failed / off) is saved per message and shown in the admin. Gmail is not used as a server; delivery is unverified until you configure and test a provider.

## Contact details
Phone, email and WhatsApp link are defaults in `src/config.js` (`DEF`) and editable in Admin, Site content.

## Deployment
Run behind a reverse proxy (Caddy/nginx) terminating HTTPS, forward to the Node port, run with `NODE_ENV=production` under a supervisor (systemd) as an unprivileged user. The app's IP-based rate limit sees the proxy's address unless the proxy is configured otherwise (not yet handled). Migrations run automatically at startup; back up before upgrading.

## Media and content management
Uploaded images are stored under `UPLOAD_DIR` (default `data/uploads`) outside the source tree. The admin Media page validates allowed image types and size, generates non-user-controlled filenames, and lets you copy the resulting URL. Assign the URL to a project in the project editor. Back up the upload directory separately from the SQLite database. Articles are plain text with paragraphs separated by blank lines; HTML is escaped on output. Saved articles can be previewed from the admin editor before publication.

## Backup and recovery
Schedule `npm run backup`, copy the database backup and the `UPLOAD_DIR` contents off-host. Restore: stop the app, replace the database with a backup, restore the upload directory, start. Test restores periodically.

## Responsive and accessibility pass
The public site and admin dashboard use responsive CSS breakpoints for desktop/laptop, tablet, and narrow phone widths; forms and buttons have touch-friendly sizing, tables remain horizontally scrollable on small screens, and reduced-motion/high-contrast preferences are respected. Separate Arabic fields are available for project, article, and service content, with fallback to English when no Arabic translation is entered. The responsive stylesheet is covered by automated smoke assertions, but a full browser/device QA pass and Lighthouse audit are still required before production. Project images are restricted to locally uploaded media paths to match the Content Security Policy and avoid third-party image tracking.

## Remaining limitations
The admin dashboard itself remains English-only. Projects now support separate English and Arabic title, summary, description, and category fields; articles support separate English and Arabic title, summary, and body fields; services support separate English and Arabic title, summary, problem statements, and deliverables. If Arabic fields are left blank, the public site falls back to English. About/Process/FAQ and founder information are still shared fields rather than separate per-language fields, so a fully bilingual editorial experience for those areas still requires separate Arabic content fields. There is no multi-factor authentication or full-page draft preview. Email delivery requires real provider credentials and must be tested. No real production deployment, browser/Lighthouse run, accessibility audit, or independent penetration test has been performed; automated tests are not a guarantee against compromise.
