import 'server-only';
import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM || 'Market Value Supermarket <onboarding@resend.dev>';
let resend: Resend | null = null;
function client() {
  if (!process.env.RESEND_API_KEY) return null;
  return (resend ??= new Resend(process.env.RESEND_API_KEY));
}

// Never throws. Returns true if the email was accepted (or printed in dev mode).
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const r = client();
  if (!r) {
    console.log(`[email dev mode] to ${to} | ${subject}`);
    return true;
  }
  try {
    const { error } = await r.emails.send({ from: FROM, to: [to], subject, html });
    if (error) console.error('Resend error', error);
    return !error;
  } catch (e) {
    console.error('Resend failed', e);
    return false;
  }
}

// Each recipient gets their own message (their own unsubscribe link). Resend takes 100 per call.
export async function sendEmailBatch(items: { to: string; subject: string; html: string }[]): Promise<boolean[]> {
  const r = client();
  if (!r) {
    items.forEach((i) => console.log(`[email dev mode] to ${i.to} | ${i.subject}`));
    return items.map(() => true);
  }
  const results: boolean[] = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    try {
      const { error } = await r.batch.send(chunk.map((c) => ({ from: FROM, to: [c.to], subject: c.subject, html: c.html })));
      if (error) console.error('Resend batch error', error);
      results.push(...chunk.map(() => !error));
    } catch (e) {
      console.error('Resend batch failed', e);
      results.push(...chunk.map(() => false));
    }
  }
  return results;
}
