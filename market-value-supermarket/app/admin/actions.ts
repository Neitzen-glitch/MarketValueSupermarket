'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/supabase/service';
import { authClient } from '@/lib/supabase/server';
import { getAdmin, requireAdmin } from '@/lib/auth';
import { toKobo } from '@/lib/money';
import { one } from '@/lib/types';
import { cancelOrder, sendOrderEmailOnce } from '@/lib/orders';
import { sendPendingDigest } from '@/lib/notify';

// ───────────── Auth ─────────────
export async function signIn(_prev: { error: string }, formData: FormData): Promise<{ error: string }> {
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: 'Wrong email or password.' };
  if (!(await getAdmin())) {
    await supabase.auth.signOut();
    return { error: 'This account is not set up as an admin.' };
  }
  redirect('/admin');
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ───────────── Products ─────────────
const tierS = z.object({ minQty: z.coerce.number().int().min(2, 'Wholesale prices start from 2 units.'), price: z.coerce.number().positive('Enter a wholesale price above ₦0.') });
const variantS = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, 'Every option needs a name, e.g. "Full basket".').max(80),
  price: z.coerce.number().positive('Enter a price above ₦0 for every option.'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative.'),
  tiers: z.array(tierS).default([]),
});
const basketS = z.object({
  enabled: z.boolean(),
  totalShares: z.coerce.number().int().min(1).default(1),
  sharePrice: z.coerce.number().min(0).default(0),
  sharesLeft: z.coerce.number().int().min(0).default(0),
  open: z.boolean(),
});
const payloadS = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, 'Give the product a name.').max(120),
  category: z.string().trim().max(60).default(''),
  description: z.string().trim().max(2000).default(''),
  deliveryFee: z.coerce.number().min(0),
  deliveryNote: z.string().trim().max(200).default(''),
  status: z.enum(['draft', 'published']),
  notify: z.boolean(),
  variants: z.array(variantS),
  basket: basketS,
});

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: any): Result => ({
  ok: false,
  error:
    e?.code === '23514'
      ? "Stock can't go below what customers currently have in carts or unpaid orders. Raise the number, or wait a few minutes for those holds to clear."
      : e?.message ?? 'Could not save. Please try again.',
});

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'product';
  const { data } = await db().from('products').select('id').eq('slug', base).maybeSingle();
  return data ? `${base}-${randomBytes(2).toString('hex')}` : base;
}

