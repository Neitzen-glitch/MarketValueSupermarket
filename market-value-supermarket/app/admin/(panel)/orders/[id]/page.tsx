import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/service';
import { naira } from '@/lib/money';
import { displayPhone } from '@/lib/phone';
import StatusBadge from '@/components/StatusBadge';
import ConfirmButton from '@/components/admin/ConfirmButton';
import CopyButton from '@/components/admin/CopyButton';
import { cancelOrderAction, resendOrderEmail, setOrderStatus } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: o } = await db().from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (!o) notFound();

  const items: any[] = o.order_items ?? [];
  const summary = [
    `${o.order_number} · Market Value Supermarket`,
    `Name: ${o.customer_name}`,
    `Phone: ${displayPhone(o.customer_phone)}`,
    `Address: ${o.delivery_address}`,
    '',
    ...items.map((i) => `• ${i.product_name} (${i.variant_name}) × ${i.quantity} — ${naira(i.line_total)}`),
    `Delivery: ${naira(o.delivery_total)}`,
    `TOTAL: ${naira(o.total)}`,
    o.payment_method === 'cod' ? 'PAY ON DELIVERY' : 'PAID ONLINE',
    o.notes ? `Note: ${o.notes}` : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const live = ['paid', 'confirmed', 'out_for_delivery'].includes(o.status);
  const canCancel = !['cancelled', 'expired', 'delivered'].includes(o.status);
  const btn = 'btn-brown';

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-brown-light hover:underline">← Orders</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{o.order_number}</h1>
        <StatusBadge status={o.status} />
        <span className="text-sm text-brown-light">
          {new Date(o.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      {o.notes?.includes('PAID AFTER HOLD EXPIRED') && (
        <p className="rounded-xl bg-peach p-4 text-sm font-semibold text-brown-dark">
          This customer paid after the 15-minute hold ended and stock ran short. Fulfil it manually or refund from your Paystack dashboard.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Customer</h2>
          <p>{o.customer_name}</p>
          <p>{displayPhone(o.customer_phone)}</p>
          <p>{o.customer_email}</p>
          <p className="whitespace-pre-line">{o.delivery_address}</p>
          {o.notes && <p className="pt-2 text-brown-light">Note: {o.notes}</p>}
        </section>
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Items</h2>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3">
              <span>{i.product_name} <span className="text-brown-light">· {i.variant_name} × {i.quantity}</span></span>
              <span>{naira(i.line_total)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-brown/10 pt-2"><span>Delivery</span><span>{naira(o.delivery_total)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total</span><span>{naira(o.total)}</span></div>
          <p className="text-brown-light">{o.payment_method === 'cod' ? 'Customer pays on delivery' : 'Paid online through Paystack'}</p>
        </section>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {['paid', 'confirmed'].includes(o.status) && (
            <form action={setOrderStatus.bind(null, o.id, 'out_for_delivery')}><button className={btn}>Mark out for delivery</button></form>
          )}
          {live && (
            <form action={setOrderStatus.bind(null, o.id, 'delivered')}><button className="btn-peach">Mark delivered</button></form>
          )}
          {['paid', 'confirmed', 'out_for_delivery', 'delivered'].includes(o.status) && (
            <form action={resendOrderEmail.bind(null, o.id)}><button className="btn-outline">Resend {o.payment_method === 'cod' ? 'confirmation' : 'receipt'} email</button></form>
          )}
          {canCancel && (
            <form action={cancelOrderAction.bind(null, o.id)}>
              <ConfirmButton message="Cancel this order and put its stock back?" className="btn-outline">Cancel order</ConfirmButton>
            </form>
          )}
        </div>
        {canCancel && o.payment_method === 'online' && o.status !== 'pending' && (
          <p className="text-xs text-brown-light">This order was paid online. Cancelling here restores the stock; refund the customer from your Paystack dashboard.</p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Order summary to forward (WhatsApp, rider, etc.)</h2>
          <CopyButton text={summary} />
        </div>
        <textarea readOnly value={summary} rows={10} className="input font-mono text-xs" />
      </section>
    </div>
  );
}
