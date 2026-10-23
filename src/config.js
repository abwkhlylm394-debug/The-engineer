// Editable content. Nothing here is verified client work; edit before launch.
export const site = {
  brand: 'THE ENGINEER',
  baseUrl: process.env.SITE_URL || 'http://localhost:3000',
  tagline: 'Thoughtfully engineered software, digital platforms, and intelligent solutions designed to solve real problems.',
  founder: {
    name: 'Mohammed',
    title: 'Software Engineering Student & Developer',
    bio: 'Mohammed started learning technology before university and is now studying software engineering. His focus is reliable digital products, modern web applications, artificial intelligence, and security-conscious development.',
    education: 'Software engineering student. Edit this line with verified details.',
  },
  mission: 'Build dependable software that solves real problems, with clear communication throughout.',
  vision: 'An engineering practice known for careful design and maintainable, security-conscious work.',
  aboutIntro: 'THE ENGINEER is an emerging software engineering brand. It has no claimed operating history; the founder’s learning, studies, personal projects, and any client work are kept distinct.',
  processIntro: 'A clear, deliberate process helps keep the scope, quality, and expectations aligned.',
  principlesCustom: [], faqCustom: [], lifecycleCustom: [],
  nav: [['/', 'Home'], ['/about', 'About'], ['/services', 'Expertise'], ['/projects', 'Projects'], ['/journal', 'Insights'], ['/process', 'Process'], ['/contact', 'Contact']],
};
const DEFAULT_SERVICES = [
  { slug: 'software-engineering', title: 'Software engineering', summary: 'Custom software and business systems built around your workflow.', solves: ['Manual processes that need automation', 'Tools that no longer fit the business'], deliverables: ['Requirements and scope', 'Working software', 'Documentation'] },
  { slug: 'web-development', title: 'Web development', summary: 'Websites and web platforms that are fast, accessible, and maintainable.', solves: ['An outdated or slow website', 'A product that needs a web presence'], deliverables: ['Responsive site or platform', 'Content structure', 'Deployment notes'] },
  { slug: 'application-development', title: 'Application development', summary: 'Applications designed for the people who will use them every day.', solves: ['An idea that needs a first working version', 'Internal tools for a small team'], deliverables: ['Prototype or MVP', 'Tested release', 'Handover guide'] },
  { slug: 'artificial-intelligence', title: 'Artificial intelligence', summary: 'Practical AI features added to real products.', future: true, solves: ['Repetitive text or data tasks', 'Search and classification features'], deliverables: ['Feasibility assessment', 'Integration plan'] },
  { slug: 'secure-development', title: 'Secure development', summary: 'Security considered from design through delivery.', solves: ['Unreviewed input handling and access control', 'Unclear security responsibilities'], deliverables: ['Threat-aware design', 'Input validation and access rules', 'Known-risk notes'] },
  { slug: 'system-architecture', title: 'System architecture', summary: 'Technical design that keeps systems understandable as they grow.', solves: ['Unclear system boundaries', 'Hard-to-change codebases'], deliverables: ['Architecture overview', 'Data model', 'Technical decisions record'] },
  { slug: 'data-engineering', title: 'Data engineering & analytics', summary: 'Design and build data pipelines, warehouses, and analytics systems that turn raw data into actionable insight.', solves: ['Scattered data across multiple systems', 'Inability to answer business questions quickly', 'Manual data exports and spreadsheet chaos'], deliverables: ['Data model and pipeline design', 'Automated ETL workflows', 'Analytics dashboards or API'] },
  { slug: 'automation-workflows', title: 'Automation & intelligent workflows', summary: 'Eliminate repetitive manual work by designing automated pipelines, scheduled tasks, and event-driven systems.', solves: ['Hours lost to repetitive data entry', 'Manual file processing and report generation', 'Coordination across disconnected tools'], deliverables: ['Workflow design and triggers', 'Automated scripts or integrations', 'Monitoring and error handling'] },
  { slug: 'api-integration', title: 'API engineering & system integration', summary: 'Design and implement robust APIs and integration layers that connect disparate systems reliably.', solves: ['Systems that cannot talk to each other', 'Fragile manual data syncing', 'No programmatic access to your platform'], deliverables: ['API design and documentation', 'Integration architecture', 'Authentication and rate limiting'] },
  { slug: 'cloud-devops', title: 'Cloud infrastructure & DevOps', summary: 'Architect and manage cloud infrastructure, CI/CD pipelines, and deployment automation for reliable delivery.', solves: ['Manual deployments that fail unpredictably', 'Expensive or underutilized cloud resources', 'No rollback plan when releases break'], deliverables: ['Infrastructure as code', 'CI/CD pipeline setup', 'Deployment runbooks'] },
  { slug: 'ux-design', title: 'UI/UX design & accessibility', summary: 'Design interfaces that are intuitive, accessible (WCAG 2.1 AA), and aligned with real user needs.', solves: ['Confusing navigation and unclear actions', 'Inaccessible interfaces for users with disabilities', 'High drop-off rates in key workflows'], deliverables: ['User research and personas', 'Wireframes and interactive prototypes', 'Accessibility audit and remediation'] },
  { slug: 'technical-consulting', title: 'Technical consulting & digital transformation', summary: 'Strategic technical guidance to navigate complexity, evaluate technology choices, and plan transformations.', solves: ['Unclear technical roadmap', 'Competing vendor pitches with no neutral guidance', 'Legacy systems blocking growth'], deliverables: ['Technology assessment', 'Strategic roadmap', 'Risk and feasibility analysis'] },
];
export const services = DEFAULT_SERVICES.map((s) => ({ ...s, solves: [...s.solves], deliverables: [...s.deliverables] }));
export function applyServiceSettings(m = {}) {
  for (let i = 0; i < services.length; i++) {
    const d = DEFAULT_SERVICES[i];
    Object.assign(services[i], { ...d, solves: [...d.solves], deliverables: [...d.deliverables] });
    try { const x = JSON.parse(m[`service:${d.slug}`] || '{}'); if (x && typeof x === 'object') Object.assign(services[i], { title: String(x.title ?? d.title), summary: String(x.summary ?? d.summary), solves: Array.isArray(x.solves) ? x.solves.map(String) : [...d.solves], deliverables: Array.isArray(x.deliverables) ? x.deliverables.map(String) : [...d.deliverables], title_ar: String(x.title_ar || ''), summary_ar: String(x.summary_ar || ''), solves_ar: Array.isArray(x.solves_ar) ? x.solves_ar.map(String) : [], deliverables_ar: Array.isArray(x.deliverables_ar) ? x.deliverables_ar.map(String) : [], future: Boolean(x.future) }); } catch {}
  }
}

