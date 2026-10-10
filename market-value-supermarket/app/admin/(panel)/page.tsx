import Link from 'next/link';
import { db } from '@/lib/supabase/service';
import { sendDigestNow } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const d = db();
  const count = async (q: any) => (await q).count ?? 0;
  const [toHandle, products, subs, pending] = await Promise.all([
    count(d.from('orders').select('id', { count: 'exact', head: true }).in('status', ['paid', 'confirmed', 'out_for_delivery'])),
    count(d.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(d.from('subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null)),
    count(d.from('stock_events').select('id', { count: 'exact', head: true }).is('notified_at', null)),
  ]);

  const stat = (label: string, value: number, href: string) => (
    <Link href={href} className="card p-5 transition hover:shadow-md">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-brown-light">{label}</p>
    </Link>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {flash && <p className="rounded-xl bg-peach-light p-4 text-sm font-medium">{flash}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {stat('Orders to deliver', toHandle, '/admin/orders?view=active')}
        {stat('Products on the shop', products, '/admin/products')}
        {stat('Active subscribers', subs, '/admin/subscribers')}
      </div>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold">Stock alerts</h2>
          <p className="text-sm text-brown-light">
            {pending > 0
              ? `${pending} stock update(s) are waiting. They go out automatically a few minutes after your last change, or you can send them now.`
              : 'Nothing waiting. Alerts are queued when you save a published product with "Notify subscribers" ticked.'}
          </p>
        </div>
        <form action={sendDigestNow}>
          <button disabled={pending === 0} className="btn-peach">Send now</button>
        </form>
      </section>
      <Link href="/admin/products/new" className="btn-brown">+ Add a product</Link>
    </div>
  );
}
