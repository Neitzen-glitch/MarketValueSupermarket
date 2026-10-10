import 'server-only';
import { db } from './supabase/service';
import { sendEmailBatch } from './email';
import { sendSms } from './sms';
import { digestEmail } from './emailTemplates';
import { availableOf } from './catalog';
import { SITE_NAME, siteUrl } from './site';

type Item = { name: string; from: number; url: string };

// SMS uses a plain "N" instead of the naira sign: that sign would force the costlier Unicode SMS format.
const smsMoney = (kobo: number) => 'N' + Math.round(kobo / 100).toLocaleString('en-NG');

function smsText(items: Item[], token: string) {
  const top = items.slice(0, 2).map((i) => `${i.name} ${smsMoney(i.from)}`).join(', ');
  const more = items.length > 2 ? ` +${items.length - 2} more` : '';
  return `${SITE_NAME}: fresh stock! ${top}${more}. Order: ${siteUrl()} Stop: ${siteUrl()}/unsubscribe/${token}`;
}

async function allSubscribers() {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from('subscribers')
      .select('id, email, phone, email_consent, sms_consent, unsubscribe_token')
      .is('unsubscribed_at', null)
      .range(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Sends ONE combined "fresh stock" message to everyone subscribed (email and/or SMS).
// Normal runs wait until her last stock change is DIGEST_QUIET_MINUTES old, so adding several
// products in a row produces one message. force = send right now (admin "Send now" button).
export async function sendPendingDigest(opts: { force?: boolean } = {}) {
  const d = db();
  if (!opts.force) {
    const { data: latest } = await d.from('stock_events').select('created_at').is('notified_at', null).order('created_at', { ascending: false }).limit(1);
    if (!latest?.length) return { sent: false, reason: 'nothing pending' };
    const quietMs = Number(process.env.DIGEST_QUIET_MINUTES ?? 10) * 60_000;
    if (Date.now() - new Date(latest[0].created_at).getTime() < quietMs) return { sent: false, reason: 'waiting for a quiet period' };
  }

  // Claim all pending events atomically so two overlapping runs cannot double-send.
  const { data: events } = await d.from('stock_events').update({ notified_at: new Date().toISOString() }).is('notified_at', null).select('product_id');
  if (!events?.length) return { sent: false, reason: 'nothing pending' };

  const productIds = [...new Set(events.map((e: any) => e.product_id))];
  const { data: products } = await d.from('products').select('id, name, slug, variants(id, price, stock, reserved)').in('id', productIds).eq('status', 'published');
  const items: Item[] = [];
  for (const p of products ?? []) {
    const live = (p.variants ?? []).filter((v: any) => availableOf(v) > 0);
    if (live.length) items.push({ name: p.name, from: Math.min(...live.map((v: any) => v.price)), url: `${siteUrl()}/products/${p.slug}` });
  }
  if (!items.length) return { sent: false, reason: 'nothing in stock to announce' };

  const subs = await allSubscribers();
  const log: any[] = [];

  const emailSubs = subs.filter((s) => s.email && s.email_consent);
  const emailResults = await sendEmailBatch(
    emailSubs.map((s) => {
      const m = digestEmail(items, `${siteUrl()}/unsubscribe/${s.unsubscribe_token}`);
      return { to: s.email, subject: m.subject, html: m.html };
    }),
  );
  emailSubs.forEach((s, i) => log.push({ subscriber_id: s.id, channel: 'email', status: emailResults[i] ? 'sent' : 'failed' }));

  const smsSubs = subs.filter((s) => s.phone && s.sms_consent);
  for (let i = 0; i < smsSubs.length; i += 10) {
    const batch = smsSubs.slice(i, i + 10);
    const results = await Promise.all(batch.map((s) => sendSms(s.phone, smsText(items, s.unsubscribe_token))));
    batch.forEach((s, j) => log.push({ subscriber_id: s.id, channel: 'sms', status: results[j].ok ? 'sent' : 'failed', provider_id: results[j].id ?? null, error: results[j].error ?? null }));
  }

  for (let i = 0; i < log.length; i += 500) await d.from('notification_log').insert(log.slice(i, i + 500));

  return {
    sent: true,
    products: items.length,
    emails: emailResults.filter(Boolean).length,
    sms: log.filter((l) => l.channel === 'sms' && l.status === 'sent').length,
  };
}
