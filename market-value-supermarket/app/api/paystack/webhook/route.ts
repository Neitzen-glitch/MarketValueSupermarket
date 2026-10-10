import { NextResponse } from 'next/server';
import { validSignature } from '@/lib/paystack';
import { confirmPayment } from '@/lib/orders';
import { db } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text(); // the signature is over the RAW body: do not parse before checking
  if (!validSignature(raw, req.headers.get('x-paystack-signature'))) return new NextResponse('invalid signature', { status: 401 });

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }
  const reference: string | undefined = evt?.data?.reference;
  if (!evt?.event || !reference) return NextResponse.json({ ok: true });

  const d = db();
  const key = `${evt.event}:${reference}`;
  // Insert first: a unique-key clash means Paystack is retrying something we already handled.
  const { error: dup } = await d.from('webhook_events').insert({ event_key: key, event_type: evt.event, payload: evt });
  if (dup) {
    if (dup.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    console.error('webhook log failed', dup);
    return new NextResponse('db error', { status: 500 });
  }

  try {
    if (evt.event === 'charge.success') {
      // confirmPayment re-verifies with Paystack's API. If it is not confirmed yet, answer with an
      // error so Paystack retries later (an amount mismatch is final, so that one is not retried).
      const result = await confirmPayment(reference);
      if (result === 'pending') throw new Error('Paystack has not confirmed this payment yet');
    }
    await d.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('event_key', key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('webhook processing failed', e);
    await d.from('webhook_events').delete().eq('event_key', key); // so Paystack's retry is processed
    return new NextResponse('processing failed', { status: 500 });
  }
}
