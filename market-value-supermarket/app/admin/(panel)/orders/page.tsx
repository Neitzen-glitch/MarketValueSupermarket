import Link from 'next/link';
import { db } from '@/lib/supabase/service';
import { naira } from '@/lib/money';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders' };

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  active: { label: 'To deliver', statuses: ['paid', 'confirmed', 'out_for_delivery'] },
  all: { label: 'All', statuses: null },
  delivered: { label: 'Delivered', statuses: ['delivered'] },
  closed: { label: 'Cancelled / expired', statuses: ['cancelled', 'expired'] },
  pending: { label: 'Awaiting payment', statuses: ['pending'] },
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = 'active' } = await searchParams;
  const current = VIEWS[view] ? view : 'active';
  let q = db().from('orders').select('id, order_number, customer_name, total, payment_method, status, created_at').order('created_at', { ascending: false }).limit(200);
  const statuses = VIEWS[current].statuses;
  if (statuses) q = q.in('status', statuses);
  const { data } = await q;
  const orders = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(VIEWS).map(([key, v]) => (
          <Link key={key} href={`/admin/orders?view=${key}`} className={`rounded-full px-4 py-1.5 ${current === key ? 'bg-brown text-cream' : 'border border-brown/20 hover:bg-cream-dark'}`}>
            {v.label}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-brown-light">No orders here yet.</div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o: any) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-md">
                <div>
                  <p className="font-semibold">{o.order_number} · {o.customer_name}</p>
                  <p className="text-xs text-brown-light">
                    {new Date(o.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })} · {o.payment_method === 'cod' ? 'Pay on delivery' : 'Paid online'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{naira(o.total)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