export const principles = ['Clear problem analysis', 'Thoughtful technical design', 'Maintainable architecture', 'Security-conscious implementation', 'Quality-focused testing', 'Transparent communication'];
export const lifecycle = [
  ['Discover', 'Understand the problem, requirements, constraints, and goals.'],
  ['Define', 'Clarify scope, success criteria, and acceptance conditions.'],
  ['Architect', 'Design the solution, system boundaries, data model, and technical approach.'],
  ['Engineer', 'Implement the product with clean code, meaningful tests, and version control.'],
  ['Integrate', 'Connect components, third-party services, and data sources reliably.'],
  ['Validate', 'Verify functionality, security controls, accessibility, and performance.'],
  ['Secure', 'Harden against identified threats, review permissions, and audit inputs.'],
  ['Deploy', 'Release responsibly with rollback plans, monitoring, and documentation.'],
  ['Evolve', 'Maintain, monitor, and improve based on real-world usage and feedback.'],
];
export const faq = [
  ['What can you build?', 'Websites, web applications, business systems, and application prototypes. AI work is a developing capability and is scoped case by case.'],
  ['Do you have past clients?', 'THE ENGINEER is an emerging brand. The projects listed are labeled by what they are.'],
  ['How do we start?', 'Send a message through the contact form describing the problem. You will get a reply to discuss scope.'],
  ['Is my message kept private?', 'It is stored on the server and used only to respond to you. See the privacy policy.'],
];

// Editable from the admin dashboard (stored in site_settings); empty override = default below.
export const DEF = {
  heroTitle: 'Engineering Tomorrow. Building What Matters.', tagline: site.tagline,
  intro: 'THE ENGINEER focuses on thoughtful design, maintainable implementation, security-conscious development, and practical digital solutions.',
  founderName: site.founder.name, founderTitle: site.founder.title, founderBio: site.founder.bio, founderEducation: site.founder.education, mission: site.mission, vision: site.vision,
  ctaTitle: "Let's Engineer What's Next.", ctaText: "Have a project, an idea, or a technical challenge? Let's explore a practical way to bring it to life.",
  contactEmail: 'abwkhlylm394@gmail.com', contactPhone: '+970567876514', // central public contact details
  aboutIntro: site.aboutIntro, processIntro: site.processIntro,
  principlesText: principles.join('\n'),
  processStepsText: lifecycle.map(([t,d]) => `${t} | ${d}`).join('\n'),
  faqText: faq.map(([q,a]) => `${q} | ${a}`).join('\n'),
};
site.principlesCustom = [...principles]; site.lifecycleCustom = lifecycle.map((x) => [...x]); site.faqCustom = faq.map((x) => [...x]);
export const EDITABLE = [['heroTitle', 'Homepage headline', 160], ['tagline', 'Homepage supporting text', 300], ['intro', 'Company introduction', 400], ['founderName', 'Founder name', 100], ['founderTitle', 'Founder title / role', 160], ['founderBio', 'Founder biography', 800], ['founderEducation', 'Founder education (verified details only)', 400], ['mission', 'Mission', 300], ['vision', 'Vision', 300], ['ctaTitle', 'Final call-to-action headline', 120], ['ctaText', 'Final call-to-action text', 300], ['contactEmail', 'Public contact email', 120], ['contactPhone', 'Public contact phone (international format, e.g. +970123456789)', 20], ['aboutIntro', 'About page introduction', 1000], ['processIntro', 'Process page introduction', 500], ['principlesText', 'Working principles (one per line)', 1600], ['processStepsText', 'Process steps (one per line: title | description)', 2400], ['faqText', 'FAQ entries (one per line: question | answer)', 3200]];
export function applySettings(m = {}) {
  const v = (k) => m[k] || DEF[k];
  Object.assign(site, { heroTitle: v('heroTitle'), tagline: v('tagline'), intro: v('intro'), mission: v('mission'), vision: v('vision'), ctaTitle: v('ctaTitle'), ctaText: v('ctaText'), contact: { email: v('contactEmail'), phone: v('contactPhone') } });
  site.founder.name = v('founderName'); site.founder.title = v('founderTitle'); site.founder.bio = v('founderBio'); site.founder.education = v('founderEducation');
  site.aboutIntro = v('aboutIntro'); site.processIntro = v('processIntro');
  site.principlesCustom = v('principlesText').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
  site.lifecycleCustom = v('processStepsText').split(/\r?\n/).map((x) => x.split('|').map((y) => y.trim())).filter((x) => x[0] && x[1]).slice(0, 8);
  site.faqCustom = v('faqText').split(/\r?\n/).map((x) => x.split('|').map((y) => y.trim())).filter((x) => x[0] && x[1]).slice(0, 12);
}
applySettings();
