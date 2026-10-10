import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrder, CheckoutError } from '@/lib/orders';
import { normalizeNgPhone } from '@/lib/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(100),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  phone: z.string().trim().min(1, 'Please enter your phone number.'),
  address: z.string().trim().min(8, 'Please enter your full delivery address.').max(300),
  notes: z.string().trim().max(300).optional().default(''),
  method: z.enum(['online', 'cod']),
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10000) }))
    .min(1, 'Your cart is empty.')
    .max(50),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Please check your details.' }, { status: 400 });

  const phone = normalizeNgPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: 'Enter a valid Nigerian phone number, e.g. 0803 123 4567.' }, { status: 400 });

  try {
    return NextResponse.json(await createOrder({ ...parsed.data, phone }));
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('checkout failed', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
