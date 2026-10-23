// Returns 'sent' only when the provider accepted the message; 'off' when unconfigured; 'failed' otherwise.
export async function defaultNotify(m) {
  const { RESEND_API_KEY: k, MAIL_FROM: from, NOTIFY_TO: to } = process.env;
  if (!k || !from || !to) return 'off';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ from, to: [to], reply_to: m.email, subject: `[Contact] ${m.subject.replace(/[\r\n]+/g, ' ')}`, text: `From: ${m.name} <${m.email}>\n\n${m.message}` }),
    });
    return r.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
