export function validateContact(f) {
  const t = (k) => String(f[k] ?? '').trim().slice(0, 6000);
  const values = { name: t('name'), email: t('email'), subject: t('subject'), message: t('message') };
  const errors = {};
  if (values.name.length < 2 || values.name.length > 100) errors.name = 'Enter your name (2–100 characters).';
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Enter a valid email address.';
  if (values.subject.length < 3 || values.subject.length > 120) errors.subject = 'Enter a subject (3–120 characters).';
  if (values.message.length < 10 || values.message.length > 5000) errors.message = 'Write a message of 10–5000 characters.';
  if (f.consent !== 'on') errors.consent = 'Confirm that we may store your message to reply.';
  return { values, errors };
}
export const safeUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : null; } catch { return null; } };