export async function saveProduct(fd: FormData): Promise<Result> {
  await requireAdmin();
  let parsed;
  try {
    parsed = payloadS.safeParse(JSON.parse(String(fd.get('payload'))));
  } catch {
    return { ok: false, error: 'Invalid form data.' };
  }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const P = parsed.data;
  if (!P.variants.length && !P.basket.enabled) return { ok: false, error: 'Add at least one option (like "1 basket" or "5 litre"), or turn on basket shares.' };
  for (const v of P.variants) {
    if (new Set(v.tiers.map((t) => t.minQty)).size !== v.tiers.length) return { ok: false, error: `"${v.name}" has two wholesale prices for the same quantity.` };
  }

  const d = db();
  let prev: any = null;
  if (P.id) {
    const { data } = await d.from('products').select('id, status, variants(id, stock, reserved), baskets(id, status, share_variant_id)').eq('id', P.id).maybeSingle();
    if (!data) return { ok: false, error: 'That product no longer exists.' };
    prev = data;
  }

  const fields = {
    name: P.name,
    category: P.category || null,
    description: P.description || null,
    delivery_fee: toKobo(P.deliveryFee),
    delivery_note: P.deliveryNote || null,
    status: P.status,
    updated_at: new Date().toISOString(),
  };
  let productId = P.id ?? '';
  if (prev) {
    const { error } = await d.from('products').update(fields).eq('id', productId);
    if (error) return fail(error);
  } else {
    const { data, error } = await d.from('products').insert({ ...fields, slug: await uniqueSlug(P.name) }).select('id').single();
    if (error || !data) return fail(error);
    productId = data.id;
  }

  // Photo
  const file = fd.get('image');
  if (file instanceof File && file.size > 0) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4_000_000) {
      return { ok: false, error: 'Product saved, but the photo must be a JPG, PNG or WebP under 4 MB.' };
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${productId}/${Date.now()}.${ext}`;
    const { error: upErr } = await d.storage.from('product-images').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (upErr) return { ok: false, error: `Product saved, but the photo upload failed: ${upErr.message}` };
    await d.from('products').update({ image_url: d.storage.from('product-images').getPublicUrl(path).data.publicUrl }).eq('id', productId);
  }

  // Options (variants) + wholesale tiers
  const prevBasket: any = one(prev?.baskets);
  const shareId: string | null = prevBasket?.share_variant_id ?? null;
  const prevVariants: { id: string; stock: number; reserved: number }[] = (prev?.variants ?? []).filter((v: any) => v.id !== shareId);
  const prevMap = new Map(prevVariants.map((v) => [v.id, v]));
  const keep = new Set(P.variants.map((v) => v.id).filter(Boolean) as string[]);
  const gone = prevVariants.filter((v) => !keep.has(v.id)).map((v) => v.id);
  if (gone.length) await d.from('variants').delete().in('id', gone);

  const events: { variant_id: string | null; event_type: 'restock' | 'basket_open' }[] = [];
  let anyAvailable = false;
  let order = 0;
  for (const v of P.variants) {
    const row = { name: v.name, price: toKobo(v.price), stock: v.stock, sort_order: order++ };
    const before = v.id ? prevMap.get(v.id) : undefined;
    let vid = before ? v.id! : '';
    if (before) {
      const { error } = await d.from('variants').update(row).eq('id', vid).eq('product_id', productId);
      if (error) return fail(error);
    } else {
      const { data, error } = await d.from('variants').insert({ ...row, product_id: productId }).select('id').single();
      if (error || !data) return fail(error);
      vid = data.id;
    }
    await d.from('price_tiers').delete().eq('variant_id', vid);
    if (v.tiers.length) await d.from('price_tiers').insert(v.tiers.map((t) => ({ variant_id: vid, min_qty: t.minQty, price: toKobo(t.price) })));
    const availBefore = before ? before.stock - before.reserved : 0;
    const availAfter = v.stock - (before?.reserved ?? 0);
    if (availAfter > 0) anyAvailable = true;
    if (availBefore <= 0 && availAfter > 0) events.push({ variant_id: vid, event_type: 'restock' });
  }

  // Basket shares: the share is a variant, `baskets` holds the total and open/closed state
  const b = P.basket;
  if (b.enabled) {
    const left = Math.min(b.sharesLeft, b.totalShares);
    if (prevBasket) {
      const { data: sv } = await d.from('variants').select('stock, reserved').eq('id', prevBasket.share_variant_id).single();
      const reserved = sv?.reserved ?? 0;
      const { error } = await d.from('variants').update({ price: toKobo(b.sharePrice), stock: left + reserved }).eq('id', prevBasket.share_variant_id);
      if (error) return fail(error);
      await d.from('baskets').update({ total_shares: b.totalShares, status: b.open ? 'open' : 'closed', closed_at: b.open ? null : new Date().toISOString() }).eq('id', prevBasket.id);
      const wasAvail = (sv?.stock ?? 0) - reserved > 0 && prevBasket.status === 'open';
      if (b.open && left > 0 && !wasAvail) events.push({ variant_id: prevBasket.share_variant_id, event_type: 'basket_open' });
    } else {
      const { data: sv, error } = await d.from('variants').insert({ product_id: productId, name: '1 share', price: toKobo(b.sharePrice), stock: left, sort_order: 999 }).select('id').single();
      if (error || !sv) return fail(error);
      const { error: e2 } = await d.from('baskets').insert({ product_id: productId, share_variant_id: sv.id, total_shares: b.totalShares, status: b.open ? 'open' : 'closed' });
      if (e2) return fail(e2);
      if (b.open && left > 0) events.push({ variant_id: sv.id, event_type: 'basket_open' });
    }
    if (b.open && left > 0) anyAvailable = true;
  } else if (prevBasket) {
    await d.from('baskets').delete().eq('id', prevBasket.id);
    await d.from('variants').delete().eq('id', prevBasket.share_variant_id);
  }

  // Tell subscribers (queued; the cron job or "Send now" delivers it)
  if (P.notify && P.status === 'published' && anyAvailable) {
    const wasPublished = prev?.status === 'published';
    const rows: { product_id: string; variant_id: string | null; event_type: string }[] = wasPublished
      ? events.map((e) => ({ product_id: productId, variant_id: e.variant_id, event_type: e.event_type }))
      : [{ product_id: productId, variant_id: null, event_type: 'new_product' }];
    if (rows.length) await d.from('stock_events').insert(rows);
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setProductStatus(id: string, status: 'draft' | 'published') {
  await requireAdmin();
  await db().from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/', 'layout');
}

export async function markSoldOut(id: string) {
  await requireAdmin();
  const d = db();
  const { data } = await d.from('variants').select('id, reserved').eq('product_id', id);
  for (const v of data ?? []) await d.from('variants').update({ stock: v.reserved }).eq('id', v.id); // available = 0
  revalidatePath('/', 'layout');
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await db().from('products').delete().eq('id', id);
  revalidatePath('/', 'layout');
}

// ───────────── Orders ─────────────
export async function setOrderStatus(id: string, status: 'out_for_delivery' | 'delivered') {
  await requireAdmin();
  const from = status === 'out_for_delivery' ? ['paid', 'confirmed'] : ['paid', 'confirmed', 'out_for_delivery'];
  await db().from('orders').update({ status }).eq('id', id).in('status', from);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
}

export async function cancelOrderAction(id: string) {
  await requireAdmin();
  await cancelOrder(id);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
}

export async function resendOrderEmail(id: string) {
  await requireAdmin();
  await sendOrderEmailOnce(id, true);
  revalidatePath(`/admin/orders/${id}`);
}

// ───────────── Notifications ─────────────
export async function sendDigestNow() {
  await requireAdmin();
  const r = await sendPendingDigest({ force: true });
  const text = r.sent ? `Sent to ${(r as any).emails} email(s) and ${(r as any).sms} SMS` : `Nothing sent (${(r as any).reason})`;
  redirect(`/admin?flash=${encodeURIComponent(text)}`);
}
