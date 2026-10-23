import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const MIGRATIONS = [`
CREATE TABLE contact_messages(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN('new','read','archived')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_contact_created ON contact_messages(created_at);
CREATE TABLE projects(id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL, technologies TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL CHECK(status IN('demonstration','personal','client')),
  is_public INTEGER NOT NULL DEFAULT 1, demo_url TEXT, repo_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`,
"ALTER TABLE contact_messages ADD COLUMN notification TEXT NOT NULL DEFAULT 'pending'; CREATE INDEX idx_projects_cat ON projects(category, is_public)",
`CREATE TABLE admin_users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE site_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE activity_log(id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_contact_status ON contact_messages(status, created_at);`,
`ALTER TABLE projects ADD COLUMN image_url TEXT;
CREATE TABLE articles(id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, is_public INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_articles_public ON articles(is_public, updated_at);`,
`ALTER TABLE projects ADD COLUMN title_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN summary_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN description_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN category_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN title_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN summary_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN body_ar TEXT NOT NULL DEFAULT '';`,
`INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('the-engineer-website','THE ENGINEER website','This website, built as a demonstration of the stack and process.','A demonstration project, not client work. It shows server-rendered pages, a validated contact form, and persistent storage with migrations.','Web development','["Node.js","SQLite"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('aether-ai','AETHER AI — Knowledge Platform','An intelligent knowledge management platform that extracts, indexes, and retrieves information using natural language queries.','AETHER AI demonstrates a vector-search-powered knowledge base built entirely with Node.js and SQLite. It ingests documents, extracts key concepts using natural language processing, stores embeddings for semantic search, and provides a conversational query interface. The system handles document versioning, citation tracking, and multi-user access control. This demonstration showcases practical AI integration without external APIs, using open algorithms and local inference.','Artificial Intelligence','["Node.js","SQLite","Vector Search","NLP"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('sentinel-security','SENTINEL — Security Dashboard','A real-time security monitoring dashboard with threat detection, access control auditing, and incident response workflows.','SENTINEL is a security operations dashboard that aggregates logs, monitors authentication attempts, detects anomalies, and provides incident response workflows. Built with zero external dependencies, it implements rate limiting, CSRF protection, session integrity checks, and audit logging. The dashboard visualizes failed login patterns, tracks privilege escalation attempts, and generates security reports. This demonstration shows security-conscious design patterns applicable to any application.','Cybersecurity','["Node.js","SQLite","OWASP","JWT"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('nexus-cloud','NEXUS — Cloud Infrastructure Platform','A cloud-native infrastructure platform with automated provisioning, health monitoring, and zero-downtime deployment pipelines.','NEXUS demonstrates infrastructure orchestration and deployment automation using Node.js as the control plane. It manages containerized services, performs health checks, implements blue-green deployments, and handles rollback scenarios. The platform includes resource monitoring, cost tracking, and automated scaling triggers. Built to show modern DevOps practices without vendor lock-in, using portable patterns that work across cloud providers.','Cloud & DevOps','["Node.js","Docker","Nginx","SQLite"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('orbit-data','ORBIT — Data Analytics Engine','A data pipeline and analytics engine that processes, transforms, and visualizes large datasets with configurable dashboards.','ORBIT is an end-to-end data platform that ingests CSV, JSON, and API sources, applies transformation rules, stores aggregated results, and serves analytics through a REST API and interactive dashboards. It handles incremental updates, data validation, and schema evolution. Visualizations are built with D3.js for custom charting without heavy frameworks. This demonstration shows data engineering fundamentals and performant aggregation queries in SQLite.','Data Engineering','["Node.js","SQLite","D3.js","CSV"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('pulse-automation','PULSE — Workflow Automation Platform','An event-driven automation platform that orchestrates multi-step business workflows, integrations, and scheduled processes.','PULSE automates repetitive business processes using triggers (webhooks, schedules, file watches), actions (API calls, database updates, file generation), and conditional logic. It provides a workflow designer, execution history, error recovery, and retry policies. The platform integrates with external services via REST APIs and includes a notification system for failures. This demonstration shows event-driven architecture and reliable background processing patterns.','Automation','["Node.js","SQLite","Webhooks","Cron"]','demonstration',1);
INSERT OR IGNORE INTO projects(slug,title,summary,description,category,technologies,status,is_public) VALUES('atlas-digital','ATLAS — Digital Experience Platform','A high-performance digital experience platform with server-rendered pages, progressive enhancement, and full accessibility compliance.','ATLAS is this website — a zero-dependency, server-rendered platform demonstrating performance-first architecture, security-conscious design, and WCAG 2.1 AA accessibility compliance. It includes bilingual support with RTL layout, an admin dashboard with role-based access, contact form with validation and rate limiting, and media management. Built with Node.js 22+ and SQLite, it shows that modern web applications can be fast, secure, and maintainable without complex build chains or heavy dependencies.','Web Development','["Node.js","SQLite","CSS","Web APIs"]','demonstration',1);`];
export function openDb(file = process.env.DATABASE_FILE || 'data/app.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY)');
  const done = db.prepare('SELECT COALESCE(MAX(version),0) v FROM schema_migrations').get().v;
  MIGRATIONS.slice(done).forEach((sql, i) => {
    db.exec('BEGIN');
    try { db.exec(sql); db.prepare('INSERT INTO schema_migrations VALUES(?)').run(done + i + 1); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  });
  if (!db.prepare('SELECT 1 FROM projects LIMIT 1').get()) {
    db.prepare('INSERT INTO projects(slug,title,summary,description,category,technologies,status) VALUES(?,?,?,?,?,?,?)').run(
      'the-engineer-website', 'THE ENGINEER website', 'This website, built as a demonstration of the stack and process.',
      'A demonstration project, not client work. It shows server-rendered pages, a validated contact form, and persistent storage with migrations.', 'Web development', '["Node.js","SQLite"]', 'demonstration');
  }
  return db;
}
export const addMessage = (db, m) => db.prepare('INSERT INTO contact_messages(name,email,subject,message) VALUES(?,?,?,?)').run(m.name, m.email, m.subject, m.message);
export const listProjects = (db) => db.prepare('SELECT * FROM projects WHERE is_public=1 ORDER BY created_at DESC').all();
export const getProject = (db, slug) => db.prepare('SELECT * FROM projects WHERE slug=? AND is_public=1').get(slug);
export const setNotification = (db, id, n) => db.prepare('UPDATE contact_messages SET notification=? WHERE id=?').run(n, id);
export const loadSettings = (db) => Object.fromEntries(db.prepare('SELECT key,value FROM site_settings').all().map((r) => [r.key, r.value]));
export const ping = (db) => db.prepare('SELECT 1 ok').get().ok === 1;
