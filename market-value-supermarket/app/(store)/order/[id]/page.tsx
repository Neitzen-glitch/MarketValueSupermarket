import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/service';
import { confirmPayment } from '@/lib/orders';
import { one } from '@/lib/types';
import { naira } from '@/lib/money';
import { displayPhone } from '@/lib/phone';
import ClearCart from '@/components/ClearCart';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order' };

const SELECT = '*, order_items(*), payments(reference, status)';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = db();
  let { data: order } = await d.from('orders').select(SELECT).eq('id', id).maybeSingle();
  if (!order) notFound();

  // Customer just came back from Paystack: confirm with Paystack right now instead of waiting
  // for the webhook (whichever lands first wins; the other is a harmless no-op).
  if (order.payment_method === 'online' && (order.status === 'pending' || order.status === 'expired')) {
    const pay: any = one(order.payments);
    if (pay) {
      try {
        await confirmPayment(pay.reference);
        const r = await d.from('orders').select(SELECT).eq('id', id).single();
        order = r.data ?? order;
      } catch (e) {
        console.error('order page confirm failed', e);
      }
    }
  }

  const paid = ['paid', 'confirmed', 'out_for_delivery', 'delivered'].includes(order.status);
  const headline =
    order.status === 'pending'
      ? 'Waiting for your payment'
      : order.status === 'expired'
        ? 'This order expired'
        : order.status === 'cancelled'
          ? 'This order was cancelled'
          : order.payment_method === 'cod'
            ? 'Order confirmed!'
            : 'Payment received. Thank you!';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {paid && <ClearCart />}
      <div className="card p-6 text-center">
        <h1 className="text-2xl font-bold">{headline}</h1>
        <p className="mt-2 text-sm text-brown-light">
          Order <b className="text-brown">{order.order_number}</b> · <StatusBadge status={order.status} />
        </p>
        {paid && order.payment_method === 'online' && (
          <p className="mt-3 text-sm">A receipt is on its way to <b>{order.customer_email}</b>.</p>
        )}
        {paid && order.payment_method === 'cod' && (
          <p className="mt-3 text-sm">Please pay <b>{naira(order.total)}</b> when your order arrives. We sent a confirmation to <b>{order.customer_email}</b>.</p>
        )}
        {order.status === 'pending' && (
          <p className="mt-3 text-sm">
            If you have already paid, give it a moment and{' '}
            <a href="" className="font-semibold underline">
              check again
            </a>
            . If your payment did not go through, you can <Link href="/cart" className="font-semibold underline">try again</Link>.
          </p>
        )}
        {(order.status === 'expired' || order.status === 'cancelled') && (
          <Link href="/" className="btn-peach mt-4">
            Back to shop
          </Link>
        )}
      </div>

      <div className="card space-y-3 p-6 text-sm">
        <ul className="divide-y divide-brown/10">
          {(order.order_items ?? []).map((i: any) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.product_name} <span className="text-brown-light">· {i.variant_name} × {i.quantity}</span>
              </span>
              <span>{naira(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between"><span>Delivery</span><span>{naira(order.delivery_total)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>Total</span><span>{naira(order.total)}</span></div>
        <div className="border-t border-brown/10 pt-3 text-brown-light">
          <p>Delivering to {order.customer_name}, {order.delivery_address}</p>
          <p>{displayPhone(order.customer_phone)}</p>
        </div>
      </div>
    </div>
  );
}
