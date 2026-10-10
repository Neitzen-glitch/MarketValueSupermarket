import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const BASE = 'https://api.paystack.co';
const headers = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' });

export async function initializeTransaction(p: {
  email: string;
  amount: number; // kobo
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: p.email,
      amount: p.amount,
      reference: p.reference,
      callback_url: p.callbackUrl,
      currency: 'NGN',
      metadata: p.metadata,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message || 'Paystack initialize failed');
  return json.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message || 'Paystack verify failed');
  return json.data as { status: string; amount: number; currency: string; reference: string; id: number };
}

// Paystack signs the RAW request body with your secret key (HMAC SHA-512).
export function validSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac('sha512', secret).update(raw).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
