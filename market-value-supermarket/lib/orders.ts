import 'server-only';
import { randomBytes } from 'crypto';
import { db } from './supabase/service';
import { priceCart, type CartLine } from './pricing';
import { initializeTransaction, verifyTransaction } from './paystack';
import { sendEmail } from './email';
import { orderEmail } from './emailTemplates';
import { one } from './types';
import { siteUrl } from './site';

const HOLD_MINUTES = 15;

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type CheckoutInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  method: 'online' | 'cod';
  items: { variantId: string; quantity: number }[];
};

type Held = { variantId: string; qty: number };
async function releaseAll(held: Held[]) {
  for (const h of held) await db().rpc('release_stock', { p_variant: h.variantId, p_qty: h.qty });
}

// Pending orders whose 15-minute hold lapsed give their stock back. The status flip is the
// atomic claim, so overlapping callers never release the same stock twice.
export async function expireStaleOrders(): Promise<number> {
  const d = db();
  const { data: stale } = await d
    .from('orders')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('reserved_until', new Date().toISOString())
    .select('id, order_items(variant_id, quantity)');
  for (const o of stale ?? []) {
    for (const it of o.order_items ?? []) {
      if (it.variant_id) await d.rpc('release_stock', { p_variant: it.variant_id, p_qty: it.quantity });
    }
  }
  return stale?.length ?? 0;
}

export async function createOrder(input: CheckoutInput): Promise<{ orderId: string; redirect: string }> {
  const d = db();
  await expireStaleOrders();

  // Merge duplicate lines
  const qtyById = new Map<string, number>();
  for (const i of input.items) qtyById.set(i.variantId, (qtyById.get(i.variantId) ?? 0) + i.quantity);

  // Load REAL prices and stock from the database. Nothing price-related is taken from the browser.
  const { data: rows, error } = await d
    .from('variants')
    .select('id, name, price, stock, reserved, products!inner(id, name, status, delivery_fee), price_tiers(min_qty, price), baskets(status)')
    .in('id', [...qtyById.keys()]);
  if (error) throw error;
  const byId = new Map<string, any>((rows ?? []).map((r: any) => [r.id, r]));

  const lines: CartLine[] = [];
  for (const [variantId, quantity] of qtyById) {
    const v = byId.get(variantId);
    const p: any = one(v?.products);
    if (!v || !p || p.status !== 'published') throw new CheckoutError('An item in your cart is no longer available.', 409);
    const basket: any = one(v.baskets);
    if (basket?.status === 'closed') throw new CheckoutError(`${p.name} is closed for new shares.`, 409);
    const free = Math.max(v.stock - v.reserved, 0);
    if (free < quantity) {
      throw new CheckoutError(free === 0 ? `${p.name} (${v.name}) just sold out.` : `Only ${free} left of ${p.name} (${v.name}).`, 409);
    }
    lines.push({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      variantName: v.name,
      quantity,
      basePrice: v.price,
      tiers: (v.price_tiers ?? []).map((t: any) => ({ minQty: t.min_qty, price: t.price })),
      deliveryFeePerUnit: p.delivery_fee,
    });
  }
  const priced = priceCart(lines);
  if (priced.total <= 0) throw new CheckoutError('This order has no payable amount.');

  // Reserve stock atomically, line by line. If any line fails, put back what we took.
  const held: Held[] = [];
  for (const l of priced.lines) {
    const { data: ok } = await d.rpc('reserve_stock', { p_variant: l.variantId, p_qty: l.quantity });
    if (!ok) {
      await releaseAll(held);
      throw new CheckoutError(`${l.productName} just sold out. Please adjust your cart.`, 409);
    }
    held.push({ variantId: l.variantId, qty: l.quantity });
  }

  const isCod = input.method === 'cod';
  const { data: order, error: oErr } = await d
    .from('orders')
    .insert({
      customer_name: input.name,
      customer_email: input.email,
      customer_phone: input.phone,
      delivery_address: input.address,
      notes: input.notes || null,
      payment_method: input.method,
      status: isCod ? 'confirmed' : 'pending',
      subtotal: priced.subtotal,
      delivery_total: priced.deliveryTotal,
      total: priced.total,
      reserved_until: isCod ? null : new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
    })
    .select('id, order_number')
    .single();
  if (oErr || !order) {
    await releaseAll(held);
    throw new CheckoutError('Could not create your order. Please try again.', 500);
  }

  const { error: iErr } = await d.from('order_items').insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      variant_id: l.variantId,
      product_name: l.productName,
      variant_name: l.variantName,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      delivery_fee: l.deliveryFeePerUnit,
      line_total: l.lineTotal,
    })),
  );
  if (iErr) {
    await d.from('orders').delete().eq('id', order.id);
    await releaseAll(held);
    throw new CheckoutError('Could not create your order. Please try again.', 500);
  }

  if (isCod) {
    // Confirmed straight away: turn the reservation into a real stock deduction.
    for (const h of held) await d.rpc('commit_stock', { p_variant: h.variantId, p_qty: h.qty });
    await sendOrderEmailOnce(order.id);
    return { orderId: order.id, redirect: `/order/${order.id}` };
  }

  const reference = `${order.order_number}-${randomBytes(4).toString('hex')}`;
  const { error: pErr } = await d.from('payments').insert({ order_id: order.id, reference, amount: priced.total });
  if (pErr) {
    await cancelOrder(order.id);
    throw new CheckoutError('Could not start payment. Please try again.', 500);
  }
  try {
    const init = await initializeTransaction({
      email: input.email,
      amount: priced.total,
      reference,
      callbackUrl: `${siteUrl()}/order/${order.id}`,
      metadata: { order_id: order.id, order_number: order.order_number },
    });
    return { orderId: order.id, redirect: init.authorization_url };
  } catch (e) {
    console.error('Paystack initialize failed', e);
    await cancelOrder(order.id);
    throw new CheckoutError('Could not start payment. Please try again in a moment.', 502);
  }
}

