'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/supabase/service';
import { normalizeNgPhone } from '@/lib/phone';

export async function subscribe(formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (formData.get('website')) return { ok: true, message: 'Thanks!' }; // honeypot tripped
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phoneRaw = String(formData.get('phone') ?? '').trim();

  if (!email && !phoneRaw) return { ok: false, message: 'Enter an email address, a phone number, or both.' };
  if (formData.get('consent') !== 'on') return { ok: false, message: 'Please tick the box to agree to receive updates.' };
  if (email && !z.string().email().safeParse(email).success) return { ok: false, message: 'That email address does not look right.' };
  const phone = phoneRaw ? normalizeNgPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, message: 'Enter a Nigerian number like 0803 123 4567.' };

  const d = db();
  const conds = [email && `email.eq."${email}"`, phone && `phone.eq."${phone}"`].filter(Boolean).join(',');
  const { data: existing } = await d.from('subscribers').select('id, email, phone').or(conds).limit(1);

  const fields = {
    ...(email ? { email, email_consent: true } : {}),
    ...(phone ? { phone, sms_consent: true } : {}),
    unsubscribed_at: null,
    consented_at: new Date().toISOString(),
  };
  const { error } = existing?.length
    ? await d.from('subscribers').update(fields).eq('id', existing[0].id)
    : await d.from('subscribers').insert(fields);
  // A unique clash (e.g. the phone already belongs to another row) still means "you are on the list".
  if (error && error.code !== '23505') {
    console.error('subscribe failed', error);
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
  return { ok: true, message: "You're on the list! We'll message you when fresh stock lands." };
}

export async function unsubscribe(token: string) {
  if (/^[a-f0-9]{32}$/.test(token)) {
    await db().from('subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('unsubscribe_token', token);
  }
  redirect(`/unsubscribe/${token}?done=1`);
}