// Verifies with Paystack (never trusts the browser or the webhook body alone), then finalises.
// Safe to call many times: the payment-row claim makes it idempotent.
export async function confirmPayment(reference: string): Promise<'paid' | 'failed' | 'pending' | 'unknown'> {
  const d = db();
  const { data: payment } = await d.from('payments').select('*').eq('reference', reference).maybeSingle();
  if (!payment) return 'unknown';
  if (payment.status === 'success') return 'paid';

  const tx = await verifyTransaction(reference);
  if (tx.status !== 'success') {
    if (tx.status === 'failed' || tx.status === 'abandoned') {
      await d.from('payments').update({ status: tx.status }).eq('id', payment.id).neq('status', 'success');
    }
    return tx.status === 'failed' || tx.status === 'reversed' ? 'failed' : 'pending';
  }
  if (tx.amount !== payment.amount || tx.currency !== 'NGN') {
    console.error('Paystack amount mismatch', { reference, expected: payment.amount, got: tx.amount, currency: tx.currency });
    await d.from('payments').update({ status: 'failed' }).eq('id', payment.id).neq('status', 'success');
    return 'failed';
  }

  const { data: claimed } = await d
    .from('payments')
    .update({ status: 'success', paid_at: new Date().toISOString(), paystack_transaction_id: String(tx.id) })
    .eq('id', payment.id)
    .neq('status', 'success')
    .select('id');
  if (!claimed?.length) return 'paid'; // someone else already processed it

  await finalizePaidOrder(payment.order_id);
  return 'paid';
}

async function finalizePaidOrder(orderId: string) {
  const d = db();
  const { data: order } = await d.from('orders').select('*, order_items(*)').eq('id', orderId).single();
  if (!order) return;

  if (order.status === 'pending') {
    const { data: moved } = await d.from('orders').update({ status: 'paid', reserved_until: null }).eq('id', orderId).eq('status', 'pending').select('id');
    if (moved?.length) {
      for (const it of order.order_items ?? []) {
        if (it.variant_id) await d.rpc('commit_stock', { p_variant: it.variant_id, p_qty: it.quantity });
      }
    }
  } else if (order.status === 'expired') {
    // Paid after the hold lapsed (stock was released). Take it again if it is still there.
    let short = false;
    for (const it of order.order_items ?? []) {
      if (!it.variant_id) continue;
      const { data: ok } = await d.rpc('take_stock', { p_variant: it.variant_id, p_qty: it.quantity });
      if (!ok) short = true;
    }
    const note = short ? 'PAID AFTER HOLD EXPIRED AND STOCK RAN SHORT. Refund on Paystack or fulfil manually.' : null;
    await d
      .from('orders')
      .update({ status: 'paid', reserved_until: null, notes: [order.notes, note].filter(Boolean).join(' | ') || null })
      .eq('id', orderId);
  } else {
    return; // cancelled or already handled
  }
  await sendOrderEmailOnce(orderId);
}

// Emails the receipt (paid online) or confirmation (pay on delivery) exactly once per order.
export async function sendOrderEmailOnce(orderId: string, force = false): Promise<boolean> {
  const d = db();
  if (force) await d.from('orders').update({ receipt_sent_at: null }).eq('id', orderId);
  const { data: o } = await d
    .from('orders')
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('receipt_sent_at', null)
    .select('*, order_items(*)')
    .maybeSingle();
  if (!o) return false;
  const { subject, html } = orderEmail(o, o.payment_method === 'cod' ? 'cod' : 'receipt');
  const ok = await sendEmail(o.customer_email, subject, html);
  if (!ok) await d.from('orders').update({ receipt_sent_at: null }).eq('id', orderId); // allow a retry
  return ok;
}

// Cancels an order and puts its stock back. Pending = release the hold; otherwise = add stock back.
export async function cancelOrder(orderId: string): Promise<boolean> {
  const d = db();
  const { data: o } = await d.from('orders').select('id, status, order_items(variant_id, quantity)').eq('id', orderId).maybeSingle();
  if (!o || ['cancelled', 'expired', 'delivered'].includes(o.status)) return false;
  const { data: claimed } = await d.from('orders').update({ status: 'cancelled', reserved_until: null }).eq('id', orderId).eq('status', o.status).select('id');
  if (!claimed?.length) return false;
  for (const it of o.order_items ?? []) {
    if (!it.variant_id) continue;
    await d.rpc(o.status === 'pending' ? 'release_stock' : 'add_stock', { p_variant: it.variant_id, p_qty: it.quantity });
  }
  return true;
}
